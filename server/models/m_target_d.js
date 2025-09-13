import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_target_d = sequelize.define('m_target_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    target_id: {
        type: DataTypes.UUID,
    },
    division_id: {
        type: DataTypes.UUID,
    },
    item_id: {
        type: DataTypes.UUID,
    },
    jan: {
        type: DataTypes.DOUBLE,
    },
    feb: {
        type: DataTypes.DOUBLE,
    },
    mar: {
        type: DataTypes.DOUBLE,
    },
    apr: {
        type: DataTypes.DOUBLE,
    },
    mei: {
        type: DataTypes.DOUBLE,
    },
    jun: {
        type: DataTypes.DOUBLE,
    },
    jul: {
        type: DataTypes.DOUBLE,
    },
    aug: {
        type: DataTypes.DOUBLE,
    },
    sep: {
        type: DataTypes.DOUBLE,
    },
    okt: {
        type: DataTypes.DOUBLE,
    },
    nov: {
        type: DataTypes.DOUBLE,
    },
    des: {
        type: DataTypes.DOUBLE,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_target_d;
