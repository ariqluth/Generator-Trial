import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_penerimaan_barang = sequelize.define('t_penerimaan_barang', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    unit_bussiness_id: {
        type: DataTypes.UUID,
    },
    unit_bussiness_name: {
        type: DataTypes.STRING,
    },
    code: {
        type: DataTypes.STRING,
    },
    item_type_id: {
        type: DataTypes.UUID,
    },
    purchase_order_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    police_number: {
        type: DataTypes.STRING,
    },
    no_sj_supplier: {
        type: DataTypes.STRING,
    },
    notes: {
        type: DataTypes.TEXT,
    },
    status: {
        type: DataTypes.STRING,
    },
    date: {
        type: DataTypes.DATE,
    },
    supplier_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    supplier_name: {
        type: DataTypes.STRING,
    },
    purchase_request_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    driver_name: {
        type: DataTypes.STRING,
    },
    date_sj_supplier: {
        type: DataTypes.DATE,
    },
    warehouse_id: {
        type: DataTypes.UUID,
        allowNull: false,
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
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_penerimaan_barang;
