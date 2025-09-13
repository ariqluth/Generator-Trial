import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_jadwal_pembayaran = sequelize.define('t_jadwal_pembayaran', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    unit_business_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    unit_business_name: {
        type: DataTypes.STRING,
    },
    code: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    supplier_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    supplier_name: {
        type: DataTypes.STRING,
    },
    total_pi: {
        type: DataTypes.BIGINT,
    },
    notes: {
        type: DataTypes.TEXT,
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    date: {
        type: DataTypes.DATE,
    },
    payment_date: {
        type: DataTypes.DATE,
    },
    total_payment: {
        type: DataTypes.BIGINT,
    },
    submitted_by: {
        type: DataTypes.UUID,
    },
    submitted_at: {
        type: DataTypes.DATE,
    },
    current_approval_level: {
        type: DataTypes.INTEGER,
    },
    approval_count: {
        type: DataTypes.INTEGER,
    },
    revised_count: {
        type: DataTypes.INTEGER,
    },
    approved_count: {
        type: DataTypes.INTEGER,
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

export default t_jadwal_pembayaran;
