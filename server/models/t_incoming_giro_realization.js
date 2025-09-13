import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_incoming_giro_realization = sequelize.define('t_incoming_giro_realization', {
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
    incoming_giro_id: {
        type: DataTypes.UUID,
    },
    giro_number: {
        type: DataTypes.STRING,
    },
    giro_disbursement_date: {
        type: DataTypes.DATE,
    },
    bank_name: {
        type: DataTypes.STRING,
    },
    account_number: {
        type: DataTypes.STRING,
    },
    account_name: {
        type: DataTypes.STRING,
    },
    coa_number: {
        type: DataTypes.STRING,
    },
    coa_id: {
        type: DataTypes.UUID,
    },
    date: {
        type: DataTypes.DATE,
    },
    customer_id: {
        type: DataTypes.UUID,
    },
    customer_name: {
        type: DataTypes.STRING,
    },
    giro_value: {
        type: DataTypes.DOUBLE,
    },
    total_si: {
        type: DataTypes.DOUBLE,
    },
    total_paid: {
        type: DataTypes.DOUBLE,
    },
    difference: {
        type: DataTypes.DOUBLE,
    },
    notes: {
        type: DataTypes.STRING,
    },
    status: {
        type: DataTypes.ENUM('draft','posted'),
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_incoming_giro_realization;
