import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_commission_d_sales_area = sequelize.define('m_commission_d_sales_area', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    sales_area_id: {
        type: DataTypes.UUID,
    },
    percentage: {
        type: DataTypes.DECIMAL,
    },
    commission_id: {
        type: DataTypes.UUID,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_commission_d_sales_area;
