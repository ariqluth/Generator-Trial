import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_cash_receipt_d = sequelize.define('t_cash_receipt_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    cash_receipt_id: {
        type: DataTypes.UUID,
    },
    coa_id: {
        type: DataTypes.UUID,
    },
    description: {
        type: DataTypes.STRING,
    },
    amount: {
        type: DataTypes.DOUBLE,
    },
    notes: {
        type: DataTypes.STRING,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_cash_receipt_d;
