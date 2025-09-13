// Controller for t_purchase_order_d
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_purchase_order_d
//
// Tambahkan custom function di bawah ini

import user_default from '../models/user_default.js'
import { literal, Op, fn, col } from "sequelize";

export const t_purchase_order_dController = {
    // Contoh: Upload gambar ke database (kolom image: Buffer/BLOB)
    async uploadImage(req, res) {
        const imageFile = req.files?.find(f => f.mimetype.startsWith('image/'));
        if (!imageFile) return res.status(400).json({ error: 'No image file found' });
        try {
            const inserted = await req.models.t_purchase_order_d.create({ image: imageFile.buffer });
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
            const inserted = await req.models.t_purchase_order_d.bulkCreate(records);
            res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async summaryReportIndex(req, res) {
        const {
            t_penerimaan_barang,
            t_purchase_order,
            m_unit_bussiness,
            m_supplier,
            m_currency,
            m_item,
        } = req.models;

        const {
            unit_bussiness_id,
            start_date,
            end_date,
            status,
            purchase_request_id,
            item_type_id,
            supplier_id,
            id,
            menu_id,
            auth_user_id,
            withPagination // <- ambil dari query
        } = req.query;

        const usePagination = withPagination !== 'false'; // default: true

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.paginate) || 10;
        const offset = (page - 1) * limit;

        // const orderDirection = order_as?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        const whereClause = {};

        if (unit_bussiness_id) {
            const ids = unit_bussiness_id.split(",");
            whereClause.unit_bussiness_id = { [Op.in]: ids };
        }

        function getStartOfDay(dateStr) {
            const d = new Date(dateStr);
            d.setHours(0, 0, 0, 0);
            return d;
        }

        function getEndOfDay(dateStr) {
            const d = new Date(dateStr);
            d.setHours(23, 59, 59, 999);
            return d;
        }

        if (start_date && end_date) {
            const startDate = getStartOfDay(start_date);
            const endDate = getEndOfDay(end_date);

            whereClause.date = { [Op.between]: [startDate, endDate] };
        } else if (start_date) {
            whereClause.date = { [Op.gte]: getStartOfDay(start_date) };
        } else if (end_date) {
            whereClause.date = { [Op.lte]: getEndOfDay(end_date) };
        }

        if (status && status !== "all") {
            whereClause.status = status;
        }

        if (purchase_request_id) {
            whereClause.purchase_request_id = purchase_request_id;
        }

        if (id) {
            whereClause.id = id;
        }

        if (supplier_id) {
            whereClause.supplier_id = supplier_id;
        }

        if (item_type_id) {
            whereClause.item_type_id = item_type_id;
        }

        const include = [
            {
                model: m_unit_bussiness,
                as: 'poCompany',
                attributes: ['name'],
                required: false
            },
            {
                model: m_supplier,
                as: 'poSupplier',
                attributes: ['code', 'name'],
                required: false
            },
            {
                model: m_currency,
                as: 'poCurrency',
                attributes: ['code', 'name'],
                required: false
            },
            {
                model: user_default,
                as: 'poCreatedBy',
                attributes: ['name'],
                required: false
            },
        ];

        let order = [['date', 'DESC']];


        const queryOptions = {
            where: whereClause,
            include,
            attributes: {
                include: [
                    [
                        literal(`(
                            SELECT ud.name
                            FROM t_purchase_order_approval AS poa
                            JOIN user_default AS ud ON ud.id = poa.user_id
                            WHERE poa.purchase_order_id = t_purchase_order.id
                            AND poa.is_active = true
                            AND poa.status = 'APPROVED'
                            ORDER BY poa.approved_at DESC
                            LIMIT 1
                        )`),
                        'approved_by'
                    ],
                    [
                        literal(`(
                            SELECT poa.approved_at
                            FROM t_purchase_order_approval AS poa
                            WHERE poa.purchase_order_id = t_purchase_order.id
                            AND poa.is_active = true
                            AND poa.status = 'APPROVED'
                            ORDER BY poa.approved_at DESC
                            LIMIT 1
                        )`),
                        'approved_at'
                    ]
                ]
            },
            order,
        };

        // Tambahkan paginasi jika diinginkan
        if (usePagination) {
            queryOptions.limit = limit;
            queryOptions.offset = offset;
        }

        const { count, rows } = await t_purchase_order.findAndCountAll(queryOptions);

        const totalPages = usePagination ? Math.ceil(count / limit) : 1;

        return res.json({
            status: "success",
            data: rows,
            pagination: {
                total: count,
                page: usePagination ? page : 1,
                totalPages: usePagination ? totalPages : 1,
                limit: usePagination ? limit : count,
                currentRowsCount: rows.length,
                next_page: usePagination && page < totalPages ? page + 1 : null,
                prev_page: usePagination && page > 1 ? page - 1 : null,
            },
        });
    },

    async detailReportIndex(req, res) {
        const {
            m_gen,
            t_purchase_order,
            m_unit_bussiness,
            m_supplier,
            t_purchase_order_d,
            m_item,
            m_currency,
        } = req.models;

        const {
            unit_bussiness_id,
            start_date,
            end_date,
            status,
            purchase_request_id,
            item_type_id,
            supplier_id,
            id,
            menu_id,
            auth_user_id,
            item_id,
            withPagination
        } = req.query;

        const usePagination = withPagination !== 'false';

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.paginate) || 10;
        const offset = (page - 1) * limit;

        const whereClause = {};

        if (unit_bussiness_id) {
            const ids = unit_bussiness_id.split(",");
            whereClause.unit_bussiness_id = { [Op.in]: ids };
        }

        function getStartOfDay(dateStr) {
            const d = new Date(dateStr);
            d.setHours(0, 0, 0, 0);
            return d;
        }

        function getEndOfDay(dateStr) {
            const d = new Date(dateStr);
            d.setHours(23, 59, 59, 999);
            return d;
        }

        if (start_date && end_date) {
            const startDate = getStartOfDay(start_date);
            const endDate = getEndOfDay(end_date);

            whereClause.date = { [Op.between]: [startDate, endDate] };
        } else if (start_date) {
            whereClause.date = { [Op.gte]: getStartOfDay(start_date) };
        } else if (end_date) {
            whereClause.date = { [Op.lte]: getEndOfDay(end_date) };
        }

        if (status && status !== "all") {
            whereClause.status = status;
        }

        if (purchase_request_id) {
            whereClause.purchase_request_id = purchase_request_id;
        }

        if (id) {
            whereClause.id = id;
        }

        if (supplier_id) {
            whereClause.supplier_id = supplier_id;
        }

        if (item_type_id) {
            whereClause.item_type_id = item_type_id;
        }

        const whereItemClaude = {};

        if (item_id) {
            whereItemClaude.item_id = item_id;
        }

        const include = [
            {
                model: m_item,
                as: 'poDetailItem',
                attributes: ['id', 'code', 'name', 'actual_weight'],
                required: false,
                include: [
                    {
                        model: m_gen,
                        as: 'itemUom',
                        attributes: ['id', 'value1'],
                        required: false
                    }
                ]
            },
            {
                model: t_purchase_order,
                as: 'poDetail',
                attributes: {
                    include: [
                        [
                            literal(`(
                                SELECT ud.name
                                FROM t_purchase_order_approval AS poa
                                JOIN user_default AS ud ON ud.id = poa.user_id
                                WHERE poa.purchase_order_id = "poDetail"."id"
                                AND poa.is_active = true
                                AND poa.status = 'APPROVED'
                                ORDER BY poa.approved_at DESC
                                LIMIT 1
                            )`),
                            'approved_by'
                        ],
                        [
                            literal(`(
                                SELECT poa.approved_at
                                FROM t_purchase_order_approval AS poa
                                WHERE poa.purchase_order_id = "poDetail"."id"
                                AND poa.is_active = true
                                AND poa.status = 'APPROVED'
                                ORDER BY poa.approved_at DESC
                                LIMIT 1
                            )`),
                            'approved_at'
                        ]
                    ]
                },
                where: whereClause,
                required: true,
                include: [
                    {
                        model: m_unit_bussiness,
                        as: 'poCompany',
                        attributes: ['name'],
                        required: false
                    },
                    {
                        model: m_supplier,
                        as: 'poSupplier',
                        attributes: ['code', 'name'],
                        required: false
                    },
                    {
                        model: m_currency,
                        as: 'poCurrency',
                        attributes: ['code', 'name'],
                        required: false
                    },
                    {
                        model: user_default,
                        as: 'poCreatedBy',
                        attributes: ['name'],
                        required: false
                    },
                ]
            },
        ];

        let order = [['createdAt', 'DESC']];

        const queryOptions = {
            include,
            attributes: {
                include: [
                    [
                        literal(`COALESCE(
                            NULLIF((SELECT MAX(qty) FROM t_purchase_order_revision_d 
                            WHERE t_purchase_order_revision_d.purchase_order_d_id = t_purchase_order_d.id), 0),
                            t_purchase_order_d.qty
                        )`),
                        'qty_po'
                    ],
                    [
                        literal(`COALESCE(
                            (SELECT CAST(SUM(pocd.qty) AS INTEGER)
                            FROM t_purchase_order_closing_d AS pocd
                            JOIN t_purchase_order_closing AS poc ON poc.id = pocd.purchase_order_closing_id
                            WHERE pocd.purchase_order_d_id = "t_purchase_order_d"."id"
                            AND poc.status = 'POSTED'),
                            0
                        )`),
                        'qty_closed'
                    ],
                    [
                        literal(`COALESCE(
                            (SELECT CAST(SUM(pbd.qty_receipt) AS INTEGER)
                            FROM t_penerimaan_barang_d AS pbd
                            JOIN t_penerimaan_barang AS pb ON pb.id = pbd.t_penerimaan_barang_id
                            WHERE pbd.purchase_order_d_id = "t_purchase_order_d"."id"
                            AND pb.status = 'POSTED'),
                            0
                        )`),
                        'qty_lpb'
                    ],
                    [
                        literal(`COALESCE(
                            (SELECT CAST(SUM(prd.qty) AS INTEGER)
                            FROM t_purchase_return_d AS prd
                            JOIN t_purchase_return AS pr ON pr.id = prd.t_purchase_return_id
                            WHERE prd.purchase_order_d_id = "t_purchase_order_d"."id"
                            AND pr.status = 'POSTED'),
                            0
                        )`),
                        'qty_return'
                    ]
                ]
            },
            where: whereItemClaude,
            order,
        };

        if (usePagination) {
            queryOptions.limit = limit;
            queryOptions.offset = offset;
        }

        const { count, rows } = await t_purchase_order_d.findAndCountAll(queryOptions);

        const totalPages = usePagination ? Math.ceil(count / limit) : 1;

        return res.json({
            status: "success",
            data: rows,
            pagination: {
                total: count,
                page: usePagination ? page : 1,
                totalPages: usePagination ? totalPages : 1,
                limit: usePagination ? limit : count,
                currentRowsCount: rows.length,
                next_page: usePagination && page < totalPages ? page + 1 : null,
                prev_page: usePagination && page > 1 ? page - 1 : null,
            },
        });
    }
};
