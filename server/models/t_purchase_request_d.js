import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_purchase_request_d = sequelize.define('t_purchase_request_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    purchase_request_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    item_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    item_uom_id: {
        type: DataTypes.UUID,
    },
    qty: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    on_hand: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    notes: {
        type: DataTypes.TEXT,
    },
    item_name: {
        type: DataTypes.STRING,
    },
    item_code: {
        type: DataTypes.STRING,
    },
    item_uom: {
        type: DataTypes.STRING,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_purchase_request_d;
