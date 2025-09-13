import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_purchase_return = sequelize.define('t_purchase_return', {
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
    item_receipt_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    purchase_invoice_id: {
        type: DataTypes.UUID,
    },
    kind_return_id: {
        type: DataTypes.UUID,
    },
    kind_return: {
        type: DataTypes.STRING,
        comment: "retur_sj/purchase_invoice",
    },
    return_option_id: {
        type: DataTypes.UUID,
        allowNull: false,
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
    submitted_by: {
        type: DataTypes.UUID,
    },
    submitted_at: {
        type: DataTypes.DATE,
    },
    createdBy: {
        type: DataTypes.UUID,
    },
    updatedBy: {
        type: DataTypes.UUID,
    },
    revision_reason: {
        type: DataTypes.TEXT,
    },
    reject_reason: {
        type: DataTypes.TEXT,
    },
    total: {
        type: DataTypes.BIGINT,
    },
    kind_return_label: {
        type: DataTypes.STRING,
    },
    unit_bussiness_id: {
        type: DataTypes.UUID,
    },
    unit_bussiness_name: {
        type: DataTypes.STRING,
    },
    supplier_name: {
        type: DataTypes.STRING,
    },
    total_dpp: {
        type: DataTypes.BIGINT,
    },
    total_discount: {
        type: DataTypes.BIGINT,
    },
    total_ppn: {
        type: DataTypes.BIGINT,
    },
    total_pph: {
        type: DataTypes.BIGINT,
    },
    grand_total: {
        type: DataTypes.BIGINT,
    },
    supplier_id: {
        type: DataTypes.UUID,
    },
    currency_id: {
        type: DataTypes.UUID,
    },
    tax_type_id: {
        type: DataTypes.UUID,
    },
    tax_type: {
        type: DataTypes.STRING,
    },
    exchange_rate: {
        type: DataTypes.INTEGER,
    },
    purchase_order_id: {
        type: DataTypes.UUID,
    },
    purchase_order_code: {
        type: DataTypes.STRING,
    },
    warehouse_id: {
        type: DataTypes.UUID,
    },
    document: {
        type: DataTypes.STRING,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_purchase_return;
