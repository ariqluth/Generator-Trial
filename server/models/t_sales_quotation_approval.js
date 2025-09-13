import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_sales_quotation_approval = sequelize.define('t_sales_quotation_approval', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    sq_id: {
        type: DataTypes.UUID,
        allowNull: false,
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
        comment: "PENDING/APPROVED/REJECTED",
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

export default t_sales_quotation_approval;
