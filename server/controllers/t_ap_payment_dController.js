// Controller for t_ap_payment_d
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_ap_payment_d
//
// Tambahkan custom function di bawah ini

import { col, Op, literal, fn, QueryTypes } from "sequelize";

export const t_ap_payment_dController = {
    // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
    async uploadImage(req, res) {
        const fileFields = Object.keys(req.models.t_ap_payment_d.rawAttributes).filter(
            key => req.models.t_ap_payment_d.rawAttributes[key].type && req.models.t_ap_payment_d.rawAttributes[key].type.key === 'STRING'
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
            const inserted = await req.models.t_ap_payment_d.create(data);
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
            const inserted = await req.models.t_ap_payment_d.bulkCreate(records);
            res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    // get Outstanding PI
    async getOutstandingPi(req, res) {
        const { t_purchase_invoice, t_ap_payment_d } = req.models;

        const ids = req.query.ids?.split(",") || [];

        if (!ids.length) {
            return res.status(400).json({ message: "Parameter ids required" });
        }

        // Buat placeholder untuk IN clause
        const placeholders = ids.map(() => '?').join(',');

        const query = `
            SELECT 
                tpi.id,
                tpi.grand_total,
                COALESCE(SUM(tapd.total_payment), 0) AS ap_total_payment,
                tpi.grand_total - COALESCE(SUM(tapd.total_payment), 0) AS outstanding
            FROM t_purchase_invoice tpi
            LEFT JOIN t_ap_payment_d tapd ON tpi.id = tapd.pi_id
            WHERE tpi.id IN (${placeholders})
            GROUP BY tpi.id, tpi.grand_total
        `;

        const result = await t_purchase_invoice.sequelize.query(query, {
            replacements: ids,
            type: QueryTypes.SELECT
        });

        return res.json({ data: result, status: "success" });

    }
};
