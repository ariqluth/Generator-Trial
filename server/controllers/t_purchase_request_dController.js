// Controller for t_purchase_request_d
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_purchase_request_d
//
// Tambahkan custom function di bawah ini

import { Op, literal } from "sequelize";

export const t_purchase_request_dController = {
    // Contoh: Upload gambar ke database (kolom image: Buffer/BLOB)
    async uploadImage(req, res) {
        const imageFile = req.files?.find(f => f.mimetype.startsWith('image/'));
        if (!imageFile) return res.status(400).json({ error: 'No image file found' });
        try {
            const inserted = await req.models.t_purchase_request_d.create({ image: imageFile.buffer });
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
            const inserted = await req.models.t_purchase_request_d.bulkCreate(records);
            res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    // Contoh: Custom function
    async customFunction(req, res) {
        res.json({ message: 'Custom function untuk t_purchase_request_d', body: req.body, query: req.query });
    },

    async outstandingList(req, res) {
        const {
            t_purchase_order_d,
            t_purchase_order,
            t_purchase_request_closing_d,
            t_purchase_request_d,
            t_purchase_request,
            m_item
        } = req.models;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.paginate) || 10;
        const offset = (page - 1) * limit;

        const { filter_column_item_code, filter_column_item_name, filter_column_notes } = req.query;

        const searchConditions = buildSearchQuery(req.query.search || null, req.query.searchfield || null);

        const where = {};

        if (filter_column_item_code) {
            where.item_code = { [Op.iLike]: `%${filter_column_item_code}%` };
        }

        if (filter_column_item_name) {
            where.item_name = { [Op.iLike]: `%${filter_column_item_name}%` };
        }

        if (filter_column_notes) {
            where.notes = { [Op.iLike]: `%${filter_column_notes}%` };
        }

        const include = [
            {
                model: t_purchase_request,
                as: 'purchaseRequestDetail',
                required: true,
                attributes: ['code', 'status'],
                where: { status: 'APPROVED' }
            },
            {
                model: t_purchase_order_d,
                as: 'poDetailPrDetails',
                attributes: [],
                include: [
                    {
                        model: t_purchase_order,
                        as: 'poDetail',
                        required: true,
                        attributes: [],
                    }
                ]
            },
            {
                model: t_purchase_request_closing_d,
                as: 'prcDetails',
                attributes: []
            },
            {
                model: m_item,
                as: 'purchaseRequestDetailItem', 
                attributes: ['excess_tolerance'],
                required: false,
            }
        ];

        if (searchConditions.length > 0) {
            where[Op.or] = searchConditions;
        }

        if (req.query.purchase_request_id) {
            where.purchase_request_id = req.query.purchase_request_id;
        }

        if (req.query.item_type_id) {
            include.push({
                model: m_item,
                as: 'purchaseRequestDetailItem',
                attributes: [],
                required: true,
                where: {
                    item_type_id: req.query.item_type_id,
                }
            })
        }

        const { count, rows } = await t_purchase_request_d.findAndCountAll({
            attributes: [
                'id',
                'purchase_request_id',
                'item_id',
                'item_code',
                'item_name',
                'item_uom',
                'item_uom_id',
                'on_hand',
                'qty',
                [
                    literal(`COALESCE(SUM("poDetailPrDetails"."qty"), 0)`),
                    'qty_po'
                ],
                [
                    literal(`COALESCE(SUM("prcDetails"."qty_closing"), 0)`),
                    'qty_pr_closing'
                ],
                [
                    literal(`"t_purchase_request_d"."qty"
                        - COALESCE(SUM("poDetailPrDetails"."qty"), 0)
                        - COALESCE(SUM("prcDetails"."qty_closing"), 0)`),
                    'qty_outstanding'
                ],
                'notes',
            ],
            include,
            where,
            group: [
                't_purchase_request_d.id',
                'purchaseRequestDetail.id',
                'purchaseRequestDetailItem.id'
            ],
            having: literal(`("t_purchase_request_d"."qty"
                            - COALESCE(SUM("poDetailPrDetails"."qty"), 0)
                            - COALESCE(SUM("prcDetails"."qty_closing"), 0)) > 0`),
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
    }
};
