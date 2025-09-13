import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_currency_d = sequelize.define('m_currency_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    f_currency: {
        type: DataTypes.UUID,
    },
    start_date: {
        type: DataTypes.DATE,
    },
    end_date: {
        type: DataTypes.DATE,
    },
    rate: {
        type: DataTypes.STRING,
    },
    desc: {
        type: DataTypes.TEXT,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_currency_d;
