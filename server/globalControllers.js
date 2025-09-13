// File ini akan mendaftarkan semua controller ke global secara dinamis (ESM compatible)
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const controllersDir = path.join(__dirname, 'controllers');

(async () => {
    const files = fs.readdirSync(controllersDir).filter(file => file.endsWith('Controller.js'));
    for (const file of files) {
        const modulePath = pathToFileURL(path.join(controllersDir, file)).href;
        const controllerModule = await import(modulePath);
        Object.entries(controllerModule).forEach(([key, value]) => {
            global[key] = value;
        });
    }
})();
