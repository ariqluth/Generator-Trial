import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_commission_d_condition = sequelize.define('m_commission_d_condition', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    commission_id: {
        type: DataTypes.UUID,
        unique: true,
    },
    item_type_id: {
        type: DataTypes.UUID,
    },
    item_group_id: {
        type: DataTypes.UUID,
    },
    condition_id: {
        type: DataTypes.UUID,
    },
    sales_condition: {
        type: DataTypes.DOUBLE,
    },
    commission_type_id: {
        type: DataTypes.UUID,
    },
    value: {
        type: DataTypes.DOUBLE,
    },
    reward_type_id: {
        type: DataTypes.UUID,
    },
    full_commission: {
        type: DataTypes.DOUBLE,
    },
    less_commission: {
        type: DataTypes.DOUBLE,
    },
    max_limit: {
        type: DataTypes.DOUBLE,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_commission_d_condition;
