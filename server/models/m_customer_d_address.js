import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_customer_d_address = sequelize.define('m_customer_d_address', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    delivery_area_id: {
        type: DataTypes.UUID,
    },
    address: {
        type: DataTypes.STRING,
    },
    province_id: {
        type: DataTypes.UUID,
    },
    city_id: {
        type: DataTypes.UUID,
    },
    district_id: {
        type: DataTypes.UUID,
    },
    postal_code: {
        type: DataTypes.STRING,
    },
    notes: {
        type: DataTypes.TEXT,
    },
    is_default: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    customer_id: {
        type: DataTypes.UUID,
    },
    name: {
        type: DataTypes.STRING,
    },
    prospect_id: {
        type: DataTypes.UUID,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_customer_d_address;
