import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_inventory_s_adjustment = sequelize.define('t_inventory_s_adjustment', {
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
    status: {
        type: DataTypes.STRING,
        defaultValue: "DRAFT",
    },
    unit_bussiness_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    date: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    warehouse_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    opname_id: {
        type: DataTypes.UUID,
    },
    notes: {
        type: DataTypes.STRING,
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
    current_approval_level: {
        type: DataTypes.INTEGER,
    },
    submitted_by: {
        type: DataTypes.UUID,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_inventory_s_adjustment;
