import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_purchase_order = sequelize.define('t_purchase_order', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    unit_bussiness_id: {
        type: DataTypes.UUID,
    },
    code: {
        type: DataTypes.STRING,
        unique: true,
    },
    item_type_id: {
        type: DataTypes.UUID,
    },
    tax_type_id: {
        type: DataTypes.UUID,
    },
    payment_type_id: {
        type: DataTypes.UUID,
    },
    currency_id: {
        type: DataTypes.UUID,
    },
    ship_unit_bussiness_id: {
        type: DataTypes.UUID,
    },
    status: {
        type: DataTypes.STRING,
    },
    date: {
        type: DataTypes.DATE,
    },
    supplier_id: {
        type: DataTypes.UUID,
    },
    top_supplier_id: {
        type: DataTypes.UUID,
    },
    excess_tolerance: {
        type: DataTypes.INTEGER,
    },
    exchange_rate: {
        type: DataTypes.INTEGER,
    },
    notes: {
        type: DataTypes.TEXT,
    },
    revision_reason: {
        type: DataTypes.TEXT,
    },
    reject_reason: {
        type: DataTypes.TEXT,
    },
    revision_no: {
        type: DataTypes.INTEGER,
    },
    dp: {
        type: DataTypes.BIGINT,
    },
    purchase_request_id: {
        type: DataTypes.UUID,
    },
    current_approval_level: {
        type: DataTypes.INTEGER,
    },
    total: {
        type: DataTypes.BIGINT,
    },
    selling_price: {
        type: DataTypes.BIGINT,
    },
    ppn: {
        type: DataTypes.INTEGER,
    },
    ppn_nominal: {
        type: DataTypes.BIGINT,
    },
    pph: {
        type: DataTypes.INTEGER,
    },
    pph_nominal: {
        type: DataTypes.BIGINT,
    },
    total_discount: {
        type: DataTypes.BIGINT,
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
    unit_bussiness_name: {
        type: DataTypes.STRING,
    },
    item_type: {
        type: DataTypes.STRING,
    },
    tax_type: {
        type: DataTypes.STRING,
    },
    payment_type: {
        type: DataTypes.STRING,
    },
    currency: {
        type: DataTypes.STRING,
    },
    ship_unit_bussiness_name: {
        type: DataTypes.STRING,
    },
    supplier_name: {
        type: DataTypes.STRING,
    },
    top_supplier: {
        type: DataTypes.STRING,
    },
    purchase_request_code: {
        type: DataTypes.STRING,
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
    grand_total: {
        type: DataTypes.BIGINT,
    },
    total_dpp: {
        type: DataTypes.BIGINT,
    },
    dp_code: {
        type: DataTypes.STRING,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_purchase_order;
