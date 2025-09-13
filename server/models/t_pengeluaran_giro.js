import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_pengeluaran_giro = sequelize.define('t_pengeluaran_giro', {
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
    supplier_d_account_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    bank_name: {
        type: DataTypes.STRING,
    },
    account_number: {
        type: DataTypes.STRING,
    },
    supplier_d_account_name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    delivery_date: {
        type: DataTypes.DATE,
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
    coa_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    giro_number: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    giro_amount: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    due_date: {
        type: DataTypes.DATE,
    },
    reference_number: {
        type: DataTypes.STRING,
    },
    posted_by: {
        type: DataTypes.UUID,
    },
    posted_at: {
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

export default t_pengeluaran_giro;
