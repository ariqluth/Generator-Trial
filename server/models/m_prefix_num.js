import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_prefix_num = sequelize.define('m_prefix_num', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    f_comp: {
        type: DataTypes.UUID,
    },
    name: {
        type: DataTypes.STRING,
    },
    f_pref_type: {
        type: DataTypes.UUID,
    },
    status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    value: {
        type: DataTypes.STRING,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_prefix_num;
