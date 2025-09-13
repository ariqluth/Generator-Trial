import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_incoming_giro_realization_d = sequelize.define('t_incoming_giro_realization_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    incoming_giro_realization_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    si_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    total_si: {
        type: DataTypes.DOUBLE,
    },
    total_paid: {
        type: DataTypes.DOUBLE,
    },
    total_remaining: {
        type: DataTypes.DOUBLE,
    },
    total_payment: {
        type: DataTypes.DOUBLE,
    },
    difference: {
        type: DataTypes.DOUBLE,
    },
    notes: {
        type: DataTypes.STRING,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_incoming_giro_realization_d;
