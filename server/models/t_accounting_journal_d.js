import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_accounting_journal_d = sequelize.define('t_accounting_journal_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    accounting_journal_id: {
        type: DataTypes.UUID,
    },
    debit: {
        type: DataTypes.DOUBLE,
        allowNull: false,
        defaultValue: 0,
    },
    credit: {
        type: DataTypes.DOUBLE,
        allowNull: false,
        defaultValue: 0,
    },
    coa_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    notes: {
        type: DataTypes.STRING,
    },
    variable: {
        type: DataTypes.STRING,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_accounting_journal_d;
