import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_cash_receipt = sequelize.define('t_cash_receipt', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    code: {
        type: DataTypes.STRING,
    },
    cash_code: {
        type: DataTypes.STRING,
    },
    unit_bussiness_id: {
        type: DataTypes.UUID,
    },
    type_id: {
        type: DataTypes.UUID,
    },
    date: {
        type: DataTypes.DATE,
    },
    status: {
        type: DataTypes.ENUM('draft','posted'),
    },
    group_id: {
        type: DataTypes.UUID,
    },
    coa_id: {
        type: DataTypes.UUID,
    },
    customer_id: {
        type: DataTypes.UUID,
    },
    customer_name: {
        type: DataTypes.STRING,
    },
    ref_no: {
        type: DataTypes.STRING,
    },
    total: {
        type: DataTypes.DOUBLE,
    },
    notes: {
        type: DataTypes.STRING,
    },
    created_by: {
        type: DataTypes.UUID,
    },
    updated_by: {
        type: DataTypes.UUID,
    },
    employee_id: {
        type: DataTypes.UUID,
    },
    bank_id: {
        type: DataTypes.UUID,
    },
    bank_account: {
        type: DataTypes.STRING,
    },
    account_number: {
        type: DataTypes.STRING,
    },
    giro_number: {
        type: DataTypes.STRING,
    },
    giro_deadline: {
        type: DataTypes.DATE,
    },
    employee_name: {
        type: DataTypes.STRING,
    },
    si_id: {
        type: DataTypes.UUID,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_cash_receipt;
