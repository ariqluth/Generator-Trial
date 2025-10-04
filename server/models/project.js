import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Project = sequelize.define('project', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(120),
    allowNull: false
  },
  baseUrl: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'base_url',
    validate: {
      isUrl: true
    }
  },
  token: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  databaseType: {
    type: DataTypes.STRING(30),
    allowNull: false,
    field: 'database_type',
    defaultValue: 'postgres'
  },
  isFavorite: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    field: 'is_favorite',
    defaultValue: false
  }
}, {
  tableName: 'projects',
  freezeTableName: true,
  timestamps: true
});

let synced = false;
export async function ensureProjectTable() {
  if (!synced) {
    await Project.sync();
    synced = true;
  }
  return Project;
}

export default Project;
