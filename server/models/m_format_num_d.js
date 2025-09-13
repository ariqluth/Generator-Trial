import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_format_num_d = sequelize.define('m_format_num_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    f_format_num: {
        type: DataTypes.UUID,
    },
    f_prefix_num: {
        type: DataTypes.UUID,
    },
    order: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_format_num_d;
