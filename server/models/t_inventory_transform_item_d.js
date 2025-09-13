import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_inventory_transform_item_d = sequelize.define('t_inventory_transform_item_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    t_inventory_transform_item_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    item_code: {
        type: DataTypes.STRING,
    },
    item_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    item_uom_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    qty: {
        type: DataTypes.INTEGER,
    },
    price: {
        type: DataTypes.INTEGER,
    },
    stock_on_hand: {
        type: DataTypes.INTEGER,
    },
    note: {
        type: DataTypes.TEXT,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_inventory_transform_item_d;
