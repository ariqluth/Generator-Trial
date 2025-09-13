import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_interface_d = sequelize.define('m_interface_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    interface_id: {
        type: DataTypes.UUID,
    },
    coa_id: {
        type: DataTypes.UUID,
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_interface_d;
