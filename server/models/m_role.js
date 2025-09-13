import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_role = sequelize.define('m_role', {
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
    status: {
        type: DataTypes.BOOLEAN,
    },
    desc: {
        type: DataTypes.TEXT,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_role;
