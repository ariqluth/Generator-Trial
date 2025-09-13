import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_ganti_giro_masuk_d = sequelize.define('t_ganti_giro_masuk_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    t_ganti_giro_masuk_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    replacement_type: {
        type: DataTypes.STRING,
    },
    giro_number_account: {
        type: DataTypes.STRING,
    },
    due_date: {
        type: DataTypes.DATE,
    },
    amount: {
        type: DataTypes.BIGINT,
    },
    reference_number: {
        type: DataTypes.STRING,
    },
    detail_notes: {
        type: DataTypes.TEXT,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_ganti_giro_masuk_d;
