import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_inventory_reservations = sequelize.define('t_inventory_reservations', {
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
    reference_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    reference_source: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    quantity: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_inventory_reservations;
