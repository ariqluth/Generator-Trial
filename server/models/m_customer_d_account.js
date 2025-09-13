import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_customer_d_account = sequelize.define('m_customer_d_account', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    bank_id: {
        type: DataTypes.UUID,
    },
    area_code: {
        type: DataTypes.STRING,
    },
    number: {
        type: DataTypes.STRING,
    },
    name: {
        type: DataTypes.STRING,
    },
    is_default: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    customer_id: {
        type: DataTypes.UUID,
    },
    prospect_id: {
        type: DataTypes.UUID,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_customer_d_account;
