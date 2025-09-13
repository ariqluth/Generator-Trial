import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_sales_invoice = sequelize.define('t_sales_invoice', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    unit_bussiness_id: {
        type: DataTypes.UUID,
    },
    customer_id: {
        type: DataTypes.UUID,
    },
    sj_id: {
        type: DataTypes.UUID,
    },
    sales_id: {
        type: DataTypes.UUID,
    },
    tax_id: {
        type: DataTypes.UUID,
    },
    date: {
        type: DataTypes.DATEONLY,
    },
    due_date: {
        type: DataTypes.DATEONLY,
    },
    termin: {
        type: DataTypes.INTEGER,
    },
    no_faktur: {
        type: DataTypes.STRING,
    },
    header_note: {
        type: DataTypes.STRING,
    },
    do_note: {
        type: DataTypes.STRING,
    },
    status: {
        type: DataTypes.INTEGER,
        comment: "1: Draft 2: In Approval 3: Revision 4: Approved 9: Rejected",
        defaultValue: 1,
    },
    unit_bussiness: {
        type: DataTypes.STRING,
    },
    customer: {
        type: DataTypes.STRING,
    },
    print_count: {
        type: DataTypes.INTEGER,
    },
    dpp: {
        type: DataTypes.DOUBLE,
    },
    dpp2: {
        type: DataTypes.DOUBLE,
    },
    total_disc: {
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
    tax_value: {
        type: DataTypes.DOUBLE,
        defaultValue: 0,
    },
    code: {
        type: DataTypes.STRING,
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
    grand_total_snapshot: {
        type: DataTypes.DOUBLE,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_sales_invoice;
