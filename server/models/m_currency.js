import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_currency = sequelize.define('m_currency', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    code: {
        type: DataTypes.STRING,
    },
    name: {
        type: DataTypes.STRING,
    },
    simbol: {
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

export default m_currency;
