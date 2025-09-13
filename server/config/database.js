import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

// Initialize environment variables
dotenv.config();

// Create a new Sequelize instance
export const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    hooks: {
      beforeSync: async (options) => {
        if (process.env.NODE_ENV === 'development') {
          const queryInterface = sequelize.getQueryInterface();

          // Dapatkan informasi semua kolom di database
          const [columnInfo] = await queryInterface.sequelize.query(`
            SELECT 
              table_name,
              column_name,
              data_type,
              is_nullable
            FROM information_schema.columns 
            WHERE table_schema = 'public';
          `);

          // Buat map untuk mempermudah pengecekan
          const dbColumnTypes = columnInfo.reduce((acc, col) => {
            if (!acc[col.table_name]) {
              acc[col.table_name] = {};
            }
            acc[col.table_name][col.column_name] = {
              type: col.data_type,
              nullable: col.is_nullable === 'YES'
            };
            return acc;
          }, {});

          // Get all models
          const models = sequelize.models;
          for (const modelName in models) {
            const tableName = modelName.toLowerCase();
            const attributes = models[modelName].rawAttributes;

            for (const field in attributes) {
              const modelType = attributes[field].type;
              const dbColumn = dbColumnTypes[tableName]?.[field];

              // Skip id fields and fields with defaultValue
              if (field === 'id' || attributes[field].defaultValue) continue;

              // Jika kolom ada di database
              if (dbColumn) {              // Case 1: String in model but Integer in DB
                if (modelType.key === 'STRING' && dbColumn.type.toLowerCase() === 'integer') {
                  try {
                    console.log(`Converting ${tableName}.${field} from STRING to INTEGER`);
                    await queryInterface.sequelize.query(`
                      DO $$
                      BEGIN
                        ALTER TABLE "${modelName}" 
                        ADD COLUMN IF NOT EXISTS "${field}_temp" TEXT;
                        
                        UPDATE "${modelName}" 
                        SET "${field}_temp" = "${field}";
                        
                        ALTER TABLE "${modelName}" 
                        DROP COLUMN "${field}";
                        
                        ALTER TABLE "${modelName}" 
                        ADD COLUMN "${field}" INTEGER;
                        
                        UPDATE "${modelName}" 
                        SET "${field}" = CASE 
                          WHEN "${field}_temp" ~ '^[0-9]+$'
                          THEN "${field}_temp"::integer
                          ELSE NULL
                        END;
                        
                        ALTER TABLE "${modelName}" 
                        DROP COLUMN IF EXISTS "${field}_temp";
                      EXCEPTION 
                        WHEN others THEN
                          ALTER TABLE "${modelName}" 
                          DROP COLUMN IF EXISTS "${field}_temp";
                          RAISE NOTICE 'Error occurred: %', SQLERRM;
                      END
                      $$;
                    `);
                  } catch (err) {
                    console.warn(`Column conversion warning for ${modelName}.${field}:`, err.message);
                  }
                }
                // Case 2: Integer in model but String in DB
                else if (modelType.key === 'INTEGER' &&
                  (dbColumn.type.toLowerCase() === 'character varying' ||
                    dbColumn.type.toLowerCase() === 'text')) {
                  try {
                    // console.log(`Converting ${tableName}.${field} from TEXT to INTEGER`);
                    await queryInterface.sequelize.query(`
                      DO $$
                      BEGIN
                        ALTER TABLE "${modelName}" 
                        ADD COLUMN IF NOT EXISTS "${field}_temp" TEXT;
                        
                        UPDATE "${modelName}" 
                        SET "${field}_temp" = "${field}";
                        
                        ALTER TABLE "${modelName}" 
                        DROP COLUMN "${field}";
                        
                        ALTER TABLE "${modelName}" 
                        ADD COLUMN "${field}" INTEGER;
                        
                        UPDATE "${modelName}" 
                        SET "${field}" = CASE 
                          WHEN "${field}_temp" ~ '^[0-9]+$'
                          THEN "${field}_temp"::integer
                          ELSE NULL
                        END;
                        
                        ALTER TABLE "${modelName}" 
                        DROP COLUMN IF EXISTS "${field}_temp";
                      EXCEPTION 
                        WHEN others THEN
                          ALTER TABLE "${modelName}" 
                          DROP COLUMN IF EXISTS "${field}_temp";
                          RAISE NOTICE 'Error occurred: %', SQLERRM;
                      END
                      $$;
                    `);
                  } catch (err) {
                    console.warn(`Column conversion warning for ${modelName}.${field}:`, err.message);
                  }
                }
                // Case 3: Model adalah UUID tapi di DB bukan
                else if (modelType.key === 'UUID' && dbColumn.type.toLowerCase() !== 'uuid') {
                  try {
                    // console.log(`Converting ${tableName}.${field} from ${dbColumn.type} to UUID`);
                    await queryInterface.sequelize.query(`
                      DO $$
                      BEGIN
                        ALTER TABLE "${modelName}" 
                        ADD COLUMN IF NOT EXISTS "${field}_temp" TEXT;
                        
                        UPDATE "${modelName}" 
                        SET "${field}_temp" = "${field}";
                        
                        ALTER TABLE "${modelName}" 
                        DROP COLUMN "${field}";
                        
                        ALTER TABLE "${modelName}" 
                        ADD COLUMN "${field}" UUID;
                        
                        UPDATE "${modelName}" 
                        SET "${field}" = CASE 
                          WHEN "${field}_temp" ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                          THEN "${field}_temp"::uuid
                          ELSE NULL
                        END;
                        
                        ALTER TABLE "${modelName}" 
                        DROP COLUMN IF EXISTS "${field}_temp";
                      EXCEPTION 
                        WHEN others THEN
                          ALTER TABLE "${modelName}" 
                          DROP COLUMN IF EXISTS "${field}_temp";
                          RAISE NOTICE 'Error occurred: %', SQLERRM;
                      END
                      $$;
                    `);
                  } catch (err) {
                    console.warn(`Column conversion warning for ${modelName}.${field}:`, err.message);
                  }
                }
                // Case 2: DB adalah UUID tapi model bukan
                else if (dbColumn.type.toLowerCase() === 'uuid' && modelType.key !== 'UUID') {
                  try {
                    const newType = modelType.key.toLowerCase();
                    // console.log(`Converting ${tableName}.${field} from UUID to ${newType}`);
                    await queryInterface.sequelize.query(`
                      DO $$
                      BEGIN
                        ALTER TABLE "${modelName}" 
                        ADD COLUMN IF NOT EXISTS "${field}_temp" UUID;
                        
                        UPDATE "${modelName}" 
                        SET "${field}_temp" = "${field}";
                        
                        ALTER TABLE "${modelName}" 
                        DROP COLUMN "${field}";
                        
                        ALTER TABLE "${modelName}" 
                        ADD COLUMN "${field}" ${newType};
                        
                        UPDATE "${modelName}" 
                        SET "${field}" = "${field}_temp"::text;
                        
                        ALTER TABLE "${modelName}" 
                        DROP COLUMN IF EXISTS "${field}_temp";
                      EXCEPTION 
                        WHEN others THEN
                          ALTER TABLE "${modelName}" 
                          DROP COLUMN IF EXISTS "${field}_temp";
                          RAISE NOTICE 'Error occurred: %', SQLERRM;
                      END
                      $$;
                    `);
                  } catch (err) {
                    console.warn(`Column conversion warning for ${modelName}.${field}:`, err.message);
                  }
                }
              }
            }
          }
        }
      }
    }
  }
);

export default sequelize;