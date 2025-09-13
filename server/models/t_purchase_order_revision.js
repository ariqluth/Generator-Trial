import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_purchase_order_revision = sequelize.define('t_purchase_order_revision', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    purchase_order_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    status: {
        type: DataTypes.STRING,
    },
    code: {
        type: DataTypes.STRING,
    },
    reason_reject: {
        type: DataTypes.TEXT,
    },
    reason_revision: {
        type: DataTypes.TEXT,
    },
    notes: {
        type: DataTypes.TEXT,
    },
    revision_number: {
        type: DataTypes.INTEGER,
    },
    approval_count: {
        type: DataTypes.INTEGER,
    },
    approved_count: {
        type: DataTypes.INTEGER,
    },
    current_approval_level: {
        type: DataTypes.INTEGER,
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
    revised_count: {
        type: DataTypes.INTEGER,
    },
    total: {
        type: DataTypes.BIGINT,
    },
    grand_total: {
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
    total_dpp: {
        type: DataTypes.BIGINT,
    },
    total_discount: {
        type: DataTypes.BIGINT,
    },
    dp: {
        type: DataTypes.BIGINT,
    },
    purchase_order_code: {
        type: DataTypes.STRING,
    },
    news_program_id: {
        type: DataTypes.UUID,
    },
    news_program_code: {
        type: DataTypes.STRING,
    },
    supplier_id: {
        type: DataTypes.UUID,
    },
    supplier_name: {
        type: DataTypes.STRING,
    },
    unit_bussiness_id: {
        type: DataTypes.UUID,
    },
    unit_bussiness_name: {
        type: DataTypes.STRING,
    },
    pkp: {
        type: DataTypes.STRING,
    },
    ppn: {
        type: DataTypes.INTEGER,
    },
    pph: {
        type: DataTypes.INTEGER,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_purchase_order_revision;
