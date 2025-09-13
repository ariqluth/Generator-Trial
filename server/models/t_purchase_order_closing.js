import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_purchase_order_closing = sequelize.define('t_purchase_order_closing', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    purchase_order_id: {
        type: DataTypes.UUID,
    },
    item_type_id: {
        type: DataTypes.UUID,
    },
    reason: {
        type: DataTypes.STRING,
    },
    reason_id: {
        type: DataTypes.UUID,
    },
    notes: {
        type: DataTypes.TEXT,
    },
    status: {
        type: DataTypes.STRING,
    },
    purchase_order_code: {
        type: DataTypes.STRING,
    },
    item_type: {
        type: DataTypes.STRING,
    },
    unit_bussiness: {
        type: DataTypes.STRING,
    },
    ship_unit_bussiness: {
        type: DataTypes.STRING,
    },
    po_date: {
        type: DataTypes.DATE,
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

export default t_purchase_order_closing;
