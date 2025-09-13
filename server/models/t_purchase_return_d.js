import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_purchase_return_d = sequelize.define('t_purchase_return_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    t_purchase_return_id: {
        type: DataTypes.UUID,
    },
    item_receipt_d_id: {
        type: DataTypes.UUID,
    },
    qty: {
        type: DataTypes.INTEGER,
    },
    qty_already_returned: {
        type: DataTypes.INTEGER,
    },
    price: {
        type: DataTypes.BIGINT,
    },
    reason: {
        type: DataTypes.STRING,
    },
    notes: {
        type: DataTypes.TEXT,
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
    item_uom_id: {
        type: DataTypes.UUID,
    },
    item_uom: {
        type: DataTypes.STRING,
    },
    discount_percent: {
        type: DataTypes.INTEGER,
    },
    discount_amt: {
        type: DataTypes.BIGINT,
    },
    purchase_order_d_id: {
        type: DataTypes.UUID,
    },
    reference_supplier: {
        type: DataTypes.STRING,
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
    discount_total: {
        type: DataTypes.BIGINT,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_purchase_return_d;
