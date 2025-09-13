import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_interface = sequelize.define('m_interface', {
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
    variable_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    status: {
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

export default m_interface;
