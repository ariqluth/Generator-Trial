import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_credit_note = sequelize.define('t_credit_note', {
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
    balance_after_cn: {
        type: DataTypes.DOUBLE,
    },
    credit_coa_id: {
        type: DataTypes.UUID,
    },
    debit_coa_id: {
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
    supplier_id: {
        type: DataTypes.UUID,
    },
    supplier_name: {
        type: DataTypes.STRING,
    },
    balance: {
        type: DataTypes.DOUBLE,
    },
    total_payment: {
        type: DataTypes.DOUBLE,
    },
    credit_amount: {
        type: DataTypes.DOUBLE,
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
    type_value: {
        type: DataTypes.STRING,
    },
    customer_id: {
        type: DataTypes.UUID,
    },
    customer_name: {
        type: DataTypes.STRING,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_credit_note;
