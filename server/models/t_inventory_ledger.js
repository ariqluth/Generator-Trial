import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_inventory_ledger = sequelize.define('t_inventory_ledger', {
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
    batch_id: {
        type: DataTypes.UUID,
        comment: "only when m_item.is_batch is true",
    },
    inventory_type_id: {
        type: DataTypes.UUID,
        comment: "important for determine if the quantity is positive or negative",
        allowNull: false,
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    cost: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    reference_id: {
        type: DataTypes.UUID,
        comment: "it has to be not null if reference_source is present",
    },
    reference_source: {
        type: DataTypes.STRING,
        comment: "the reference",
    },
    created_at_timestamp: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    notes: {
        type: DataTypes.TEXT,
    },
    unit_bussiness_id: {
        type: DataTypes.UUID,
        comment: "only for easy tracking",
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_inventory_ledger;
