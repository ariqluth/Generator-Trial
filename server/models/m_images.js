import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_images = sequelize.define('m_images', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    image: {
        type: DataTypes.STRING,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_images;
