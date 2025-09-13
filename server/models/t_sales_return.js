import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_sales_return = sequelize.define('t_sales_return', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    unit_bussiness_id: {
        type: DataTypes.UUID,
    },
    code: {
        type: DataTypes.STRING,
    },
    return_type: {
        type: DataTypes.ENUM('cut_invoice','change_money','um'),
    },
    si_id: {
        type: DataTypes.UUID,
    },
    complain_id: {
        type: DataTypes.UUID,
    },
    status: {
        type: DataTypes.INTEGER,
        comment: "1: Draft 2: In Approval 3: Revision 4: Approved 9: Rejected",
        defaultValue: 1,
    },
    date: {
        type: DataTypes.DATEONLY,
    },
    customer_id: {
        type: DataTypes.UUID,
    },
    customer_name: {
        type: DataTypes.STRING,
    },
    notes: {
        type: DataTypes.STRING,
    },
    total: {
        type: DataTypes.DOUBLE,
    },
    sj_id: {
        type: DataTypes.UUID,
    },
    current_approval_level: {
        type: DataTypes.INTEGER,
    },
    revised_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    approval_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    approved_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    unit_bussiness: {
        type: DataTypes.STRING,
    },
    created_by: {
        type: DataTypes.UUID,
    },
    updated_by: {
        type: DataTypes.UUID,
    },
    request_approval_at: {
        type: DataTypes.DATE,
    },
    request_approval_by: {
        type: DataTypes.UUID,
    },
    dpp: {
        type: DataTypes.DOUBLE,
    },
    dpp2: {
        type: DataTypes.DOUBLE,
    },
    ppn_percent: {
        type: DataTypes.DOUBLE,
    },
    ppn: {
        type: DataTypes.DOUBLE,
    },
    grand_total: {
        type: DataTypes.DOUBLE,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_sales_return;
