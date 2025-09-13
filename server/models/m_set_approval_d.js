import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_set_approval_d = sequelize.define('m_set_approval_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    f_set_approval: {
        type: DataTypes.UUID,
    },
    level: {
        type: DataTypes.INTEGER,
    },
    type: {
        type: DataTypes.STRING,
    },
    f_user: {
        type: DataTypes.UUID,
    },
    f_unit_bussiness: {
        type: DataTypes.UUID,
    },
    min_trx: {
        type: DataTypes.DECIMAL,
    },
    max_trx: {
        type: DataTypes.DECIMAL,
    },
    full_approval: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_set_approval_d;
