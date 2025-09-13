import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_warehouse = sequelize.define('m_warehouse', {
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
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    notes: {
        type: DataTypes.TEXT,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_warehouse;
