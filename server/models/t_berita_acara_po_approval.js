import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_berita_acara_po_approval = sequelize.define('t_berita_acara_po_approval', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    ba_po_id: {
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
        type: DataTypes.STRING,
    },
    full_approval: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: "PENDING",
    },
    notes: {
        type: DataTypes.TEXT,
    },
    approved_at: {
        type: DataTypes.DATE,
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_berita_acara_po_approval;
