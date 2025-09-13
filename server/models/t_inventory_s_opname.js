import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_inventory_s_opname = sequelize.define('t_inventory_s_opname', {
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
        allowNull: false,
    },
    status: {
        type: DataTypes.STRING,
        comment: "DRAFT|POSTED",
        defaultValue: "DRAFT",
    },
    date: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    pic_name: {
        type: DataTypes.STRING,
        comment: "for now just name",
    },
    pic_id: {
        type: DataTypes.UUID,
        comment: "let be here first",
    },
    warehouse_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    notes: {
        type: DataTypes.TEXT,
    },
    item_group_id: {
        type: DataTypes.UUID,
    },
    item_kind_id: {
        type: DataTypes.UUID,
    },
    group_id: {
        type: DataTypes.UUID,
    },
    item_division_id: {
        type: DataTypes.UUID,
    },
    submitted_by: {
        type: DataTypes.UUID,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_inventory_s_opname;
