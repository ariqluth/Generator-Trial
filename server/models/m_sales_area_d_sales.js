import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_sales_area_d_sales = sequelize.define('m_sales_area_d_sales', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    sales_area_id: {
        type: DataTypes.UUID,
        unique: true,
    },
    sales_id: {
        type: DataTypes.UUID,
        unique: true,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_sales_area_d_sales;
