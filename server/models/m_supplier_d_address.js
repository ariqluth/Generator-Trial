import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_supplier_d_address = sequelize.define('m_supplier_d_address', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    supplier_id: {
        type: DataTypes.UUID,
    },
    address_type_id: {
        type: DataTypes.UUID,
    },
    pic_name: {
        type: DataTypes.STRING,
    },
    address: {
        type: DataTypes.TEXT,
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
    phone: {
        type: DataTypes.STRING,
    },
    fax: {
        type: DataTypes.STRING,
    },
    email: {
        type: DataTypes.STRING,
    },
    notes: {
        type: DataTypes.TEXT,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_supplier_d_address;
