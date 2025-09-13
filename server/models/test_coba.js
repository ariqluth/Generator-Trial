import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const test_coba = sequelize.define('test_coba', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    nama: {
        type: DataTypes.STRING,
        unique: true,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default test_coba;
