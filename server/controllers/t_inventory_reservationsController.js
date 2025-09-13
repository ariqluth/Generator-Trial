// Controller for t_inventory_reservations
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_inventory_reservations
//
// Tambahkan custom function di bawah ini
import * as fs from 'fs/promises';
import * as path from 'path';

export const t_inventory_reservationsController = {
    // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
    async uploadImage(req, res) {
        const fileFields = Object.keys(req.models.t_inventory_reservations.rawAttributes).filter(
            key => req.models.t_inventory_reservations.rawAttributes[key].type && req.models.t_inventory_reservations.rawAttributes[key].type.key === 'STRING'
        );
        let data = req.body;
        if (fileFields.length > 0 && req.files && req.files.length > 0) {
            for (const field of fileFields) {
                const fileObj = req.files.find(f => f.fieldname === field);
                if (fileObj && fileObj.path) {
                    // Simpan path apa adanya dari multer
                    data[field] = fileObj.path;
                }
            }
        }
        try {
            const inserted = await req.models.t_inventory_reservations.create(data);
            res.json({ message: 'Image uploaded', data: inserted });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    // Contoh: Import Excel ke database
    async importExcel(req, res) {
        if (!req.excelData) return res.status(400).json({ error: 'No Excel data' });
        const [header, ...rows] = req.excelData;
        const records = rows.map(row => Object.fromEntries(header.map((h, i) => [h, row[i]])));
        try {
            const inserted = await req.models.t_inventory_reservations.bulkCreate(records);
            res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    // Contoh: Custom function
    async customFunction(req, res) {
        res.json({ message: 'Custom function untuk t_inventory_reservations', body: req.body, query: req.query });
    },
    async getFile(req, res) {
        const { folderPath } = req.body;

        // Basic validation: ensure folderPath is provided
        if (!folderPath) {
            return res.status(400).json({ message: 'Error: The "folderPath" field is required.' });
        }

        try {
            const targetPath = folderPath;

            // Check the status of the path
            const stats = await fs.stat(targetPath);

            // Check if it's a directory
            if (stats.isDirectory()) {
                // Read the directory contents
                const files = await fs.readdir(targetPath);

                // Send the list of files back to the client
                res.status(200).json({ path: targetPath, files: files, user: req.user || res.locals.user });
            } else {
                res.status(200).json({ exists: true, isDirectory: false, message: 'Path exists, but it is not a folder.' });
            }

        } catch (error) {
            // If the error code is 'ENOENT', it means the file or directory does not exist.
            if (error.code === 'ENOENT') {
                res.status(200).json({ exists: false, message: 'Folder does not exist.' });
            } else {
                // For any other errors, send a 500 server error response.
                console.error('Server Error:', error.message);
                res.status(500).json({ message: 'An internal server error occurred.' + error.message });
            }
        }
    },
    async downloadFile(req, res) {
        // We get the file path from a query parameter, e.g., /download?file=my-folder/my-file.txt
        const { file } = req.query;

        if (!file) {
            return res.status(400).json({ message: 'Error: The "file" query parameter is required.' });
        }

        const targetPath = file;

        // Use res.download to send the file.
        // Express handles Content-Type and Content-Disposition headers.
        res.download(targetPath, (err) => {
            if (err) {
                // Handle errors, such as file not found
                if (err.code === 'ENOENT') {
                    res.status(404).send('File not found.');
                } else {
                    console.error('Download error:', err);
                    // Avoid sending another response if one has already been sent
                    if (!res.headersSent) {
                        res.status(500).send('An internal server error occurred.');
                    }
                }
            }
        });
    }
};




