export default (tableName) => `
import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const ${tableName} = sequelize.define('${tableName}', {
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

export default ${tableName};
`;
