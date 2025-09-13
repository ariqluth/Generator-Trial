import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_inventory_transform_item = sequelize.define('t_inventory_transform_item', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    unit_bussiness_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    code: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    date: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    warehouse_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    notes: {
        type: DataTypes.TEXT,
    },
    item_id: {
        type: DataTypes.UUID,
    },
    item_name: {
        type: DataTypes.STRING,
    },
    item_uom_id: {
        type: DataTypes.UUID,
    },
    qty: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    tipe: {
        type: DataTypes.STRING,
        defaultValue: "REPACK",
    },
    submitted_by: {
        type: DataTypes.UUID,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_inventory_transform_item;
