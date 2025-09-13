import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_coa = sequelize.define('m_coa', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    unit_bussiness_id: {
        type: DataTypes.UUID,
    },
    name: {
        type: DataTypes.STRING,
    },
    category_id: {
        type: DataTypes.UUID,
    },
    is_debit: {
        type: DataTypes.BOOLEAN,
    },
    status: {
        type: DataTypes.BOOLEAN,
    },
    division_id: {
        type: DataTypes.UUID,
    },
    code: {
        type: DataTypes.STRING,
    },
    item_type_id: {
        type: DataTypes.UUID,
    },
    description: {
        type: DataTypes.STRING,
    },
    notes: {
        type: DataTypes.STRING,
    },
    parent_id: {
        type: DataTypes.UUID,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_coa;
