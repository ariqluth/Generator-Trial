import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_penerimaan_giro = sequelize.define('t_penerimaan_giro', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    unit_business_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    unit_business_name: {
        type: DataTypes.STRING,
    },
    code: {
        type: DataTypes.STRING,
    },
    customer_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    customer_name: {
        type: DataTypes.STRING,
    },
    customer_d_account_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    customer_d_account_name: {
        type: DataTypes.STRING,
    },
    pickup_date: {
        type: DataTypes.DATE,
    },
    deposit_date: {
        type: DataTypes.DATE,
    },
    due_date: {
        type: DataTypes.DATE,
    },
    status: {
        type: DataTypes.STRING,
    },
    date: {
        type: DataTypes.DATE,
    },
    coa_id: {
        type: DataTypes.UUID,
    },
    giro_number: {
        type: DataTypes.STRING,
    },
    giro_amount: {
        type: DataTypes.BIGINT,
    },
    reference_number: {
        type: DataTypes.STRING,
    },
    posted_by: {
        type: DataTypes.UUID,
    },
    posted_at: {
        type: DataTypes.DATE,
    },
    createdBy: {
        type: DataTypes.UUID,
    },
    updatedBy: {
        type: DataTypes.UUID,
    },
    notes: {
        type: DataTypes.STRING,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_penerimaan_giro;
