import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_delivery_plan_d = sequelize.define('t_delivery_plan_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    delivery_plan_id: {
        type: DataTypes.UUID,
    },
    so_id: {
        type: DataTypes.UUID,
    },
    customer_id: {
        type: DataTypes.UUID,
    },
    item_qty: {
        type: DataTypes.INTEGER,
    },
    total_weight: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    total_amount: {
        type: DataTypes.DOUBLE,
        defaultValue: 0,
    },
    ship_to_name: {
        type: DataTypes.STRING,
    },
    npwp: {
        type: DataTypes.STRING,
    },
    ship_to_address: {
        type: DataTypes.STRING,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_delivery_plan_d;
