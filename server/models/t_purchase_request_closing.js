import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_purchase_request_closing = sequelize.define('t_purchase_request_closing', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    unit_bussiness_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    item_type_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    purchase_request_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    status: {
        type: DataTypes.STRING,
    },
    purchase_closing_reason_id: {
        type: DataTypes.UUID,
    },
    notes: {
        type: DataTypes.TEXT,
    },
    unit_bussiness_name: {
        type: DataTypes.STRING,
    },
    item_type: {
        type: DataTypes.STRING,
    },
    purchase_closing_reason: {
        type: DataTypes.STRING,
    },
    purchase_request_code: {
        type: DataTypes.STRING,
    },
    created_by_name: {
        type: DataTypes.STRING,
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

export default t_purchase_request_closing;
