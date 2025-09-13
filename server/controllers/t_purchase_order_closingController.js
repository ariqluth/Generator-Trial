// Controller for t_purchase_order_closing
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_purchase_order_closing
//
// Tambahkan custom function di bawah ini

import { literal } from "sequelize";
import { user as user_default } from '../models/index.js';

export const t_purchase_order_closingController = {
    // Contoh: Upload gambar ke database (kolom image: Buffer/BLOB)
    async uploadImage(req, res) {
        const imageFile = req.files?.find(f => f.mimetype.startsWith('image/'));
        if (!imageFile) return res.status(400).json({ error: 'No image file found' });
        try {
            const inserted = await req.models.t_purchase_order_closing.create({ image: imageFile.buffer });
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
            const inserted = await req.models.t_purchase_order_closing.bulkCreate(records);
            res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    // Contoh: Custom function
    async customFunction(req, res) {
        res.json({ message: 'Custom function untuk t_purchase_order_closing', body: req.body, query: req.query });
    },

    async customGetById(req, res) {
        const { id } = req.query;
        const {
            m_gen,
            t_purchase_order,
            m_unit_bussiness,
            m_item,
            t_purchase_order_closing,
            t_purchase_order_closing_d,
        } = req.models;

        const data = await t_purchase_order_closing.findByPk(id, {
            include: [
                {
                    model: m_gen,
                    as: "poCloseItemType",
                    attributes: ["id", "value1"]
                },
                {
                    model: user_default,
                    as: "poClosingCreatedBy",
                    attributes: ["name"],
                },
                {
                    model: user_default,
                    as: "poClosingUpdatedBy",
                    attributes: ["name"],
                },
                {
                    model: t_purchase_order,
                    as: "poClosePurchaseOrder",
                    attributes: ["id", "code", "date"],
                    include: [
                        {
                            model: m_unit_bussiness,
                            as: "poCompany",
                            attributes: ["id", "name"]
                        },
                        {
                            model: m_unit_bussiness,
                            as: "poShipCompany",
                            attributes: ["id", "name"]
                        },
                    ]
                },
                {
                    model: t_purchase_order_closing_d,
                    as: "poClosingDetails", // pastikan sesuai alias di associations
                    attributes: {
                        include: [
                            [
                                literal(`(
                                    SELECT COALESCE(SUM(d.qty), 0)
                                    FROM t_purchase_order_closing_d d
                                    JOIN t_purchase_order_closing h
                                    ON d.purchase_order_closing_id = h.id
                                    WHERE d.purchase_order_d_id = "poClosingDetails"."purchase_order_d_id"
                                    AND h.status = 'POSTED'
                                )`),
                                "qty_sudah_closing",
                            ],
                        ],
                    },
                    include: [
                        {
                            model: m_item,
                            as: "poClosingItem", // alias sesuai relasi
                            attributes: ["id", "code", "name"],
                        },
                    ],
                },
            ],
        });

        if (!data) {
            return res.status(404).json({ message: "Data not found" });
        }

        return res.json({
            data: data,
            status: "success"
        });

    },
};
