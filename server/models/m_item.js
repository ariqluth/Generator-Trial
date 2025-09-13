import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_item = sequelize.define('m_item', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    code: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    status: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
    item_type_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    item_type_name: {
        type: DataTypes.STRING,
    },
    item_division_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    item_division_name: {
        type: DataTypes.STRING,
    },
    item_kind_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    item_group_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    item_group_name: {
        type: DataTypes.STRING,
    },
    group_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    item_uom_id: {
        type: DataTypes.UUID,
    },
    alias: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    dimension: {
        type: DataTypes.STRING,
    },
    thickness: {
        type: DataTypes.STRING,
    },
    length: {
        type: DataTypes.STRING,
    },
    type: {
        type: DataTypes.STRING,
    },
    size: {
        type: DataTypes.STRING,
    },
    excess_tolerance: {
        type: DataTypes.DOUBLE,
        defaultValue: 0,
    },
    actual_weight: {
        type: DataTypes.DOUBLE,
    },
    marketing_weight: {
        type: DataTypes.DOUBLE,
    },
    min_stock: {
        type: DataTypes.DOUBLE,
    },
    max_stock: {
        type: DataTypes.DOUBLE,
    },
    photo: {
        type: DataTypes.STRING,
    },
    file: {
        type: DataTypes.TEXT,
    },
    notes: {
        type: DataTypes.TEXT,
    },
    is_batch: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    is_bundle: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    createdBy: {
        type: DataTypes.UUID,
    },
    updatedBy: {
        type: DataTypes.UUID,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_item;
