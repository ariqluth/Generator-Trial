import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_sales_quotation = sequelize.define('t_sales_quotation', {
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
    customer_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    status: {
        type: DataTypes.INTEGER,
        comment: "1: Draft 2: In Approval 3: Revision 4: Approved 9: Rejected",
        defaultValue: 1,
    },
    date: {
        type: DataTypes.DATEONLY,
    },
    top_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    sales_id: {
        type: DataTypes.UUID,
    },
    total: {
        type: DataTypes.DOUBLE,
    },
    source: {
        type: DataTypes.ENUM('apps', 'websc'),
    },
    notes: {
        type: DataTypes.STRING,
    },
    address_id: {
        type: DataTypes.UUID,
    },
    customer_name: {
        type: DataTypes.STRING,
    },
    unit_bussiness: {
        type: DataTypes.STRING,
    },
    sales: {
        type: DataTypes.STRING,
    },
    ship_to_name: {
        type: DataTypes.STRING,
    },
    ship_to_address: {
        type: DataTypes.STRING,
    },
    top: {
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
    request_approval_by: {
        type: DataTypes.UUID,
    },
    request_approval_at: {
        type: DataTypes.DATE,
    },
    sales_area: {
        type: DataTypes.STRING,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_sales_quotation;
