import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_accounting_journal = sequelize.define('t_accounting_journal', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    reference_id: {
        type: DataTypes.UUID,
        comment: "id darimana data datang",
        allowNull: false,
    },
    reference_type: {
        type: DataTypes.STRING,
        comment: "sesuai darimana data datang. contoh Sales Invoice",
        allowNull: false,
    },
    reference_no: {
        type: DataTypes.STRING,
        comment: "nomor/kode darimana data datang",
        allowNull: false,
    },
    description: {
        type: DataTypes.TEXT,
    },
    date: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    entity_id: {
        type: DataTypes.UUID,
    },
    entity_type: {
        type: DataTypes.STRING,
        comment: "contoh: m_customer, m_supplier",
    },
    code: {
        type: DataTypes.STRING,
    },
    is_closed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    journal_type: {
        type: DataTypes.STRING,
        comment: "modul. contoh marketing, purchasing",
    },
    created_by: {
        type: DataTypes.UUID,
    },
    updated_by: {
        type: DataTypes.UUID,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_accounting_journal;
