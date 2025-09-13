import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_set_approval = sequelize.define('m_set_approval', {
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
    desc: {
        type: DataTypes.TEXT,
    },
    status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    f_menu: {
        type: DataTypes.UUID,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_set_approval;
