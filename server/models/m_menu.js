import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_menu = sequelize.define('m_menu', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    name: {
        type: DataTypes.STRING,
    },
    desc: {
        type: DataTypes.STRING,
    },
    sub_modul: {
        type: DataTypes.STRING,
    },
    icon: {
        type: DataTypes.TEXT,
    },
    status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    seq: {
        type: DataTypes.DECIMAL,
    },
    modul: {
        type: DataTypes.STRING,
    },
    path: {
        type: DataTypes.STRING,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_menu;
