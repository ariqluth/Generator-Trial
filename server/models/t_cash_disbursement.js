import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_cash_disbursement = sequelize.define('t_cash_disbursement', {
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
    supplier_id: {
        type: DataTypes.UUID,
    },
    type_id: {
        type: DataTypes.UUID,
    },
    bank_id: {
        type: DataTypes.UUID,
    },
    bank_account: {
        type: DataTypes.STRING,
    },
    account_number: {
        type: DataTypes.STRING,
    },
    status: {
        type: DataTypes.ENUM('draft', 'posted'),
    },
    date: {
        type: DataTypes.DATE,
    },
    group_id: {
        type: DataTypes.UUID,
    },
    coa_id: {
        type: DataTypes.UUID,
    },
    ref_no: {
        type: DataTypes.STRING,
    },
    purchase_order_id: {
        type: DataTypes.UUID,
    },
    total: {
        type: DataTypes.DOUBLE,
    },
    notes: {
        type: DataTypes.TEXT,
    },
    giro_number: {
        type: DataTypes.STRING,
    },
    giro_transfer_date: {
        type: DataTypes.DATE,
    },
    giro_deadline: {
        type: DataTypes.DATE,
    },
    created_by: {
        type: DataTypes.UUID,
    },
    udpated_by: {
        type: DataTypes.UUID,
    },
    receiver_id: {
        type: DataTypes.UUID,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_cash_disbursement;
