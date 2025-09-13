import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_jadwal_pembayaran_d = sequelize.define('t_jadwal_pembayaran_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    t_jadwal_pembayaran_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    purchase_invoice_id: {
        type: DataTypes.UUID,
    },
    purchase_invoice_code: {
        type: DataTypes.STRING,
    },
    penerimaan_barang_id: {
        type: DataTypes.UUID,
    },
    penerimaan_barang_code: {
        type: DataTypes.STRING,
    },
    supplier_id: {
        type: DataTypes.UUID,
    },
    supplier_name: {
        type: DataTypes.STRING,
    },
    due_date: {
        type: DataTypes.DATE,
    },
    pi_notes: {
        type: DataTypes.TEXT,
    },
    pi_amount: {
        type: DataTypes.BIGINT,
    },
    payment_amount: {
        type: DataTypes.BIGINT,
    },
    realization_date: {
        type: DataTypes.DATE,
    },
    detail_notes: {
        type: DataTypes.TEXT,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_jadwal_pembayaran_d;
