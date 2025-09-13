import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_customer_d_phone = sequelize.define('m_customer_d_phone', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    name: {
        type: DataTypes.STRING,
    },
    phone: {
        type: DataTypes.STRING,
    },
    customer_id: {
        type: DataTypes.UUID,
    },
    prospect_id: {
        type: DataTypes.UUID,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_customer_d_phone;
