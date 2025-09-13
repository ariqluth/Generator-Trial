// Controller for t_purchase_order_closing_d
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_purchase_order_closing_d
//
// Tambahkan custom function di bawah ini

import { Op, fn, col } from "sequelize";

export const t_purchase_order_closing_dController = {
    // Contoh: Upload gambar ke database (kolom image: Buffer/BLOB)
    async uploadImage(req, res) {
        const imageFile = req.files?.find(f => f.mimetype.startsWith('image/'));
        if (!imageFile) return res.status(400).json({ error: 'No image file found' });
        try {
            const inserted = await req.models.t_purchase_order_closing_d.create({ image: imageFile.buffer });
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
            const inserted = await req.models.t_purchase_order_closing_d.bulkCreate(records);
            res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    // Contoh: Custom function
    async customFunction(req, res) {
        res.json({ message: 'Custom function untuk t_purchase_order_closing_d', body: req.body, query: req.query });
    },

    async getQtySudahClosing(req, res) {
        const {
            t_purchase_order_closing_d,
            t_purchase_order_closing,
        } = req.models;

        const ids = req.query.ids?.split(",") || [];

        if (!ids.length) {
            return res.status(400).json({ message: "Parameter ids required" });
        }

        // hitung qty_sudah_closing per purchase_order_d_id
        const qtyMap = await t_purchase_order_closing_d.findAll({
            attributes: [
                "purchase_order_d_id",
                [fn("SUM", col("qty")), "qty_sudah_closing"],
            ],
            include: [
                {
                    model: t_purchase_order_closing,
                    as: "poClosingDetail", // alias relasi header
                    attributes: [],
                    where: { status: "POSTED" },
                    required: true
                },
            ],
            where: { purchase_order_d_id: { [Op.in]: ids } },
            group: ["purchase_order_d_id"],
            raw: true,
        });

        return res.json({ data: qtyMap, status: "success" });

    },
};
