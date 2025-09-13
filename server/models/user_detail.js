import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const user_detail = sequelize.define('user_detail', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    f_user_default: {
        type: DataTypes.UUID,
    },
    f_responsibility: {
        type: DataTypes.UUID,
    },
    is_primary: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default user_detail;
