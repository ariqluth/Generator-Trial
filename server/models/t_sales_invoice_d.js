import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_sales_invoice_d = sequelize.define('t_sales_invoice_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    sales_invoice_id: {
        type: DataTypes.UUID,
    },
    so_id: {
        type: DataTypes.UUID,
    },
    item_id: {
        type: DataTypes.UUID,
    },
    item_name: {
        type: DataTypes.STRING,
    },
    qty_sj: {
        type: DataTypes.INTEGER,
    },
    qty_return: {
        type: DataTypes.INTEGER,
    },
    qty_inv: {
        type: DataTypes.INTEGER,
    },
    uom_unit: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "PCS",
    },
    uom_value: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
    },
    price: {
        type: DataTypes.DOUBLE,
    },
    amount: {
        type: DataTypes.DOUBLE,
    },
    disc1: {
        type: DataTypes.DOUBLE,
    },
    disc1_percent: {
        type: DataTypes.DOUBLE,
    },
    disc2: {
        type: DataTypes.DOUBLE,
    },
    disc2_percent: {
        type: DataTypes.DOUBLE,
    },
    disc_amt: {
        type: DataTypes.DOUBLE,
    },
    total_disc: {
        type: DataTypes.DOUBLE,
    },
    total_amt: {
        type: DataTypes.DOUBLE,
    },
    notes: {
        type: DataTypes.STRING,
    },
    uom_id: {
        type: DataTypes.UUID,
    },
    dpp: {
        type: DataTypes.DOUBLE,
    },
    dpp2: {
        type: DataTypes.DOUBLE,
    },
    total_tax: {
        type: DataTypes.DOUBLE,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_sales_invoice_d;
