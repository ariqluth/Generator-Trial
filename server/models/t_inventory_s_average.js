import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_inventory_s_average = sequelize.define('t_inventory_s_average', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    item_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    warehouse_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    on_hand_quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    average_cost: {
        type: DataTypes.DOUBLE,
        allowNull: false,
    },
    last_updated_at: {
        type: DataTypes.BIGINT,
        defaultValue: 0,
    },
    last_on_hand_quantity: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    last_average_cost: {
        type: DataTypes.DOUBLE,
        defaultValue: 0,
    },
    reserved_quantity: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_inventory_s_average;
