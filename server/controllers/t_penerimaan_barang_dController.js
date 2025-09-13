// Controller for t_penerimaan_barang_d
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_penerimaan_barang_d
//
// Tambahkan custom function di bawah ini

import { Op, literal, fn, col } from "sequelize";

export const t_penerimaan_barang_dController = {
    // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
    async uploadImage(req, res) {
        const fileFields = Object.keys(req.models.t_penerimaan_barang_d.rawAttributes).filter(
            key => req.models.t_penerimaan_barang_d.rawAttributes[key].type && req.models.t_penerimaan_barang_d.rawAttributes[key].type.key === 'STRING'
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
            const inserted = await req.models.t_penerimaan_barang_d.create(data);
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
            const inserted = await req.models.t_penerimaan_barang_d.bulkCreate(records);
            res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    // Contoh: Custom function
    async customList(req, res) {
        const {
            t_penerimaan_barang_d,
            t_purchase_order_d,
            m_item,
            m_gen,
        } = req.models;

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.paginate) || 10;
        const offset = (page - 1) * limit;
        const search = req.query.search;

        const where = {};
        const itemWhere = {};

        if (req.query.t_penerimaan_barang_id) {
            where.t_penerimaan_barang_id = req.query.t_penerimaan_barang_id;
        }

        if (search && search.trim() !== '') {
            itemWhere[Op.or] = [
                { name: { [Op.iLike]: `%${search}%` } },
                { code: { [Op.iLike]: `%${search}%` } },
            ];
        }

        if (req.query.code && req.query.code.trim() !== '') {
            itemWhere.code = { [Op.iLike]: `%${req.query.code.trim()}%` };
        }

        if (req.query.item_name && req.query.item_name.trim() !== '') {
            itemWhere.name = { [Op.iLike]: `%${req.query.item_name.trim()}%` };
        }

        if (req.query.notes && req.query.notes.trim() !== '') {
            where.notes = { [Op.iLike]: `%${req.query.notes.trim()}%` };
        }

        if (req.query.qty_receipt && req.query.qty_receipt.trim() !== '') {
            where.qty_receipt = { [Op.eq]: req.query.qty_receipt.trim() };
        }

        const include = [
            {
                model: m_item,
                as: 'pbDetailItem',
                required: true,
                where: Object.keys(itemWhere).length > 0 ? itemWhere : undefined,
                include: [
                    {
                        model: m_gen,
                        as: 'itemUom',
                        attributes: ['id', 'value1']
                    }
                ]
            },
            {
                model: t_purchase_order_d,
                as: 'pbDetailPurchaseOrderDetail',
                attributes: ['id', 'purchase_order_id', 'qty', 'reference_supplier', 'uom', 'item_uom_id']
            }
        ];

        const { count, rows } = await t_penerimaan_barang_d.findAndCountAll({
            include,
            where,
            limit,
            offset,
            subQuery: false
        });

        const total = Array.isArray(count) ? count.length : count;
        const totalPages = Math.ceil(total / limit);

        return res.json({
            status: "success",
            data: rows,
            pagination: {
                total,
                page,
                totalPages,
                limit,
                currentRowsCount: rows.length,
                next_page: page < totalPages ? page + 1 : null,
                prev_page: page > 1 ? page - 1 : null
            }
        });
    },

    async getAvailablePBDetails(req, res) {
        const {
            t_purchase_order_d,
            t_purchase_request,
            t_purchase_request_d,
            t_penerimaan_barang_d,
            t_penerimaan_barang,
            m_item,
            m_gen,
        } = req.models;

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.paginate) || 10;
        const offset = (page - 1) * limit;
        const search = req.query.search; // mencari nama/kode di relasi m_item

        const where = {};
        let itemWhere = {};

        // Filter berdasarkan ID purchase order
        if (req.query.purchase_order_id) {
            where.purchase_order_id = req.query.purchase_order_id;
        }

        // Implementasi search untuk nama/kode item
        if (search) {
            itemWhere[Op.or] = [
                { name: { [Op.iLike]: `%${search}%` } },
                { code: { [Op.iLike]: `%${search}%` } }
            ];
        }

        const include = [
            {
                model: m_item,
                as: 'poDetailItem',
                attributes: ['id', 'code', 'name'],
                required: true,
                where: Object.keys(itemWhere).length > 0 ? itemWhere : undefined,
            },
            {
                model: m_gen,
                as: 'poDetailUom',
                attributes: ['id', 'value1'],
                required: false
            },
            {
                model: t_purchase_request,
                as: 'poDetailPrRequest',
                attributes: ['id', 'code'],
                required: false
            },
            {
                model: t_purchase_request_d,
                as: 'poDetailPrDetail',
                attributes: ['id', 'notes', 'item_uom_id', 'item_uom'],
                required: false
            },
        ];


        const { count, rows } = await t_purchase_order_d.findAndCountAll({
            attributes: {
                include: [
                    [
                        literal(`(
                            SELECT COALESCE(SUM(pbd.qty_receipt), 0) 
                            FROM t_penerimaan_barang_d pbd
                            JOIN t_penerimaan_barang pb ON pbd.t_penerimaan_barang_id = pb.id
                            WHERE pbd.purchase_order_d_id = t_purchase_order_d.id 
                            AND pb.status = 'POSTED'
                        )`), 
                        'qty_received'
                    ],
                    [
                        literal(`(
                            SELECT COALESCE(SUM(pocd.qty), 0) 
                            FROM t_purchase_order_closing_d pocd
                            JOIN t_purchase_order_closing poc ON pocd.purchase_order_closing_id = poc.id
                            WHERE pocd.purchase_order_d_id = t_purchase_order_d.id 
                            AND poc.id IS NOT NULL
                        )`), 
                        'qty_closing'
                    ],
                    [
                        literal(`(
                            SELECT pord.qty
                            FROM t_purchase_order_revision_d pord
                            WHERE pord.purchase_order_d_id = t_purchase_order_d.id
                            LIMIT 1
                        )`), 
                        'qty_po_revision'
                    ],
                    [
                        literal(`(
                            SELECT pord.id
                            FROM t_purchase_order_revision_d pord
                            WHERE pord.purchase_order_d_id = t_purchase_order_d.id
                            LIMIT 1
                        )`), 
                        'po_revision_id'
                    ]
                ]
            },
            include,
            where: {
                ...where,
                [Op.and]: [
                    literal(`t_purchase_order_d.qty > (
                        SELECT COALESCE(SUM(pbd.qty_receipt), 0) 
                        FROM t_penerimaan_barang_d pbd
                        JOIN t_penerimaan_barang pb ON pbd.t_penerimaan_barang_id = pb.id
                        WHERE pbd.purchase_order_d_id = t_purchase_order_d.id 
                        AND pb.status = 'POSTED'
                    )`)
                ]
            },
            limit,
            offset,
            subQuery: false,
        });

        const total = Array.isArray(count) ? count.length : count;
        const totalPages = Math.ceil(total / limit);

        return res.json({
            status: "success",
            data: rows,
            pagination: {
                total,
                page,
                totalPages,
                limit,
                currentRowsCount: rows.length,
                next_page: page < totalPages ? page + 1 : null,
                prev_page: page > 1 ? page - 1 : null
            }
        });
    },
};
