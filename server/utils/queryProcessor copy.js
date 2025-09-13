import { Op } from 'sequelize';
import { sequelize } from '../config/database.js';
import moment from 'moment';

/**
 * Query Processor for handling complex database queries with multiple associations
 * 
 * Include Syntax Examples:
 * - Basic include: include=m_gen (shows all associations to m_gen with descriptive aliases)
 *   For m_unit_business -> m_gen associations: m_gen_prov, m_gen_kec, m_gen_kota
 * - All associations: include=m_gen@m_gen*all (explicitly include all with numbered aliases)
 * - Specific associations: include=m_gen@m_gen*1,3 (include only 1st and 3rd associations)
 * - Custom alias: include=m_gen@custom_alias (use custom alias)
 * 
 * Filter Examples:
 * - Filter by specific association: filter_column_m_gen_prov.value1=Jakarta
 * - Filter by numbered alias: filter_column_m_gen1.value1=Jakarta
 */

const isDateTimeField = (model, field) => {
    const attributes = model.rawAttributes;
    return attributes[field] &&
        (attributes[field].type.key === 'DATE' ||
            attributes[field].type.key === 'TIMESTAMP' ||
            attributes[field].type.key === 'TIMESTAMPTZ');
};

const formatDateTimeFields = (data, model) => {
    if (!data) return data;

    const attributes = model.rawAttributes;

    const processItem = (item) => {
        const rawData = item.dataValues || item;
        const result = { ...rawData };

        Object.keys(attributes).forEach(field => {
            if (isDateTimeField(model, field) && result[field]) {
                result[field] = moment(result[field]).format('YYYY-MM-DD HH:mm:ss');
            }
        });

        ['createdAt', 'updatedAt', 'deletedAt'].forEach(field => {
            if (result[field]) {
                result[field] = moment(result[field]).format('YYYY-MM-DD HH:mm:ss');
            }
        });

        return result;
    };

    return Array.isArray(data) ? data.map(item => processItem(item)) : processItem(data);
};

const executeQuery = async (model, queryOptions, isSingle = false) => {
    const options = {
        ...queryOptions,
        // raw: true
    };

    // Tambahkan distinct agar count pagination valid jika ada include
    if (options.include && options.include.length > 0) {
        options.distinct = true;
    }

    let result;
    if (isSingle) {
        result = await model.findOne(options);
        return result ? formatDateTimeFields(result, model) : null;
    } else {
        const { count, rows } = await model.findAndCountAll(options);
        return {
            count,
            rows: formatDateTimeFields(rows, model)
        };
    }
};

const buildQueryOptions = (params) => {
    const queryOptions = {
        where: {},
        attributes: undefined,
        include: [],
        order: [],
        group: undefined
    };

    // Only add pagination if no_pagination is not true
    if (!params.no_pagination || params.no_pagination !== 'true') {
        queryOptions.limit = parseInt(params.paginate, 10) || 10;
        queryOptions.offset = ((parseInt(params.page, 10) || 1) - 1) * (parseInt(params.paginate, 10) || 10);
    }    // Helper function to parse operators in where conditions
    const parseWhereCondition = (condition) => {
        // Define operator mappings
        const operators = {
            '!=': Op.ne,
            '<>': Op.ne,
            '>=': Op.gte,
            '<=': Op.lte,
            '=': Op.eq,
            '>': Op.gt,
            '<': Op.lt
        };

        // Sort operators by length (longest first) to handle >= before > etc
        const sortedOps = Object.keys(operators).sort((a, b) => b.length - a.length);

        // Find the first matching operator
        for (const op of sortedOps) {
            if (condition.includes(op)) {
                const [field, value] = condition.split(op).map(s => s.trim());
                // Convert 'true'/'false' strings to boolean
                let parsedValue = value;
                if (value.toLowerCase() === 'true') parsedValue = true;
                if (value.toLowerCase() === 'false') parsedValue = false;
                // Convert numeric strings to numbers
                if (!isNaN(value) && value.trim() !== '') parsedValue = Number(value);

                return { [field]: { [operators[op]]: parsedValue } };
            }
        }
        return null;
    };

    if (params.include) {
        const buildIncludeForModel = (model, modelName, fieldsRaw, joinOrOnRaw, parentModel = null) => {
            // Remove 'as' from attributes if present
            let attributes = fieldsRaw ? fieldsRaw.split('|').filter(f => f !== 'as') : undefined;
            const baseInclude = {
                model,
                attributes,
                include: []
            };

            // Add this to ensure the table name is used instead of model name
            if (model.options && model.options.tableName) {
                baseInclude.as = model.options.tableName;
            }

            if (joinOrOnRaw && ['inner', 'left', 'right'].includes(joinOrOnRaw.toLowerCase())) {
                const joinLower = joinOrOnRaw.toLowerCase();
                if (joinLower === 'inner') {
                    baseInclude.required = true;
                    baseInclude.right = false;
                } else if (joinLower === 'right') {
                    baseInclude.required = false;
                    baseInclude.right = true;
                } else if (joinLower === 'left') {
                    baseInclude.required = false;
                    baseInclude.right = false;
                }
            }

            return baseInclude;
        };

        const processIncludes = (modelPath, parentModel) => {
            const [modelSpec, ...childSpecs] = modelPath;
            let [modelName, fieldsRaw, joinType] = modelSpec.split(':');
            const [name, alias] = modelName.split('@');

            // Swap fieldsRaw & joinType if fieldsRaw is join type and joinType is undefined
            if (!joinType && ['inner', 'left', 'right'].includes((fieldsRaw || '').toLowerCase())) {
                joinType = fieldsRaw;
                fieldsRaw = undefined;
            }

            const model = sequelize.models[name];
            if (!model) throw new Error(`Model '${name}' not found`);

            let includes = []; if (alias) {
                // Check if this is a special syntax for specific association (e.g., m_gen*all or m_gen*1,2,3)
                if (alias.includes('*')) {
                    const [baseAlias, modifier] = alias.split('*');
                    const associations = Object.values(parentModel.associations)
                        .filter(assoc => assoc.target === model);

                    if (modifier === 'all') {
                        // Include all associations to this model
                        associations.forEach((assoc, index) => {
                            const uniqueAlias = associations.length > 1
                                ? `${baseAlias}${index + 1}`
                                : baseAlias;

                            includes.push({
                                ...buildIncludeForModel(model, name, fieldsRaw, joinType),
                                association: assoc,
                                as: uniqueAlias
                            });
                        });
                    } else {
                        // Include specific associations by number (e.g., m_gen*1,3)
                        const indices = modifier.split(',').map(i => parseInt(i.trim()) - 1);
                        indices.forEach(index => {
                            if (associations[index]) {
                                const uniqueAlias = `${baseAlias}${index + 1}`;
                                includes.push({
                                    ...buildIncludeForModel(model, name, fieldsRaw, joinType),
                                    association: associations[index],
                                    as: uniqueAlias
                                });
                            }
                        });
                    }
                } else {
                    // If alias specified, use exact association
                    includes.push({
                        ...buildIncludeForModel(model, name, fieldsRaw, joinType),
                        as: alias
                    });
                }
            } else {
                // Get all associations between these models
                const associations = Object.values(parentModel.associations)
                    .filter(assoc => assoc.target === model);

                // Debug: log found associations
                // console.log(`Found ${associations.length} associations from ${parentModel.name} to ${model.name}:`);
                associations.forEach((assoc, idx) => {
                    // console.log(`  ${idx + 1}. ${assoc.as || assoc.associationAccessor} (foreignKey: ${assoc.foreignKey})`);
                }); if (associations.length > 0) {
                    // Include all associations to the same model
                    associations.forEach((assoc, index) => {
                        // Generate unique alias based on association name or foreign key
                        let uniqueAlias;

                        if (assoc.as) {
                            // Use the association alias if available
                            uniqueAlias = assoc.as;
                        } else if (assoc.foreignKey) {
                            // Create alias based on foreign key (e.g., f_prov -> m_gen_prov)
                            const fkSuffix = assoc.foreignKey.replace('f_', '');
                            uniqueAlias = `${model.options.tableName || name}_${fkSuffix}`;
                        } else {
                            // Fallback to numbered aliases
                            uniqueAlias = associations.length > 1
                                ? `${model.options.tableName || name}${index + 1}`
                                : model.options.tableName || name;
                        }

                        // console.log(`Adding include with alias: ${uniqueAlias} for association: ${assoc.as || assoc.associationAccessor} (FK: ${assoc.foreignKey})`);

                        const includeConfig = {
                            ...buildIncludeForModel(model, name, fieldsRaw, joinType),
                            as: uniqueAlias
                        };

                        // Use the association if it exists, otherwise use model directly
                        if (assoc.as) {
                            includeConfig.association = assoc;
                        } else {
                            includeConfig.model = model;
                        }

                        includes.push(includeConfig);
                    });
                } else {
                    // If no associations found, try using the table name
                    includes.push({
                        ...buildIncludeForModel(model, name, fieldsRaw, joinType),
                        as: model.options.tableName || name
                    });
                }
            }

            // Process nested includes
            if (childSpecs.length > 0) {
                includes.forEach(include => {
                    const childIncludes = processIncludes(childSpecs, model);
                    include.include = childIncludes;
                });
            }

            return includes;
        };

        params.include.split(',').forEach(includePath => {
            const modelPath = includePath.split('>');
            const includes = processIncludes(modelPath, sequelize.models[params.model]);
            queryOptions.include.push(...includes);
        });
    }

    if (params.selectfield) queryOptions.attributes = params.selectfield.split(',');
    if (params.addselect) queryOptions.attributes = [...(queryOptions.attributes || []), ...params.addselect.split(',')];

    if (params.search && params.searchfield) {
        const searchFields = params.searchfield.split(',');
        const searchConditions = searchFields.map(field => {
            const model = sequelize.models[params.model];
            if (isDateTimeField(model, field)) {
                try {
                    const searchDate = moment(params.search);
                    if (searchDate.isValid()) {
                        return {
                            [field]: {
                                [Op.between]: [
                                    searchDate.startOf('day').toDate(),
                                    searchDate.endOf('day').toDate()
                                ]
                            }
                        };
                    }
                } catch (e) {
                    return null;
                }
            }
            return { [field]: { [Op.iLike]: `%${params.search}%` } };
        }).filter(condition => condition !== null);

        if (searchConditions.length > 0) {
            queryOptions.where[Op.or] = searchConditions;
        }
    } Object.keys(params).forEach(key => {
        if (key.startsWith('filter_column_')) {
            let columnKey = key.replace('filter_column_', '');
            let model = sequelize.models[params.model];
            let where = queryOptions.where;
            let targetInclude = null;            // Handle nested filters using dot notation (table1.table2.table3.column)
            if (columnKey.includes('.')) {
                const parts = columnKey.split('.');
                const fieldName = parts.pop(); // Get the last part as field name
                let currentIncludes = queryOptions.include;
                let currentModel = model;                // Navigate through the chain of includes
                for (const tableName of parts) {
                    const targetModel = sequelize.models[tableName];
                    if (!targetModel) continue;                    // Find the include for this model - support various alias formats
                    targetInclude = currentIncludes.find(inc => {
                        const modelName = inc.model.options?.tableName || inc.model.name;
                        const incAlias = inc.as;

                        // Check exact match first
                        if (modelName === tableName || incAlias === tableName) {
                            return true;
                        }

                        // Check if tableName matches FK-based alias pattern (e.g., m_gen_prov)
                        if (incAlias && incAlias.startsWith(modelName + '_')) {
                            const aliasSuffix = incAlias.replace(modelName + '_', '');
                            if (tableName === `${modelName}_${aliasSuffix}` || tableName === aliasSuffix) {
                                return true;
                            }
                        }

                        // Check if tableName is a numbered version (e.g., m_gen1, m_gen2)
                        const baseTableName = tableName.replace(/\d+$/, '');
                        if (modelName === baseTableName || (incAlias && incAlias.replace(/\d+$/, '') === baseTableName)) {
                            return true;
                        }

                        return inc.model === targetModel;
                    });

                    if (targetInclude) {
                        // Initialize where clause for the include if it doesn't exist
                        if (!targetInclude.where) targetInclude.where = {};
                        where = targetInclude.where;
                        currentModel = targetModel;
                        // Move to next level of includes
                        currentIncludes = targetInclude.include || [];
                        // Make sure the join is required
                        targetInclude.required = true;
                    }
                }

                if (targetInclude) {
                    model = currentModel;
                    columnKey = fieldName;
                }
            }

            const operator = params[`filter_operator_${columnKey}`] || '~*';
            const opMap = {
                '~*': Op.iLike,
                '=': Op.eq,
                '>': Op.gt,
                '<': Op.lt,
                '>=': Op.gte,
                '<=': Op.lte,
                '<>': Op.ne
            };

            if (!where[columnKey]) {
                where[columnKey] = [];
            }

            // If we found a target include, make it required
            if (targetInclude) {
                targetInclude.required = true;
            }
            const value = params[key]; if (isDateTimeField(model, columnKey)) {
                try {
                    const dateValue = moment(value);
                    if (dateValue.isValid()) {
                        if (operator === '~*') {
                            where[columnKey].push({
                                [Op.between]: [
                                    dateValue.startOf('day').toDate(),
                                    dateValue.endOf('day').toDate()
                                ]
                            });
                        } else {
                            where[columnKey].push({
                                [opMap[operator] || Op.eq]: dateValue.toDate()
                            });
                        }
                    }
                } catch (e) {
                    console.warn(`Invalid date value for column ${columnKey}: ${value}`);
                }
            } else {
                const columnType = model.rawAttributes[columnKey]?.type?.key || '';
                let condition;

                // Handle filter for NULL value
                if (value === null || value === 'null') {
                    condition = { [Op.is]: null };
                } else if (columnType === 'UUID') {
                    condition = { [Op.eq]: value };
                } else if (columnType === 'INTEGER' || columnType === 'BIGINT') {
                    condition = { [Op.eq]: Number(value) };
                } else if (columnType === 'BOOLEAN') {
                    // Handle boolean fields - convert string to boolean and use exact match
                    let boolValue = value;
                    if (typeof value === 'string') {
                        boolValue = value.toLowerCase() === 'true' || value === '1';
                    }
                    condition = { [Op.eq]: boolValue };
                } else if (operator === '~*') {
                    condition = { [Op.iLike]: `%${value}%` };
                } else {
                    condition = { [opMap[operator] || Op.eq]: value };
                }

                where[columnKey] = condition;
            }
        }
    });

    Object.keys(queryOptions.where).forEach(column => {
        if (Array.isArray(queryOptions.where[column])) {
            queryOptions.where[column] = { [Op.and]: queryOptions.where[column] };
        }
    });

    if (params.notin) {
        const [column, values] = params.notin.split(':');
        queryOptions.where[column] = { [Op.notIn]: values.split(',') };
    }

    if (params.order_by_raw) {
        queryOptions.order = params.order_by_raw.split(',').map(item => {
            const [field, direction] = item.trim().split(' ');
            return [field, direction];
        });
    } else if (params.order_by) {
        queryOptions.order = [[params.order_by, params.order_type || 'ASC']];
    }

    if (params.group_by) queryOptions.group = params.group_by.split(',');
    if (params.where) {
        const whereConditions = params.where.split('|');
        const parsedConditions = whereConditions.map(condition => {
            // Handle operator conditions first
            const operatorCondition = parseWhereCondition(condition);
            if (operatorCondition) {
                return operatorCondition;
            }

            // Handle existing field:value format
            if (condition.includes(':')) {
                const [field, ...rest] = condition.split(':');
                const value = rest.join(':'); // support value yang mengandung ':'
                return { [field.trim()]: value.trim() };
            } else {
                return sequelize.literal(condition);
            }
        });
        // Gabungkan dengan where existing
        if (parsedConditions.length === 1 && typeof parsedConditions[0] === 'object' && !parsedConditions[0][Op.and]) {
            queryOptions.where = { ...queryOptions.where, ...parsedConditions[0] };
        } else {
            queryOptions.where = { ...queryOptions.where, [Op.and]: parsedConditions };
        }
    }

    return queryOptions;
};

export const QueryProcessor = {
    buildQueryOptions,
    executeQuery,
    formatDateTimeFields
};
