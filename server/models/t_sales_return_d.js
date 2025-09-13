import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_sales_return_d = sequelize.define('t_sales_return_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    sales_return_id: {
        type: DataTypes.UUID,
    },
    so_id: {
        type: DataTypes.UUID,
    },
    date: {
        type: DataTypes.DATEONLY,
    },
    item_id: {
        type: DataTypes.UUID,
    },
    item_name: {
        type: DataTypes.STRING,
    },
    reason_id: {
        type: DataTypes.UUID,
    },
    qty_si: {
        type: DataTypes.INTEGER,
    },
    qty_sj: {
        type: DataTypes.INTEGER,
    },
    qty_return: {
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
    dpp: {
        type: DataTypes.DOUBLE,
    },
    dpp2: {
        type: DataTypes.DOUBLE,
    },
    total_tax: {
        type: DataTypes.DOUBLE,
    },
    total: {
        type: DataTypes.DOUBLE,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_sales_return_d;
