import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_sales_quotation_d = sequelize.define('t_sales_quotation_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    sales_quotation_id: {
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
    subtotal: {
        type: DataTypes.DOUBLE,
    },
    notes: {
        type: DataTypes.STRING,
    },
    item_name: {
        type: DataTypes.STRING,
    },
    stock_on_hand: {
        type: DataTypes.DOUBLE,
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
    qty_snapshot: {
        type: DataTypes.INTEGER,
        comment: "snapshot qty saat approved",
        allowNull: false,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_sales_quotation_d;
