import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_purchase_order_closing_d = sequelize.define('t_purchase_order_closing_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    purchase_order_closing_id: {
        type: DataTypes.UUID,
    },
    purchase_request_d_id: {
        type: DataTypes.UUID,
    },
    item_id: {
        type: DataTypes.UUID,
    },
    qty: {
        type: DataTypes.INTEGER,
    },
    notes: {
        type: DataTypes.TEXT,
    },
    qty_accepted: {
        type: DataTypes.INTEGER,
    },
    qty_po: {
        type: DataTypes.INTEGER,
    },
    purchase_order_d_id: {
        type: DataTypes.UUID,
    },
    item_name: {
        type: DataTypes.STRING,
    },
    item_code: {
        type: DataTypes.STRING,
    },
    unit: {
        type: DataTypes.STRING,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_purchase_order_closing_d;
