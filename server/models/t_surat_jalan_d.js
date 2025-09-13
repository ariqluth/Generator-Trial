import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_surat_jalan_d = sequelize.define('t_surat_jalan_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    surat_jalan_id: {
        type: DataTypes.UUID,
    },
    item_id: {
        type: DataTypes.UUID,
    },
    qty: {
        type: DataTypes.INTEGER,
    },
    price: {
        type: DataTypes.DOUBLE,
    },
    amount: {
        type: DataTypes.DOUBLE,
    },
    weight: {
        type: DataTypes.INTEGER,
    },
    qty_return: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    item_name: {
        type: DataTypes.STRING,
    },
    qty_snapshot: {
        type: DataTypes.INTEGER,
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

export default t_surat_jalan_d;
