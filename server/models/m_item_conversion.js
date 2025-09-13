import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_item_conversion = sequelize.define('m_item_conversion', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    item_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    item_uom_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    value: {
        type: DataTypes.DOUBLE,
        allowNull: false,
        defaultValue: 1,
    },
    notes: {
        type: DataTypes.TEXT,
    },
    is_default: {
        type: DataTypes.BOOLEAN,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_item_conversion;
