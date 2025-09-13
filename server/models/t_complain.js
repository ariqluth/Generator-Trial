import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_complain = sequelize.define('t_complain', {
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
    customer_id: {
        type: DataTypes.UUID,
    },
    status: {
        type: DataTypes.INTEGER,
        comment: "1: Need Action 4: Approved 9: Rejected",
        defaultValue: 1,
    },
    date: {
        type: DataTypes.DATEONLY,
    },
    ref_type: {
        type: DataTypes.ENUM('si', 'sj'),
    },
    unit_bussiness: {
        type: DataTypes.STRING,
    },
    customer: {
        type: DataTypes.STRING,
    },
    sales: {
        type: DataTypes.STRING,
    },
    reason: {
        type: DataTypes.STRING,
    },
    complain_type_id: {
        type: DataTypes.UUID,
    },
    complain_type: {
        type: DataTypes.STRING,
    },
    sales_id: {
        type: DataTypes.UUID,
    },
    sj_id: {
        type: DataTypes.UUID,
    },
    notes: {
        type: DataTypes.STRING,
    },
    current_approval_level: {
        type: DataTypes.INTEGER,
    },
    approval_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    approved_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    si_id: {
        type: DataTypes.UUID,
    },
    request_approval_by: {
        type: DataTypes.UUID,
    },
    request_approval_at: {
        type: DataTypes.DATE,
    },
    created_by: {
        type: DataTypes.UUID,
    },
    updated_by: {
        type: DataTypes.UUID,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_complain;
