import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_approval_d = sequelize.define('m_approval_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    approval_id: {
        type: DataTypes.UUID,
    },
    level: {
        type: DataTypes.INTEGER,
    },
    type: {
        type: DataTypes.STRING,
    },
    user_id: {
        type: DataTypes.UUID,
    },
    full_approval: {
        type: DataTypes.BOOLEAN,
    },
    status: {
        type: DataTypes.BOOLEAN,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_approval_d;
