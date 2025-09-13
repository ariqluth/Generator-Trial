import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_reservation_d = sequelize.define('t_reservation_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    reservation_id: {
        type: DataTypes.UUID,
    },
    item_id: {
        type: DataTypes.UUID,
    },
    so_qty: {
        type: DataTypes.INTEGER,
    },
    uom_id: {
        type: DataTypes.UUID,
    },
    free_stock: {
        type: DataTypes.INTEGER,
    },
    stock_booking: {
        type: DataTypes.INTEGER,
    },
    status: {
        type: DataTypes.INTEGER,
    },
    item_name: {
        type: DataTypes.STRING,
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
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_reservation_d;
