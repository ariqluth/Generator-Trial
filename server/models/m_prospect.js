import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_prospect = sequelize.define('m_prospect', {
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
    name_type_id: {
        type: DataTypes.UUID,
    },
    name: {
        type: DataTypes.STRING,
    },
    top_id: {
        type: DataTypes.UUID,
    },
    contact_person: {
        type: DataTypes.STRING,
    },
    email: {
        type: DataTypes.STRING,
    },
    latitude: {
        type: DataTypes.DOUBLE,
    },
    longitude: {
        type: DataTypes.DOUBLE,
    },
    pn: {
        type: DataTypes.BOOLEAN,
    },
    coa_id: {
        type: DataTypes.UUID,
    },
    phone: {
        type: DataTypes.STRING,
    },
    sales_area_id: {
        type: DataTypes.UUID,
    },
    sales_id: {
        type: DataTypes.UUID,
    },
    is_active: {
        type: DataTypes.BOOLEAN,
    },
    notes: {
        type: DataTypes.STRING,
    },
    current_approval_level: {
        type: DataTypes.INTEGER,
    },
    revised_count: {
        type: DataTypes.INTEGER,
    },
    approval_count: {
        type: DataTypes.INTEGER,
    },
    approved_count: {
        type: DataTypes.INTEGER,
    },
    unit_bussiness: {
        type: DataTypes.STRING,
    },
    created_by: {
        type: DataTypes.UUID,
    },
    updated_by: {
        type: DataTypes.UUID,
    },
    request_approval_at: {
        type: DataTypes.DATE,
    },
    request_approval_by: {
        type: DataTypes.UUID,
    },
    status: {
        type: DataTypes.INTEGER,
        comment: "1: Draft 2: In Approval 3: Revise 4: Approved 9: Rejected",
        defaultValue: 1,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_prospect;
