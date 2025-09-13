import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_outgoing_giro_realization = sequelize.define('t_outgoing_giro_realization', {
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
    outgoing_giro_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    outgoing_giro_code: {
        type: DataTypes.STRING,
    },
    giro_number: {
        type: DataTypes.STRING,
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
    supplier_d_account_id: {
        type: DataTypes.UUID,
    },
    supplier_d_account_name: {
        type: DataTypes.STRING,
    },
    bank_name: {
        type: DataTypes.STRING,
    },
    account_number: {
        type: DataTypes.STRING,
    },
    giro_amount: {
        type: DataTypes.BIGINT,
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
    status: {
        type: DataTypes.STRING,
    },
    current_approval_level: {
        type: DataTypes.INTEGER,
    },
    approval_count: {
        type: DataTypes.INTEGER,
    },
    revised_count: {
        type: DataTypes.INTEGER,
    },
    approved_count: {
        type: DataTypes.INTEGER,
    },
    submitted_by: {
        type: DataTypes.UUID,
    },
    submitted_at: {
        type: DataTypes.DATE,
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

export default t_outgoing_giro_realization;
