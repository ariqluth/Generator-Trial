import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_visit_realization = sequelize.define('t_visit_realization', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    unit_bussiness_id: {
        type: DataTypes.UUID,
    },
    customer_id: {
        type: DataTypes.UUID,
    },
    plan_date: {
        type: DataTypes.DATEONLY,
    },
    visit_date: {
        type: DataTypes.DATEONLY,
    },
    start_at: {
        type: DataTypes.TIME,
    },
    end_at: {
        type: DataTypes.TIME,
    },
    duration: {
        type: DataTypes.TIME,
    },
    ref_no: {
        type: DataTypes.UUID,
    },
    status: {
        type: DataTypes.ENUM('undone','done-planned','done-unplanned'),
        defaultValue: "undone",
    },
    unit_bussiness: {
        type: DataTypes.STRING,
    },
    customer_name: {
        type: DataTypes.STRING,
    },
    notes: {
        type: DataTypes.STRING,
    },
    created_by: {
        type: DataTypes.UUID,
    },
    updated_by: {
        type: DataTypes.UUID,
    },
    sales_id: {
        type: DataTypes.UUID,
    },
    sales: {
        type: DataTypes.STRING,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_visit_realization;
