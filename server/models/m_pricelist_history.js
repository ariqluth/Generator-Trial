import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_pricelist_history = sequelize.define('m_pricelist_history', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    pricelist_id: {
        type: DataTypes.UUID,
    },
    price: {
        type: DataTypes.DOUBLE,
    },
    date: {
        type: DataTypes.DATE,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_pricelist_history;
