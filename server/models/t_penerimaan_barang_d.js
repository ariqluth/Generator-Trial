import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_penerimaan_barang_d = sequelize.define('t_penerimaan_barang_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    t_penerimaan_barang_id: {
        type: DataTypes.UUID,
    },
    purchase_order_id: {
        type: DataTypes.UUID,
    },
    purchase_order_d_id: {
        type: DataTypes.UUID,
    },
    item_id: {
        type: DataTypes.UUID,
    },
    qty_received: {
        type: DataTypes.INTEGER,
    },
    qty_receipt: {
        type: DataTypes.INTEGER,
    },
    notes: {
        type: DataTypes.TEXT,
    },
    item_uom_id: {
        type: DataTypes.UUID,
    },
    item_uom: {
        type: DataTypes.STRING,
    },
    item_code: {
        type: DataTypes.STRING,
    },
    item_name: {
        type: DataTypes.STRING,
    },
    item_price: {
        type: DataTypes.BIGINT,
    },
    purchase_request_d_id: {
        type: DataTypes.UUID,
    },
    reference_supplier: {
        type: DataTypes.STRING,
    },
    qty_closing: {
        type: DataTypes.INTEGER,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_penerimaan_barang_d;
