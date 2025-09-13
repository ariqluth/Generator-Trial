import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_ganti_giro_keluar = sequelize.define('t_ganti_giro_keluar', {
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
    reason: {
        type: DataTypes.STRING,
    },
    old_giro_out_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    old_giro_out_code: {
        type: DataTypes.STRING,
    },
    bank_name: {
        type: DataTypes.STRING,
    },
    account_number: {
        type: DataTypes.STRING,
    },
    old_giro_out_amount: {
        type: DataTypes.BIGINT,
    },
    disbursement_date: {
        type: DataTypes.DATE,
    },
    old_reference_code: {
        type: DataTypes.STRING,
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
        allowNull: false,
    },
    supplier_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    supplier_name: {
        type: DataTypes.STRING,
    },
    old_giro_number: {
        type: DataTypes.STRING,
    },
    old_giro_out_name: {
        type: DataTypes.STRING,
    },
    old_delivery_date: {
        type: DataTypes.DATE,
    },
    old_due_date: {
        type: DataTypes.DATE,
    },
    new_giro_number: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    replacement_type: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    coa_id: {
        type: DataTypes.UUID,
    },
    total_snapshot: {
        type: DataTypes.BIGINT,
    },
    postedBy: {
        type: DataTypes.UUID,
    },
    postedAt: {
        type: DataTypes.DATE,
    },
    createdBy: {
        type: DataTypes.UUID,
    },
    updatedBy: {
        type: DataTypes.UUID,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_ganti_giro_keluar;
