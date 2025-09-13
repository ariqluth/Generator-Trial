
import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const test coba = sequelize.define('test coba', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  // Fields will be added dynamically
}, {
  timestamps: true,
  freezeTableName: true,
});

export default test coba;

