import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_visit_sales = sequelize.define('t_visit_sales', {
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
    status: {
        type: DataTypes.INTEGER,
        comment: "1: Draft 2: Posted",
    },
    date: {
        type: DataTypes.DATEONLY,
    },
    notes: {
        type: DataTypes.TEXT,
    },
    code: {
        type: DataTypes.STRING,
    },
    unit_bussiness: {
        type: DataTypes.STRING,
    },
    sales: {
        type: DataTypes.STRING,
    },
    id_sales: {
        type: DataTypes.UUID,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_visit_sales;
