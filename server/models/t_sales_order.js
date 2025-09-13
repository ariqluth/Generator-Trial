import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_sales_order = sequelize.define('t_sales_order', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    sq_id: {
        type: DataTypes.UUID,
    },
    code: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    top_id: {
        type: DataTypes.UUID,
    },
    ppn_id: {
        type: DataTypes.UUID,
    },
    sales_id: {
        type: DataTypes.UUID,
    },
    delivery_area_id: {
        type: DataTypes.UUID,
    },
    expedition_id: {
        type: DataTypes.UUID,
    },
    expedition_type_id: {
        type: DataTypes.UUID,
    },
    customer_id: {
        type: DataTypes.UUID,
    },
    date: {
        type: DataTypes.DATEONLY,
    },
    est_date: {
        type: DataTypes.DATEONLY,
    },
    status: {
        type: DataTypes.INTEGER,
        comment: "1: Draft 2: In Approval 3: Revision 4: Approved 9: Rejected",
        defaultValue: 1,
    },
    ship_to_id: {
        type: DataTypes.UUID,
    },
    source: {
        type: DataTypes.ENUM('apps', 'websc'),
    },
    notes: {
        type: DataTypes.STRING,
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
    ppn: {
        type: DataTypes.DOUBLE,
    },
    ppn_percent: {
        type: DataTypes.DOUBLE,
    },
    grand_total: {
        type: DataTypes.DOUBLE,
    },
    dpp_percent: {
        type: DataTypes.DOUBLE,
    },
    dpp2_percent: {
        type: DataTypes.DOUBLE,
    },
    unit_bussiness_id: {
        type: DataTypes.UUID,
    },
    reason: {
        type: DataTypes.STRING,
    },
    unit_bussiness: {
        type: DataTypes.STRING,
    },
    top: {
        type: DataTypes.STRING,
    },
    ppn_type: {
        type: DataTypes.STRING,
    },
    sales: {
        type: DataTypes.STRING,
    },
    delivery_area: {
        type: DataTypes.STRING,
    },
    expedition: {
        type: DataTypes.STRING,
    },
    expedition_type: {
        type: DataTypes.STRING,
    },
    ship_to_name: {
        type: DataTypes.STRING,
    },
    ship_to_address: {
        type: DataTypes.STRING,
    },
    customer_name: {
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
    no_po_customer: {
        type: DataTypes.STRING,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_sales_order;
