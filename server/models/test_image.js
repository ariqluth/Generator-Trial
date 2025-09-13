import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const test_image = sequelize.define('test_image', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    photo: {
        type: DataTypes.TEXT,
    },
    file: {
        type: DataTypes.STRING,
    },
    lain: {
        type: DataTypes.STRING,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default test_image;
