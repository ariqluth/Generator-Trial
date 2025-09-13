import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_sales_order_d = sequelize.define('t_sales_order_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    so_id: {
        type: DataTypes.UUID,
    },
    item_id: {
        type: DataTypes.UUID,
    },
    qty: {
        type: DataTypes.INTEGER,
    },
    uom_id: {
        type: DataTypes.UUID,
    },
    price: {
        type: DataTypes.DOUBLE,
    },
    disc1: {
        type: DataTypes.DOUBLE,
    },
    disc2: {
        type: DataTypes.DOUBLE,
    },
    disc_amt: {
        type: DataTypes.DOUBLE,
    },
    total_amt: {
        type: DataTypes.DOUBLE,
    },
    notes: {
        type: DataTypes.STRING,
    },
    disc1_percent: {
        type: DataTypes.DOUBLE,
    },
    disc2_percent: {
        type: DataTypes.DOUBLE,
    },
    subtotal: {
        type: DataTypes.DOUBLE,
    },
    total_disc: {
        type: DataTypes.DOUBLE,
    },
    uom_value: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
    },
    uom_unit: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "PCS",
    },
    item_name: {
        type: DataTypes.STRING,
    },
    amount: {
        type: DataTypes.DOUBLE,
    },
    qty_snapshot: {
        type: DataTypes.INTEGER,
        comment: "untuk menampilkan data qty reservation pada report summary",
        allowNull: false,
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
    qty_sq: {
        type: DataTypes.INTEGER,
        comment: "untuk menyimpan qty sq saat create",
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_sales_order_d;
