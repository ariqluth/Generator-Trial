import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_reservation = sequelize.define('t_reservation', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    unit_bussiness_id: {
        type: DataTypes.UUID,
    },
    so_id: {
        type: DataTypes.UUID,
    },
    code: {
        type: DataTypes.STRING,
    },
    customer_id: {
        type: DataTypes.UUID,
    },
    sales_id: {
        type: DataTypes.UUID,
    },
    status: {
        type: DataTypes.INTEGER,
    },
    date: {
        type: DataTypes.DATEONLY,
    },
    ship_to_id: {
        type: DataTypes.UUID,
    },
    notes: {
        type: DataTypes.STRING,
    },
    unit_bussiness: {
        type: DataTypes.STRING,
    },
    customer_name: {
        type: DataTypes.STRING,
    },
    sales: {
        type: DataTypes.STRING,
    },
    ship_to_name: {
        type: DataTypes.STRING,
    },
    ship_to_address: {
        type: DataTypes.STRING,
    },
    created_by: {
        type: DataTypes.UUID,
    },
    updated_by: {
        type: DataTypes.UUID,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_reservation;
