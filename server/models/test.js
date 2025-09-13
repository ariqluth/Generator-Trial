
import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const test = sequelize.define('test', {
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

export default test;
