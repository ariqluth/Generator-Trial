import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_inventory_s_batches = sequelize.define('t_inventory_s_batches', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    item_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    warehouse_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    on_hand_quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    purchase_cost: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    purchase_date: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    expiration_date: {
        type: DataTypes.DATE,
    },
    last_updated_at: {
        type: DataTypes.BIGINT,
    },
    inventory_id: {
        type: DataTypes.UUID,
        comment: "for reference only",
    },
    last_on_hand_quantity: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    batch_number: {
        type: DataTypes.STRING,
        comment: "code",
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_inventory_s_batches;
