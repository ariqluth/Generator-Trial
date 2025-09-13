import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_surat_jalan = sequelize.define('t_surat_jalan', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    delivery_plan_id: {
        type: DataTypes.UUID,
    },
    date: {
        type: DataTypes.DATEONLY,
    },
    status: {
        type: DataTypes.INTEGER,
        comment: "1: Draft 2 Posted",
        defaultValue: 1,
    },
    unit_bussiness_id: {
        type: DataTypes.UUID,
    },
    code: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    print_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    customer_id: {
        type: DataTypes.UUID,
    },
    top_id: {
        type: DataTypes.UUID,
    },
    ship_to: {
        type: DataTypes.STRING,
    },
    npwp: {
        type: DataTypes.STRING,
    },
    so_id: {
        type: DataTypes.UUID,
    },
    unit_bussiness: {
        type: DataTypes.STRING,
    },
    customer: {
        type: DataTypes.STRING,
    },
    delivery_area: {
        type: DataTypes.STRING,
    },
    vehicle: {
        type: DataTypes.STRING,
    },
    nopol: {
        type: DataTypes.STRING,
    },
    expedition_type: {
        type: DataTypes.STRING,
    },
    notes: {
        type: DataTypes.STRING,
    },
    si_used: {
        type: DataTypes.BOOLEAN,
        comment: "digunakan untuk menandakan bahwa sudah digunakan pada sales invoice",
        defaultValue: false,
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

export default t_surat_jalan;
