import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_supplier = sequelize.define('m_supplier', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    code: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    nik: {
        type: DataTypes.STRING,
    },
    supplier_type_id: {
        type: DataTypes.UUID,
    },
    group_id: {
        type: DataTypes.UUID,
    },
    currency_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    top_supplier_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    is_pajak: {
        type: DataTypes.BOOLEAN,
    },
    npwp: {
        type: DataTypes.STRING,
    },
    photo: {
        type: DataTypes.STRING,
    },
    notes: {
        type: DataTypes.TEXT,
    },
    partner_type_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    supplier_type_name: {
        type: DataTypes.STRING,
    },
    createdBy: {
        type: DataTypes.UUID,
    },
    updatedBy: {
        type: DataTypes.UUID,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_supplier;
