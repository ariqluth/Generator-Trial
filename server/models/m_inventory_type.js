import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_inventory_type = sequelize.define('m_inventory_type', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    name: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
    },
    io_multiplier: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_inventory_type;
