import { sequelize } from '../config/database.js';
import dotenv from 'dotenv';

// Initialize environment variables
dotenv.config();

// Run migrations
async function migrate() {
  try {
    // console.log('Starting database migration...');

    // Force sync all models (drops tables if they exist)
    // WARNING: Only use force: true in development/testing environments
    if (process.env.NODE_ENV === 'development') {
      // console.log('Dropping existing tables and recreating them...');
      await sequelize.sync({ force: true });
    } else {
      // In production, use alter: true instead to modify tables without dropping
      await sequelize.sync({ alter: true });
    }

    // console.log('Database migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Database migration failed:', error);
    process.exit(1);
  }
}

migrate();