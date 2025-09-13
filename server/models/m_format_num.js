import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_format_num = sequelize.define('m_format_num', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    f_comp: {
        type: DataTypes.UUID,
    },
    f_menu: {
        type: DataTypes.UUID,
    },
    identifier: {
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

export default m_format_num;
