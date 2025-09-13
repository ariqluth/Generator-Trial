import { user as user_default } from '../models/index.js';
import { sequelize } from '../config/database.js';
import { Op } from 'sequelize';

// Helper to process query params (acuan dari m_inventory_meterController)
const processQueryParams = (params) => {
    const queryOptions = {
        where: {},
        attributes: undefined,
        include: [],
        order: [],
        group: undefined,
        limit: parseInt(params.paginate, 10) || 10,
        offset: ((parseInt(params.page, 10) || 1) - 1) * (parseInt(params.paginate, 10) || 10)
    };

    if (params.include) {
        const includes = params.include.split(',');
        includes.forEach(include => {
            if (include === 'm_role') {
                queryOptions.include.push({ model: m_role });
            }
        });
    }

    if (params.selectfield) {
        queryOptions.attributes = params.selectfield.split(',');
    }

    if (params.addselect) {
        const additionalFields = params.addselect.split(',');
        queryOptions.attributes = [...(queryOptions.attributes || []), ...additionalFields];
    }

    if (params.search && params.searchfield) {
        const searchFields = params.searchfield.split(',');
        const searchConditions = searchFields.map(field => ({
            [field]: { [Op.iLike]: `%${params.search}%` }
        }));
        queryOptions.where[Op.or] = searchConditions;
    }

    Object.keys(params).forEach(key => {
        if (key.startsWith('filter_column_')) {
            const column = key.replace('filter_column_', '');
            const operator = params[`filter_operator_${column}`] || '~*';
            const opMap = {
                '~*': Op.iLike,
                '=': Op.eq,
                '>': Op.gt,
                '<': Op.lt,
                '>=': Op.gte,
                '<=': Op.lte,
                '<>': Op.ne
            };
            queryOptions.where[column] = { [opMap[operator] || Op.iLike]: params[key] };
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

    if (params.group_by) {
        queryOptions.group = params.group_by.split(',');
    }

    if (params.where) {
        queryOptions.where = {
            ...queryOptions.where,
            [Op.and]: sequelize.literal(params.where)
        };
    }

    return queryOptions;
};

export const getAll = async (req, res) => {
    try {
        const queryOptions = processQueryParams(req.query);
        const { count, rows } = await user_default.findAndCountAll(queryOptions);
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.paginate, 10) || 10;
        const totalPages = Math.ceil(count / limit);
        res.status(200).json({
            status: 'success',
            data: rows,
            pagination: {
                total: count,
                page,
                totalPages,
                limit,
                currentRowsCount: rows.length,
                next_page: page < totalPages ? page + 1 : null,
                prev_page: page > 1 ? page - 1 : null
            }
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

export const getById = async (req, res) => {
    try {
        const queryOptions = processQueryParams(req.query);
        queryOptions.where = { ...queryOptions.where, id: req.params.id };
        const user = await user_default.findOne(queryOptions);
        if (!user) return res.status(404).json({ status: 'error', message: 'Not found' });
        res.status(200).json({ status: 'success', data: user });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

export const create = async (req, res) => {
    let transaction;
    try {
        transaction = await sequelize.transaction();
        const { ...mainData } = req.body;
        const user = await user_default.create(mainData, { transaction });
        await transaction.commit();
        transaction = null;
        const result = await user_default.findByPk(user.id);
        res.status(201).json({
            status: 'success',
            data: result,
            message: 'Created successfully'
        });
    } catch (error) {
        if (transaction) await transaction.rollback();
        res.status(500).json({ status: 'error', message: error.message, detail: 'Transaction failed' });
    }
};

export const update = async (req, res) => {
    res.status(500).json({ status: 'error', message: error.message });
};

export const remove = async (req, res) => {
    try {
        const user = await user_default.findByPk(req.params.id);
        if (!user) return res.status(404).json({ status: 'error', message: 'Not found' });
        await user.destroy();
        res.status(204).json({ status: 'success' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

export const user_defaultController = {
    async update(req, res) {
        const { user_detail } = req.models;
        let transaction;
        try {
            transaction = await sequelize.transaction();

            const { id } = req.params;
            const {
                nik,
                name,
                username,
                password,
                desc,
                f_user_type,
                status,
                user_details = [],
            } = req.body;

            const existingUser = await user_default.findByPk(id);
            if (!existingUser) {
                return res.status(404).json({ message: 'User not found' });
            }

            const updatedData = {
                nik,
                name,
                username,
                desc,
                f_user_type,
                status,
            };

            if (password && password.trim() !== '') {
                const bcrypt = await import('bcrypt');
                const saltRounds = 10;
                const hashedPassword = await bcrypt.default.hash(password, saltRounds);
                updatedData.password = hashedPassword;
            }

            await existingUser.update(updatedData, { transaction });

            await user_detail.destroy({
                where: { f_user_default: id },
                transaction,
            });

            for (const detail of user_details) {
                await user_detail.create(
                    {
                        ...detail,
                        f_user_default: id,
                    },
                    { transaction }
                );
            }

            await transaction.commit();
            transaction = null;

            const result = await user_default.findByPk(id);
            res.status(201).json({
                status: 'success',
                data: result,
                message: 'Updated successfully'
            });
        } catch (error) {
            if (transaction) await transaction.rollback();
            res.status(500).json({ status: 'error', message: error.message });
        }
    }
}
