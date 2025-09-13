import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_target = sequelize.define('m_target', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    unit_bussiness_id: {
        type: DataTypes.UUID,
    },
    code: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    period: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    sales_area_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    sales_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    date: {
        type: DataTypes.DATEONLY,
    },
    total: {
        type: DataTypes.DOUBLE,
    },
    notes: {
        type: DataTypes.TEXT,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_target;
