import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_customer = sequelize.define('m_customer', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    notes: {
        type: DataTypes.TEXT,
    },
    unit_bussiness_id: {
        type: DataTypes.UUID,
    },
    top_id: {
        type: DataTypes.UUID,
    },
    name_type_id: {
        type: DataTypes.UUID,
    },
    contact_person: {
        type: DataTypes.STRING,
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    group_id: {
        type: DataTypes.UUID,
    },
    pn: {
        type: DataTypes.BOOLEAN,
    },
    coa_id: {
        type: DataTypes.UUID,
    },
    phone: {
        type: DataTypes.STRING,
    },
    sales_area_id: {
        type: DataTypes.UUID,
    },
    sales_id: {
        type: DataTypes.UUID,
    },
    code: {
        type: DataTypes.STRING,
    },
    latitude: {
        type: DataTypes.DOUBLE,
    },
    longitude: {
        type: DataTypes.DOUBLE,
    },
    prospek_id: {
        type: DataTypes.UUID,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_customer;
