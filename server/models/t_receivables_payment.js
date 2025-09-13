import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_receivables_payment = sequelize.define('t_receivables_payment', {
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
    },
    cash_code: {
        type: DataTypes.STRING,
    },
    customer_id: {
        type: DataTypes.UUID,
    },
    customer_name: {
        type: DataTypes.STRING,
    },
    total_payment: {
        type: DataTypes.DOUBLE,
    },
    difference: {
        type: DataTypes.DOUBLE,
    },
    status: {
        type: DataTypes.ENUM('draft','posted'),
    },
    date: {
        type: DataTypes.DATE,
    },
    type_id: {
        type: DataTypes.UUID,
    },
    coa_id: {
        type: DataTypes.UUID,
    },
    total_si: {
        type: DataTypes.DOUBLE,
    },
    notes: {
        type: DataTypes.STRING,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_receivables_payment;
