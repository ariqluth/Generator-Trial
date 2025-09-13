import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const coba = sequelize.define('coba', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    nama: {
        type: DataTypes.STRING,
    },
    test: {
        type: DataTypes.STRING,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default coba;
