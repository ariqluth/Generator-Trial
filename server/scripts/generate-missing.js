import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import controllerTemplate from '../templates/controllerTemplate.js';
import hooksTemplate from '../templates/hooksTemplate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function generateMissingFiles() {
    try {
        const modelsPath = path.join(__dirname, '../models');
        const controllersPath = path.join(__dirname, '../controllers');
        const hooksPath = path.join(__dirname, '../hooks');

        // Get all model files
        const files = await fs.readdir(modelsPath);
        const modelFiles = files.filter(file => file.endsWith('.js') && file !== 'index.js');
        const modelNames = modelFiles.map(file => file.replace('.js', ''));

        // Get existing controller and hook files
        const controllers = await fs.readdir(controllersPath);
        const hooks = await fs.readdir(hooksPath);

        // Filter to just the model-related files (exclude other controllers/hooks)
        const existingControllers = new Set(controllers
            .filter(file => file.endsWith('Controller.js'))
            .map(file => file.replace('Controller.js', '')));
        const existingHooks = new Set(hooks
            .filter(file => file.endsWith('Hooks.js'))
            .map(file => file.replace('Hooks.js', '')));

        for (const modelName of modelNames) {
            const hasController = existingControllers.has(modelName);
            const hasHook = existingHooks.has(modelName);

            if (!hasController || !hasHook) {
                // console.log(`Checking ${modelName}:`);

                // Generate controller if missing
                if (!hasController) {
                    // console.log(`  Missing controller - generating...`);
                    const controllerPath = path.join(controllersPath, `${modelName}Controller.js`);
                    await fs.writeFile(controllerPath, controllerTemplate(modelName));
                    // console.log(`  Controller generated: ${modelName}Controller.js`);
                }

                // Generate hooks if missing
                if (!hasHook) {
                    // console.log(`  Missing hooks - generating...`);
                    const hooksPath = path.join(__dirname, '../hooks');
                    await fs.mkdir(hooksPath, { recursive: true });
                    await fs.writeFile(
                        path.join(hooksPath, `${modelName}Hooks.js`),
                        hooksTemplate(modelName)
                    );
                    // console.log(`  Hooks generated: ${modelName}Hooks.js`);
                }
            } else {
                // console.log(`Model ${modelName} has all required files`);
            }
        }

        // console.log('Generation complete!');
    } catch (error) {
        console.error('Error:', error);
    }
}

generateMissingFiles();
