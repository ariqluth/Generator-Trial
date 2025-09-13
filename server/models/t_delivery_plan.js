import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_delivery_plan = sequelize.define('t_delivery_plan', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    unit_bussiness_id: {
        type: DataTypes.UUID,
    },
    code: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    delivery_area_id: {
        type: DataTypes.UUID,
    },
    expedition_type_id: {
        type: DataTypes.UUID,
    },
    expedition_id: {
        type: DataTypes.UUID,
    },
    vehicle_id: {
        type: DataTypes.UUID,
    },
    driver: {
        type: DataTypes.STRING,
    },
    date: {
        type: DataTypes.DATEONLY,
    },
    status: {
        type: DataTypes.INTEGER,
        comment: "1: Draft 2: In Approval 3: Revision 4: Approved 9: Rejected",
        defaultValue: 1,
    },
    total: {
        type: DataTypes.DOUBLE,
    },
    weight: {
        type: DataTypes.DECIMAL,
    },
    notes: {
        type: DataTypes.STRING,
    },
    sj_used: {
        type: DataTypes.BOOLEAN,
        comment: "digunakan untuk menandakan bahwa delivery plan sudah digunakan di surat jalan",
        defaultValue: false,
    },
    unit_bussiness: {
        type: DataTypes.STRING,
    },
    delivery_area: {
        type: DataTypes.STRING,
    },
    expedition_type: {
        type: DataTypes.STRING,
    },
    expedition: {
        type: DataTypes.STRING,
    },
    vehicle: {
        type: DataTypes.STRING,
    },
    nopol: {
        type: DataTypes.STRING,
    },
    current_approval_level: {
        type: DataTypes.INTEGER,
    },
    revised_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    approval_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    approved_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    created_by: {
        type: DataTypes.UUID,
    },
    updated_by: {
        type: DataTypes.UUID,
    },
    request_approval_by: {
        type: DataTypes.UUID,
    },
    request_approval_at: {
        type: DataTypes.DATE,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_delivery_plan;
