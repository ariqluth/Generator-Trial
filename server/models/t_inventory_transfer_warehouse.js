import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_inventory_transfer_warehouse = sequelize.define('t_inventory_transfer_warehouse', {
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
    warehouse_out: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    warehouse_in: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    date: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    note: {
        type: DataTypes.STRING,
    },
    tonnage: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    status: {
        type: DataTypes.STRING,
        comment: "DRAFT|POST",
        defaultValue: "DRAFT",
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_inventory_transfer_warehouse;
