import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_service_fee = sequelize.define('t_service_fee', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    code: {
        type: DataTypes.STRING,
    },
    expedition_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    total_dpp: {
        type: DataTypes.BIGINT,
    },
    ppn_id: {
        type: DataTypes.UUID,
    },
    pph_id: {
        type: DataTypes.UUID,
    },
    total_fee: {
        type: DataTypes.BIGINT,
    },
    notes: {
        type: DataTypes.TEXT,
    },
    status: {
        type: DataTypes.STRING,
    },
    date: {
        type: DataTypes.DATE,
    },
    police_number: {
        type: DataTypes.STRING,
    },
    total_ppn: {
        type: DataTypes.BIGINT,
    },
    total_pph: {
        type: DataTypes.BIGINT,
    },
    total_after_pph: {
        type: DataTypes.BIGINT,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_service_fee;
