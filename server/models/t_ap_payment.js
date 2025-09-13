import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_ap_payment = sequelize.define('t_ap_payment', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    unit_bussiness_id: {
        type: DataTypes.UUID,
    },
    unit_bussiness_name: {
        type: DataTypes.STRING,
    },
    code: {
        type: DataTypes.STRING,
    },
    cash_code: {
        type: DataTypes.STRING,
    },
    supplier_id: {
        type: DataTypes.UUID,
    },
    supplier_name: {
        type: DataTypes.STRING,
    },
    account_type_id: {
        type: DataTypes.UUID,
    },
    account_type_name: {
        type: DataTypes.STRING,
    },
    coa_id: {
        type: DataTypes.UUID,
    },
    coa_name: {
        type: DataTypes.STRING,
    },
    status: {
        type: DataTypes.STRING,
        comment: "DRAFT/POSTED",
        defaultValue: "DRAFT",
    },
    date: {
        type: DataTypes.DATE,
    },
    total_pi: {
        type: DataTypes.BIGINT,
    },
    total_paid: {
        type: DataTypes.BIGINT,
    },
    difference: {
        type: DataTypes.BIGINT,
    },
    notes: {
        type: DataTypes.TEXT,
    },
    posted_at: {
        type: DataTypes.DATE,
    },
    posted_by: {
        type: DataTypes.UUID,
    },
    createdBy: {
        type: DataTypes.UUID,
    },
    updatedBy: {
        type: DataTypes.UUID,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_ap_payment;
