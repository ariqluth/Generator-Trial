import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_customer_d_docs = sequelize.define('m_customer_d_docs', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    doc_type_id: {
        type: DataTypes.UUID,
    },
    file_url: {
        type: DataTypes.TEXT,
    },
    notes: {
        type: DataTypes.TEXT,
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

export default m_customer_d_docs;
