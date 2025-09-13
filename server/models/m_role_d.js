import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_role_d = sequelize.define('m_role_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    f_role: {
        type: DataTypes.UUID,
    },
    f_menu: {
        type: DataTypes.UUID,
    },
    read: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    create: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    show: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    update: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    delete: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    print: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_role_d;
