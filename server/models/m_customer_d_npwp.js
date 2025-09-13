import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_customer_d_npwp = sequelize.define('m_customer_d_npwp', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    number: {
        type: DataTypes.STRING,
    },
    attachment_url: {
        type: DataTypes.TEXT,
    },
    name: {
        type: DataTypes.STRING,
    },
    address: {
        type: DataTypes.TEXT,
    },
    notes: {
        type: DataTypes.TEXT,
    },
    is_default: {
        type: DataTypes.BOOLEAN,
    },
    is_active: {
        type: DataTypes.BOOLEAN,
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

export default m_customer_d_npwp;
