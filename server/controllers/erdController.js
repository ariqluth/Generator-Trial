import { sequelize } from '../config/database.js';

const toUpper = (value) => {
  if (value == null) return '';
  return String(value).toUpperCase();
};

const formatDataType = (attribute) => {
  if (!attribute || !attribute.type) return 'UNKNOWN';
  const { type } = attribute;

  if (typeof type.toSql === 'function') {
    try {
      return toUpper(type.toSql());
    } catch (error) {
      // fall through to other strategies
    }
  }

  if (type.options && typeof type.options.length !== 'undefined') {
    return `${toUpper(type.key || type.constructor?.name)}(${type.options.length})`;
  }

  if (type.key) {
    return toUpper(type.key);
  }

  if (type.constructor && type.constructor.name) {
    return toUpper(type.constructor.name.replace(/datatype/i, ''));
  }

  return toUpper(String(type));
};

const normalizeDefaultValue = (value) => {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'function') return value.name || value.toString();
  if (typeof value === 'object') {
    if (typeof value.toSql === 'function') {
      try {
        return value.toSql();
      } catch (error) {
        return JSON.stringify(value);
      }
    }
    if ('val' in value) return value.val;
    return JSON.stringify(value);
  }
  return String(value);
};

const normalizeUnique = (unique) => {
  if (!unique) return null;
  if (unique === true) return true;
  if (typeof unique === 'string') return unique;
  if (Array.isArray(unique)) return unique.length ? unique.map(String) : true;
  if (typeof unique === 'object') return unique.name || true;
  return Boolean(unique);
};

const resolveModelName = (model) => {
  if (!model) return null;
  if (typeof model === 'string') return model;
  return (
    model.name ||
    model.options?.name?.singular ||
    model.options?.name?.plural ||
    model.tableName ||
    model.options?.tableName ||
    null
  );
};

const extractForeignKey = (association) => {
  if (!association) return null;
  if (typeof association.foreignKey === 'string') {
    return association.foreignKey;
  }
  if (association.foreignKey && typeof association.foreignKey === 'object') {
    return (
      association.foreignKey.name ||
      association.foreignKey.fieldName ||
      association.foreignKey.columnName ||
      null
    );
  }
  if (typeof association.identifier === 'string') return association.identifier;
  if (typeof association.identifierField === 'string') return association.identifierField;
  return null;
};

const extractTargetKey = (association) => {
  if (!association) return null;
  return (
    association.targetKey ||
    association.targetKeyField ||
    association.target?.primaryKeyAttribute ||
    association.target?.primaryKeyAttributes?.[0] ||
    null
  );
};

const formatReference = (references) => {
  if (!references) return null;
  const refModel = resolveModelName(references.model);
  const refKey = references.key || references.keyField || null;
  if (!refModel && !refKey) return null;
  return {
    model: refModel || null,
    key: refKey || null
  };
};

const formatField = (fieldName, attribute) => {
  return {
    name: fieldName,
    type: formatDataType(attribute),
    allowNull: attribute.allowNull !== false,
    primaryKey: Boolean(attribute.primaryKey),
    autoIncrement: Boolean(attribute.autoIncrement),
    unique: normalizeUnique(attribute.unique),
    defaultValue: normalizeDefaultValue(attribute.defaultValue),
    comment: attribute.comment || null,
    references: formatReference(attribute.references),
    fieldName: attribute.fieldName || fieldName
  };
};

const collectModels = () => {
  const registry = new Map();

  if (sequelize?.models) {
    Object.entries(sequelize.models).forEach(([name, model]) => {
      if (!registry.has(name)) registry.set(name, model);
    });
  }

  if (global?.models) {
    Object.entries(global.models).forEach(([name, model]) => {
      if (!registry.has(name)) registry.set(name, model);
    });
  }

  return registry;
};

export const getGraph = async (req, res) => {
  try {
    const modelsRegistry = collectModels();
    const modelsPayload = {};
    const associationsPayload = {};

    modelsRegistry.forEach((model, modelName) => {
      const rawAttributes = model?.rawAttributes || {};
      modelsPayload[modelName] = Object.entries(rawAttributes).map(([fieldName, attribute]) =>
        formatField(fieldName, attribute)
      );

      const assocMap = {};
      const associations = model?.associations || {};

      Object.entries(associations).forEach(([associationName, association]) => {
        const foreignKey = extractForeignKey(association);
        const targetName = resolveModelName(association.target);
        if (!foreignKey || !targetName) return;

        assocMap[foreignKey] = {
          model: targetName,
          field: extractTargetKey(association),
          type: String(association.associationType || '').toLowerCase(),
          alias: association.as || associationName,
          through: association.throughModel ? resolveModelName(association.throughModel) : null
        };
      });

      if (Object.keys(assocMap).length) {
        associationsPayload[modelName] = assocMap;
      }
    });

    res.json({
      success: true,
      models: modelsPayload,
      associations: associationsPayload
    });
  } catch (error) {
    console.error('ERD graph builder error:', error);
    res.status(500).json({
      success: false,
      message: error?.message || 'Failed to build ERD graph.'
    });
  }
};
