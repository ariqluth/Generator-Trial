import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_visit_sales_d = sequelize.define('t_visit_sales_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    visit_sales_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    customer_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    date: {
        type: DataTypes.DATEONLY,
    },
    notes: {
        type: DataTypes.TEXT,
    },
    customer_name: {
        type: DataTypes.STRING,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_visit_sales_d;
