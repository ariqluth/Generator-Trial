// Controller for m_supplier
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.m_supplier
//
// Tambahkan custom function di bawah ini

export const m_supplierController = {
    // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
    async patchFileById(req, res) {
        try {
            const file = req.files[0]

            const data = {}
            data[file.fieldname] = removeLocalPath(file.path)

            await req.models.m_supplier.update(data, { where: { id: req.body.id } });
            res.status(200).json({ status: 'success' })
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
            const inserted = await req.models.m_supplier.bulkCreate(records);
            res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async generateCode(req, res) {
        const params = req.query;
        const code = await getCodeStructure(req.models.m_supplier, params.menu_id)
        if (code.status === 'err') {
            res.json(errorResponse(code.error))
        }
        res.json(successResponse(code.data))
    }
};
