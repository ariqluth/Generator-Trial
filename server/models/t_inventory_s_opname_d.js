import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_inventory_s_opname_d = sequelize.define('t_inventory_s_opname_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    t_inventory_s_opname_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    item_code: {
        type: DataTypes.STRING,
    },
    item_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    item_uom_id: {
        type: DataTypes.UUID,
    },
    opname_qty: {
        type: DataTypes.INTEGER,
    },
    current_on_hand_quantity: {
        type: DataTypes.INTEGER,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_inventory_s_opname_d;
