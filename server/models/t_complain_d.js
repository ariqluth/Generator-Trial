import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_complain_d = sequelize.define('t_complain_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    complain_id: {
        type: DataTypes.UUID,
    },
    item_id: {
        type: DataTypes.UUID,
    },
    item_name: {
        type: DataTypes.STRING,
    },
    qty_ref: {
        type: DataTypes.INTEGER,
    },
    qty_return: {
        type: DataTypes.INTEGER,
    },
    uom_unit: {
        type: DataTypes.STRING,
    },
    reason_id: {
        type: DataTypes.UUID,
    },
    so_id: {
        type: DataTypes.UUID,
    },
    sj_id: {
        type: DataTypes.UUID,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_complain_d;
