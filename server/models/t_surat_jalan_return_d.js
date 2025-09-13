import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_surat_jalan_return_d = sequelize.define('t_surat_jalan_return_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    surat_jalan_return_id: {
        type: DataTypes.UUID,
    },
    item_id: {
        type: DataTypes.UUID,
    },
    qty_sj: {
        type: DataTypes.INTEGER,
    },
    qty_return: {
        type: DataTypes.INTEGER,
    },
    notes: {
        type: DataTypes.STRING,
    },
    item_name: {
        type: DataTypes.STRING,
    },
    uom_unit: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "PCS",
    },
    uom_value: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
    },
    uom_id: {
        type: DataTypes.UUID,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_surat_jalan_return_d;
