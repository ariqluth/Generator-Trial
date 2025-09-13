import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_customer_group = sequelize.define('m_customer_group', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    unit_bussiness_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    code: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    status: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
    segment_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    province_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    city_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    district_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    postal_code: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    address: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    credit_limit: {
        type: DataTypes.DOUBLE,
        allowNull: false,
    },
    monthly_target: {
        type: DataTypes.DOUBLE,
        allowNull: false,
    },
    notes: {
        type: DataTypes.TEXT,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_customer_group;
