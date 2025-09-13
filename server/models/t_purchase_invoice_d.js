import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_purchase_invoice_d = sequelize.define('t_purchase_invoice_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    t_purchase_invoice_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    item_receipt_d_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    notes: {
        type: DataTypes.TEXT,
    },
    discount_rate: {
        type: DataTypes.BIGINT,
    },
    discount_amt: {
        type: DataTypes.BIGINT,
    },
    ppn_rate: {
        type: DataTypes.INTEGER,
    },
    pph_rate: {
        type: DataTypes.INTEGER,
    },
    qty: {
        type: DataTypes.INTEGER,
    },
    item_id: {
        type: DataTypes.UUID,
    },
    item_name: {
        type: DataTypes.STRING,
    },
    item_code: {
        type: DataTypes.STRING,
    },
    discount_total: {
        type: DataTypes.BIGINT,
    },
    dpp: {
        type: DataTypes.BIGINT,
    },
    price: {
        type: DataTypes.BIGINT,
    },
    total: {
        type: DataTypes.BIGINT,
    },
    ppn_nominal: {
        type: DataTypes.BIGINT,
    },
    pph_nominal: {
        type: DataTypes.BIGINT,
    },
    item_uom_id: {
        type: DataTypes.UUID,
    },
    item_uom: {
        type: DataTypes.STRING,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_purchase_invoice_d;
