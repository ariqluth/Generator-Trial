import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_purchase_request_closing_d = sequelize.define('t_purchase_request_closing_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    purchase_request_closing_id: {
        type: DataTypes.UUID,
    },
    purchase_request_d_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    item_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    notes: {
        type: DataTypes.TEXT,
    },
    qty_pr: {
        type: DataTypes.DOUBLE,
        allowNull: false,
    },
    qty_po: {
        type: DataTypes.DOUBLE,
        allowNull: false,
    },
    qty_closing: {
        type: DataTypes.DOUBLE,
        allowNull: false,
    },
    item_uom_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    item_code: {
        type: DataTypes.STRING,
    },
    item_name: {
        type: DataTypes.STRING,
    },
    item_uom: {
        type: DataTypes.STRING,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_purchase_request_closing_d;
