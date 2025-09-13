import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_purchase_request = sequelize.define('t_purchase_request', {
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
        unique: true,
    },
    division_id: {
        type: DataTypes.UUID,
    },
    notes: {
        type: DataTypes.TEXT,
    },
    revision_reason: {
        type: DataTypes.TEXT,
    },
    reject_reason: {
        type: DataTypes.TEXT,
    },
    item_type_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: "DRAFT",
    },
    date: {
        type: DataTypes.DATE,
    },
    date_required: {
        type: DataTypes.DATE,
    },
    date_expired: {
        type: DataTypes.DATE,
    },
    current_approval_level: {
        type: DataTypes.INTEGER,
    },
    revised_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    approval_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    approved_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    unit_bussiness_name: {
        type: DataTypes.STRING,
    },
    division: {
        type: DataTypes.STRING,
    },
    item_type: {
        type: DataTypes.STRING,
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

export default t_purchase_request;
