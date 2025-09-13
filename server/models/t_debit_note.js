import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_debit_note = sequelize.define('t_debit_note', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    unit_bussiness_id: {
        type: DataTypes.UUID,
    },
    code: {
        type: DataTypes.STRING,
    },
    type_id: {
        type: DataTypes.UUID,
    },
    pi_id: {
        type: DataTypes.UUID,
    },
    si_id: {
        type: DataTypes.UUID,
    },
    total: {
        type: DataTypes.DOUBLE,
    },
    total_return: {
        type: DataTypes.DOUBLE,
    },
    balance_after_dn: {
        type: DataTypes.DOUBLE,
    },
    credit_coa_id: {
        type: DataTypes.UUID,
    },
    reason_id: {
        type: DataTypes.UUID,
    },
    notes: {
        type: DataTypes.STRING,
    },
    status: {
        type: DataTypes.ENUM('draft','posted'),
    },
    date: {
        type: DataTypes.DATE,
    },
    customer_id: {
        type: DataTypes.UUID,
    },
    balance: {
        type: DataTypes.DOUBLE,
    },
    total_payment: {
        type: DataTypes.DOUBLE,
    },
    debit_amount: {
        type: DataTypes.DOUBLE,
    },
    debit_coa_id: {
        type: DataTypes.UUID,
    },
    category_id: {
        type: DataTypes.UUID,
    },
    pic_id: {
        type: DataTypes.UUID,
    },
    pic_name: {
        type: DataTypes.STRING,
    },
    category_name: {
        type: DataTypes.STRING,
    },
    reason: {
        type: DataTypes.STRING,
    },
    customer_name: {
        type: DataTypes.STRING,
    },
    type_value: {
        type: DataTypes.STRING,
    },
    supplier_id: {
        type: DataTypes.UUID,
    },
    supplier_name: {
        type: DataTypes.STRING,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_debit_note;
