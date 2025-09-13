import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_responsibility_d = sequelize.define('m_responsibility_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    f_responsibility: {
        type: DataTypes.UUID,
    },
    f_role: {
        type: DataTypes.UUID,
    },
    status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_responsibility_d;
