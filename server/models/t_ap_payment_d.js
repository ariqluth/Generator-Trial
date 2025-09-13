import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_ap_payment_d = sequelize.define('t_ap_payment_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    ap_payment_id: {
        type: DataTypes.UUID,
    },
    pi_id: {
        type: DataTypes.UUID,
    },
    pi_code: {
        type: DataTypes.STRING,
    },
    pi_date: {
        type: DataTypes.DATE,
    },
    pi_due_date: {
        type: DataTypes.DATE,
    },
    invoice_amount: {
        type: DataTypes.BIGINT,
    },
    paid_amount: {
        type: DataTypes.BIGINT,
    },
    remaining_amount: {
        type: DataTypes.BIGINT,
    },
    total_payment: {
        type: DataTypes.BIGINT,
    },
    notes: {
        type: DataTypes.TEXT,
    },
    supplier_id: {
        type: DataTypes.UUID,
    },
    difference: {
        type: DataTypes.BIGINT,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_ap_payment_d;
