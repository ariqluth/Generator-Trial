import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const t_reservation_history = sequelize.define('t_reservation_history', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        comment: "SEBAGAI IDENTIFIER",
        defaultValue: DataTypes.UUIDV4,
    },
    reservation_id: {
        type: DataTypes.UUID,
    },
    item_id: {
        type: DataTypes.UUID,
    },
    date: {
        type: DataTypes.DATEONLY,
    },
    qty_booking: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    qty_release: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    item_name: {
        type: DataTypes.STRING,
    },
}, {
    timestamps: true,
    freezeTableName: true
});

export default t_reservation_history;
