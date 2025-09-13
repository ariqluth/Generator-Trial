import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_delivery_plan_d_item = sequelize.define('t_delivery_plan_d_item', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    delivery_plan_d_id: {
        type: DataTypes.UUID,
    },
    item_id: {
        type: DataTypes.UUID,
    },
    qty_so: {
        type: DataTypes.INTEGER,
    },
    qty_dp: {
        type: DataTypes.INTEGER,
    },
    uom_id: {
        type: DataTypes.UUID,
    },
    weight: {
        type: DataTypes.DOUBLE,
    },
    amount: {
        type: DataTypes.DOUBLE,
    },
    price: {
        type: DataTypes.DOUBLE,
    },
    item_name: {
        type: DataTypes.STRING,
    },
    alias: {
        type: DataTypes.STRING,
    },
    qty_so_snapshot: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
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
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_delivery_plan_d_item;
