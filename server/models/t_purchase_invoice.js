import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_purchase_invoice = sequelize.define('t_purchase_invoice', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    code: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    item_type_id: {
        type: DataTypes.UUID,
    },
    item_receipt_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    currency_id: {
        type: DataTypes.UUID,
    },
    supplier_id: {
        type: DataTypes.UUID,
    },
    top_supplier_id: {
        type: DataTypes.UUID,
    },
    due_date: {
        type: DataTypes.DATE,
    },
    tax_type_id: {
        type: DataTypes.UUID,
    },
    dp_code: {
        type: DataTypes.STRING,
    },
    facture_supplier: {
        type: DataTypes.STRING,
    },
    notes: {
        type: DataTypes.TEXT,
    },
    status: {
        type: DataTypes.STRING,
    },
    date: {
        type: DataTypes.DATE,
    },
    facture_tax: {
        type: DataTypes.STRING,
    },
    dp: {
        type: DataTypes.BIGINT,
    },
    dp_used: {
        type: DataTypes.BIGINT,
    },
    dp_used_previous: {
        type: DataTypes.BIGINT,
    },
    item_type: {
        type: DataTypes.STRING,
    },
    item_receipt_code: {
        type: DataTypes.STRING,
    },
    currency: {
        type: DataTypes.STRING,
    },
    supplier_name: {
        type: DataTypes.STRING,
    },
    top_supplier: {
        type: DataTypes.STRING,
    },
    tax_type: {
        type: DataTypes.STRING,
    },
    purchase_order_id: {
        type: DataTypes.UUID,
    },
    purchase_order_code: {
        type: DataTypes.STRING,
    },
    unit_bussiness_id: {
        type: DataTypes.UUID,
    },
    unit_bussiness_name: {
        type: DataTypes.STRING,
    },
    total: {
        type: DataTypes.BIGINT,
    },
    grand_total: {
        type: DataTypes.BIGINT,
    },
    total_dpp: {
        type: DataTypes.BIGINT,
    },
    selling_price: {
        type: DataTypes.BIGINT,
    },
    ppn_nominal: {
        type: DataTypes.BIGINT,
    },
    pph_nominal: {
        type: DataTypes.BIGINT,
    },
    total_discount: {
        type: DataTypes.BIGINT,
    },
    posted_at: {
        type: DataTypes.DATE,
    },
    posted_by: {
        type: DataTypes.UUID,
    },
    createdBy: {
        type: DataTypes.UUID,
    },
    updatedBy: {
        type: DataTypes.UUID,
    },
    grand_total_snapshot: {
        type: DataTypes.BIGINT,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_purchase_invoice;
