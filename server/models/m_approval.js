import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_approval = sequelize.define('m_approval', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    code: {
        type: DataTypes.STRING,
    },
    unit_bussiness_id: {
        type: DataTypes.UUID,
    },
    name: {
        type: DataTypes.STRING,
    },
    min_trx: {
        type: DataTypes.BIGINT,
    },
    max_trx: {
        type: DataTypes.BIGINT,
    },
    menu_id: {
        type: DataTypes.UUID,
    },
    notes: {
        type: DataTypes.TEXT,
    },
    status: {
        type: DataTypes.BOOLEAN,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_approval;
