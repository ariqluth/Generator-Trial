// Controller for m_pricelist
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.m_pricelist
//
// Tambahkan custom function di bawah ini

export const m_pricelistController = {
    // Contoh: Upload gambar ke database (kolom image: Buffer/BLOB)
    async uploadImage(req, res) {
        const imageFile = req.files?.find(f => f.mimetype.startsWith('image/'));
        if (!imageFile) return res.status(400).json({ error: 'No image file found' });
        try {
        const inserted = await req.models.m_pricelist.create({ image: imageFile.buffer });
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
        const inserted = await req.models.m_pricelist.bulkCreate(records);
        res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
        res.status(500).json({ error: err.message });
        }
    },

    async createPricelist(req, res) {
        const payload = req.body;

        try {
            const { item_id, unit_bussiness_id, price } = payload;

            // Cek apakah data sudah ada
            const existing = await req.models.m_pricelist.findOne({
                where: {
                    item_id,
                    unit_bussiness_id
                }
            });

            let pricelist;

            if (existing) {
                // Update jika sudah ada
                await existing.update({ price });
                pricelist = existing;
            } else {
            // Insert jika belum ada
            pricelist = await req.models.m_pricelist.create({
                item_id,
                unit_bussiness_id,
                price
            });
            }

            // Insert ke history selalu
            await req.models.m_pricelist_history.create({
                pricelist_id: pricelist.id,
                price,
                date: new Date(),
            });

            const message = existing ? 'Pricelist updated' : 'Pricelist created';
            res.status(existing ? 200 : 201).json({ message, data: pricelist });

        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async updatePricelist(req, res) {
        const id = req.query.id;
        if (id === "") {
            return res.status(400).json({ error: 'ID Pricelist tidak ditemukan' });
        }

        const payload = req.body;

        try {
            const pricelist = await req.models.m_pricelist.findByPk(id);
            if (!pricelist) {
                return res.status(404).json({ error: 'Pricelist tidak ditemukan' });
            }

            // Update data utama
            await pricelist.update({
                item_id: payload.item_id,
                unit_bussiness_id: payload.unit_bussiness_id,
                price: payload.price
            });

            // Simpan perubahan ke history
            await req.models.m_pricelist_history.create({
                pricelist_id: pricelist.id,
                price: payload.price,
                date: new Date(),
            });

            res.status(200).json({ message: 'Pricelist updated', data: pricelist });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

};
