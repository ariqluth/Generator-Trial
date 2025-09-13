import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_supplier_d_account = sequelize.define('m_supplier_d_account', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    supplier_id: {
        type: DataTypes.UUID,
    },
    bank_id: {
        type: DataTypes.UUID,
    },
    number: {
        type: DataTypes.STRING,
    },
    name: {
        type: DataTypes.STRING,
    },
    notes: {
        type: DataTypes.TEXT,
    },
    is_default: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_supplier_d_account;
