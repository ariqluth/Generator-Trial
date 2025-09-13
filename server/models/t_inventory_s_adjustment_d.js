import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_inventory_s_adjustment_d = sequelize.define('t_inventory_s_adjustment_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    item_code: {
        type: DataTypes.STRING,
    },
    item_name: {
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
    reason: {
        type: DataTypes.STRING,
    },
    notes: {
        type: DataTypes.STRING,
    },
    qty_before: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    qty_after: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    adjustment: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    t_inventory_s_adjustment_id: {
        type: DataTypes.UUID,
    },
    cost: {
        type: DataTypes.DOUBLE,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_inventory_s_adjustment_d;
