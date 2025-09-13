import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_commission_d_payment_tolerance = sequelize.define('m_commission_d_payment_tolerance', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    payment_duration_id: {
        type: DataTypes.UUID,
    },
    tolerance_duration_id: {
        type: DataTypes.UUID,
    },
    commission_id: {
        type: DataTypes.UUID,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_commission_d_payment_tolerance;
