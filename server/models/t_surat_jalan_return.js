import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_surat_jalan_return = sequelize.define('t_surat_jalan_return', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    sj_id: {
        type: DataTypes.UUID,
    },
    unit_bussiness_id: {
        type: DataTypes.UUID,
    },
    date: {
        type: DataTypes.DATEONLY,
    },
    code: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    status: {
        type: DataTypes.INTEGER,
        comment: "1: Draft 2: Posted",
        defaultValue: 1,
    },
    unit_bussiness: {
        type: DataTypes.STRING,
    },
    customer_name: {
        type: DataTypes.STRING,
    },
    delivery_area: {
        type: DataTypes.STRING,
    },
    expedition_type: {
        type: DataTypes.STRING,
    },
    nopol: {
        type: DataTypes.STRING,
    },
    expedition: {
        type: DataTypes.STRING,
    },
    vehicle: {
        type: DataTypes.STRING,
    },
    driver: {
        type: DataTypes.STRING,
    },
    customer_id: {
        type: DataTypes.UUID,
    },
    notes: {
        type: DataTypes.TEXT,
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

export default t_surat_jalan_return;
