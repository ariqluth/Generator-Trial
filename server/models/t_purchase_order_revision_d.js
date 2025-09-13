import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_purchase_order_revision_d = sequelize.define('t_purchase_order_revision_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    purchase_order_revision_id: {
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
    qty: {
        type: DataTypes.INTEGER,
    },
    tolerance: {
        type: DataTypes.INTEGER,
    },
    price: {
        type: DataTypes.BIGINT,
    },
    discount_percent: {
        type: DataTypes.DECIMAL,
    },
    discount_pcs: {
        type: DataTypes.BIGINT,
    },
    total: {
        type: DataTypes.BIGINT,
    },
    notes: {
        type: DataTypes.TEXT,
    },
    purchase_request_d_id: {
        type: DataTypes.UUID,
    },
    qty_pr: {
        type: DataTypes.INTEGER,
    },
    discount_total: {
        type: DataTypes.BIGINT,
    },
    item_name: {
        type: DataTypes.STRING,
    },
    item_code: {
        type: DataTypes.STRING,
    },
    uom: {
        type: DataTypes.STRING,
    },
    item_uom_id: {
        type: DataTypes.UUID,
    },
    dpp: {
        type: DataTypes.BIGINT,
    },
    ppn: {
        type: DataTypes.INTEGER,
    },
    ppn_id: {
        type: DataTypes.UUID,
    },
    ppn_type: {
        type: DataTypes.STRING,
    },
    ppn_nominal: {
        type: DataTypes.BIGINT,
    },
    pph: {
        type: DataTypes.INTEGER,
    },
    pph_id: {
        type: DataTypes.UUID,
    },
    pph_type: {
        type: DataTypes.STRING,
    },
    pph_nominal: {
        type: DataTypes.BIGINT,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_purchase_order_revision_d;
