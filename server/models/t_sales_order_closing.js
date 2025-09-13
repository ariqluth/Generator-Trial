import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_sales_order_closing = sequelize.define('t_sales_order_closing', {
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
    customer_id: {
        type: DataTypes.UUID,
    },
    status: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
    },
    reason_id: {
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

export default t_sales_order_closing;
