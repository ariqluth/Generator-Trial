import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_sales_order_closing_d = sequelize.define('t_sales_order_closing_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    so_closing_id: {
        type: DataTypes.UUID,
    },
    item_id: {
        type: DataTypes.UUID,
    },
    qty_so: {
        type: DataTypes.INTEGER,
    },
    qty_sj: {
        type: DataTypes.INTEGER,
    },
    qty_os: {
        type: DataTypes.INTEGER,
    },
    qty_closing: {
        type: DataTypes.INTEGER,
    },
    uom_unit: {
        type: DataTypes.STRING,
    },
    notes: {
        type: DataTypes.STRING,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_sales_order_closing_d;
