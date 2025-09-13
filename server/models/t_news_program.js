import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_news_program = sequelize.define('t_news_program', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    code: {
        type: DataTypes.STRING,
    },
    purchase_order_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    reason_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    status: {
        type: DataTypes.STRING,
    },
    date: {
        type: DataTypes.DATE,
    },
    notes: {
        type: DataTypes.TEXT,
    },
    revised_count: {
        type: DataTypes.INTEGER,
    },
    approval_count: {
        type: DataTypes.INTEGER,
    },
    approved_count: {
        type: DataTypes.INTEGER,
    },
    current_approval_level: {
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
    reason: {
        type: DataTypes.STRING,
    },
    purchase_order_code: {
        type: DataTypes.STRING,
    },
    supplier_id: {
        type: DataTypes.UUID,
    },
    supplier_name: {
        type: DataTypes.STRING,
    },
    unit_bussiness_id: {
        type: DataTypes.UUID,
    },
    unit_bussiness_name: {
        type: DataTypes.STRING,
    },
    revision_reason: {
        type: DataTypes.TEXT,
    },
    reject_reason: {
        type: DataTypes.TEXT,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_news_program;
