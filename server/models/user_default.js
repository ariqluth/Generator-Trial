import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const user_default = sequelize.define('user_default', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    nik: {
        type: DataTypes.STRING,
        unique: true,
    },
    name: {
        type: DataTypes.STRING,
    },
    username: {
        type: DataTypes.STRING,
        unique: true,
    },
    password: {
        type: DataTypes.STRING,
    },
    desc: {
        type: DataTypes.STRING,
    },
    f_user_type: {
        type: DataTypes.UUID,
    },
    status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default user_default;
