import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_gen = sequelize.define('m_gen', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    group: {
        type: DataTypes.STRING,
    },
    key1: {
        type: DataTypes.STRING,
    },
    code: {
        type: DataTypes.STRING,
    },
    value1: {
        type: DataTypes.STRING,
    },
    value2: {
        type: DataTypes.STRING,
    },
    value3: {
        type: DataTypes.STRING,
    },
    value4: {
        type: DataTypes.STRING,
    },
    value5: {
        type: DataTypes.STRING,
    },
    status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_gen;
