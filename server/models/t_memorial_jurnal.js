import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_memorial_jurnal = sequelize.define('t_memorial_jurnal', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    unit_bussiness_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    code: {
        type: DataTypes.STRING,
    },
    notes: {
        type: DataTypes.STRING,
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    date: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    totalDebit: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    totalKredit: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    coa_name: {
        type: DataTypes.STRING,
    },
    kredit: {
        type: DataTypes.STRING,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_memorial_jurnal;
