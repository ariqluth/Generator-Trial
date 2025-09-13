import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_complain_d_images = sequelize.define('t_complain_d_images', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    complain_d_id: {
        type: DataTypes.UUID,
    },
    image_url: {
        type: DataTypes.TEXT,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_complain_d_images;
