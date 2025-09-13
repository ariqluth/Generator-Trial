import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_commission = sequelize.define('m_commission', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    unit_bussiness_id: {
        type: DataTypes.UUID,
    },
    code: {
        type: DataTypes.STRING,
    },
    commission_type_id: {
        type: DataTypes.UUID,
    },
    start_date: {
        type: DataTypes.DATEONLY,
    },
    end_date: {
        type: DataTypes.DATEONLY,
    },
    name: {
        type: DataTypes.STRING,
    },
    is_active: {
        type: DataTypes.BOOLEAN,
    },
    notes: {
        type: DataTypes.STRING,
    },
    active_flag: {
        type: DataTypes.INTEGER,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_commission;
