import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_delivery_area = sequelize.define('m_delivery_area', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    code: {
        type: DataTypes.STRING,
    },
    unit_bussiness_id: {
        type: DataTypes.UUID,
    },
    description: {
        type: DataTypes.STRING,
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    notes: {
        type: DataTypes.STRING,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_delivery_area;
