import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const m_sales_area_d = sequelize.define('m_sales_area_d', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    sales_area_id: {
        type: DataTypes.UUID,
    },
    city_id: {
        type: DataTypes.UUID,
    },
    district_id: {
        type: DataTypes.UUID,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default m_sales_area_d;
