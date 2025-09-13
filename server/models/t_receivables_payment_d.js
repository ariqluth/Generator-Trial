import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_receivables_payment_d = sequelize.define('t_receivables_payment_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    receivables_payment_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    si_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    total_paid: {
        type: DataTypes.DOUBLE,
    },
    total_remaining: {
        type: DataTypes.DOUBLE,
    },
    total_payment: {
        type: DataTypes.DOUBLE,
    },
    difference: {
        type: DataTypes.DOUBLE,
    },
    notes: {
        type: DataTypes.STRING,
    },
    total_si: {
        type: DataTypes.DOUBLE,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_receivables_payment_d;
