import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_prospect_approval = sequelize.define('m_prospect_approval', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    prospect_id: {
        type: DataTypes.UUID,
    },
    approval_id: {
        type: DataTypes.UUID,
    },
    approval_d_id: {
        type: DataTypes.UUID,
    },
    user_id: {
        type: DataTypes.UUID,
    },
    level: {
        type: DataTypes.INTEGER,
    },
    full_approval: {
        type: DataTypes.BOOLEAN,
    },
    status: {
        type: DataTypes.STRING,
    },
    notes: {
        type: DataTypes.TEXT,
    },
    approved_at: {
        type: DataTypes.DATE,
    },
    is_active: {
        type: DataTypes.BOOLEAN,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_prospect_approval;
