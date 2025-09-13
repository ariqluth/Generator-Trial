import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_unit_bussiness = sequelize.define('m_unit_bussiness', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    code: {
        type: DataTypes.STRING,
    },
    name: {
        type: DataTypes.STRING,
    },
    province_id: {
        type: DataTypes.UUID,
    },
    district_id: {
        type: DataTypes.UUID,
    },
    notes: {
        type: DataTypes.TEXT,
    },
    status: {
        type: DataTypes.BOOLEAN,
    },
    address: {
        type: DataTypes.TEXT,
    },
    city_id: {
        type: DataTypes.UUID,
    },
    postal_code: {
        type: DataTypes.STRING,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_unit_bussiness;
