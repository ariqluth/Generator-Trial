import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_responsibility = sequelize.define('m_responsibility', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    f_comp: {
        type: DataTypes.UUID,
    },
    desc: {
        type: DataTypes.TEXT,
    },
    name: {
        type: DataTypes.STRING,
    },
    status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_responsibility;
