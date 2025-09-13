import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_outgoing_giro_realization_approval = sequelize.define('t_outgoing_giro_realization_approval', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    ogr_id: {
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

export default t_outgoing_giro_realization_approval;
