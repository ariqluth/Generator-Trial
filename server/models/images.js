import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const images = sequelize.define('images', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    name: {
        type: DataTypes.STRING,
    },
    file: {
        type: DataTypes.TEXT,
    },
    file2: {
        type: DataTypes.TEXT,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default images;
