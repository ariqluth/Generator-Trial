import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_pricelist = sequelize.define('m_pricelist', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    item_id: {
        type: DataTypes.UUID,
    },
    unit_bussiness_id: {
        type: DataTypes.UUID,
    },
    price: {
        type: DataTypes.DOUBLE,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_pricelist;
