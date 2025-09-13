import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_customer_d_restriction = sequelize.define('m_customer_d_restriction', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    is_sq: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    is_so: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    is_do: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    is_sr: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    is_si: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    customer_id: {
        type: DataTypes.UUID,
    },
    prospect_id: {
        type: DataTypes.UUID,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_customer_d_restriction;
