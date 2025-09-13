// Controller for t_penerimaan_barang
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_penerimaan_barang
//
// Tambahkan custom function di bawah ini

import { user as user_default } from '../models/index.js';
import { Op, literal } from "sequelize";

export const t_penerimaan_barangController = {
    // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
    async uploadImage(req, res) {
        const fileFields = Object.keys(req.models.t_penerimaan_barang.rawAttributes).filter(
            key => req.models.t_penerimaan_barang.rawAttributes[key].type && req.models.t_penerimaan_barang.rawAttributes[key].type.key === 'STRING'
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
            const inserted = await req.models.t_penerimaan_barang.create(data);
            res.json({ message: 'Image uploaded', data: inserted });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async generateCode(req, res) {
        const params = req.query;
        const code = await getCodeStructure(req.models.t_penerimaan_barang, params.menu_id, params.unit_bussiness_id)
        if (code.status === 'err') {
            res.json(errorResponse(code.error))
        }
        res.json(successResponse(code.data))
    },

    async insertInventory(req, res) {
        const {
            item_id,
            warehouse_id,
            quantity,
            transactionTypeName,
            unitCost,
            reference_id,
            reference_source,
            batchNumber,
            expirationDate
        } = req.body;

        const result = await inventoryService.insertStock({
            item_id,
            warehouse_id,
            quantity,
            transactionTypeName,
            unitCost: unitCost || null,
            reference_id: reference_id || null,
            reference_source: reference_source || null,
            batchNumber: batchNumber || null,
            expirationDate: expirationDate || null,
        });

        if (result.status === 'err') {
            res.json(errorResponse(result.error));
        }
        res.json(successResponse(result.data));
    },


    // Contoh: Import Excel ke database
    async importExcel(req, res) {
        if (!req.excelData) return res.status(400).json({ error: 'No Excel data' });
        const [header, ...rows] = req.excelData;
        const records = rows.map(row => Object.fromEntries(header.map((h, i) => [h, row[i]])));
        try {
            const inserted = await req.models.t_penerimaan_barang.bulkCreate(records);
            res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    // Report Summary
    async summaryReportIndex(req, res) {
        const {
            t_penerimaan_barang,
            t_purchase_order,
            m_unit_bussiness,
            m_supplier,
            t_penerimaan_barang_d,
            m_item,
        } = req.models;

        const {
            unit_bussiness_id,
            start_date,
            end_date,
            status,
            purchase_request_id,
            purchase_order_id,
            supplier_id,
            id,
            menu_id,
            auth_user_id,
            order_by,
            order_as,
            withPagination // <- ambil dari query
        } = req.query;

        const usePagination = withPagination !== 'false'; // default: true

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.paginate) || 10;
        const offset = (page - 1) * limit;

        const orderDirection = order_as?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

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

        if (purchase_order_id) {
            whereClause.purchase_order_id = purchase_order_id;
        }

        if (supplier_id) {
            whereClause.supplier_id = supplier_id;
        }

        if (id) {
            whereClause.id = id;
        }

        const include = [
            {
                model: m_unit_bussiness,
                as: 'pbCompany',
                attributes: ['name'],
                required: false
            },
            {
                model: m_supplier,
                as: 'pbSupplier',
                attributes: ['code', 'name'],
                required: false
            },
            {
                model: t_purchase_order,
                as: 'pbPurchaseOrder',
                attributes: ['code', 'date'],
                required: false
            },
            {
                model: user_default,
                as: 'pbPostedBy',
                attributes: ['name'],
                required: false
            },
            {
                model: user_default,
                as: 'pbCreatedBy',
                attributes: ['name'],
                required: false
            },
        ];

        let order = [];
        if (order_by === 'po_code') {
            order = [[{ model: t_purchase_order, as: 'pbPurchaseOrder' }, 'code', orderDirection]];
        } else {
            order = [['date', 'DESC']];
        }

        const queryOptions = {
            where: whereClause,
            include,
            attributes: {
                include: [
                    [
                        literal(`(
                        SELECT SUM(mi.actual_weight * COALESCE(pb_d.qty_receipt, 0))
                        FROM "t_penerimaan_barang_d" AS pb_d
                        JOIN "m_item" AS mi ON mi.id = pb_d.item_id
                        WHERE pb_d.t_penerimaan_barang_id = "t_penerimaan_barang"."id"
                        )`),
                        'total_weight'
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

        const { count, rows } = await t_penerimaan_barang.findAndCountAll(queryOptions);

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

    // Report Summary
    async detailReportIndex(req, res) {
        const {
            m_gen,
            t_penerimaan_barang,
            t_purchase_order,
            m_unit_bussiness,
            m_supplier,
            t_penerimaan_barang_d,
            t_purchase_order_d,
            m_item,
            m_warehouse,
        } = req.models;

        const {
            unit_bussiness_id,
            start_date,
            end_date,
            status,
            purchase_request_id,
            purchase_order_id,
            supplier_id,
            id,
            menu_id,
            auth_user_id,
            order_by,
            order_as,
            withPagination // <- ambil dari query
        } = req.query;

        const usePagination = withPagination !== 'false'; // default: true

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.paginate) || 10;
        const offset = (page - 1) * limit;

        const orderDirection = order_as?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

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

        if (purchase_order_id) {
            whereClause.purchase_order_id = purchase_order_id;
        }

        if (supplier_id) {
            whereClause.supplier_id = supplier_id;
        }

        if (id) {
            whereClause.id = id;
        }

        const include = [
            {
                model: t_purchase_order,
                as: 'pbDetailPurchaseOrder',
                attributes: ['code', 'date'],
                required: false
            },
            {
                model: t_purchase_order_d,
                as: 'pbDetailPurchaseOrderDetail',
                attributes: ['qty', 'item_name'],
                required: false
            },
            {
                model: m_item,
                as: 'pbDetailItem',
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
                model: t_penerimaan_barang,
                as: 'pbDetailPenerimaanBarang',
                where: whereClause,
                required: true,
                include: [
                    {
                        model: m_unit_bussiness,
                        as: 'pbCompany',
                        attributes: ['name'],
                        required: false
                    },
                    {
                        model: m_warehouse,
                        as: 'pbWarehouse',
                        attributes: ['name'],
                        required: false
                    },
                    {
                        model: user_default,
                        as: 'pbPostedBy',
                        attributes: ['name'],
                        required: false
                    },
                    {
                        model: user_default,
                        as: 'pbCreatedBy',
                        attributes: ['name'],
                        required: false
                    },
                ]
            },
        ];

        let order = [];
        if (order_by === 'po_code') {
            order = [[{ model: t_purchase_order, as: 'pbDetailPurchaseOrder' }, 'code', orderDirection]];
        } else {
            order = [['createdAt', 'DESC']];
        }

        const queryOptions = {
            include,
            order,
        };

        // Tambahkan paginasi jika diinginkan
        if (usePagination) {
            queryOptions.limit = limit;
            queryOptions.offset = offset;
        }

        const { count, rows } = await t_penerimaan_barang_d.findAndCountAll(queryOptions);

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

    async getAvailablePos(req, res) {
        const {
            t_purchase_order,
            t_purchase_order_d,
            t_penerimaan_barang_d,
            t_penerimaan_barang,
            m_supplier
        } = req.models;

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.paginate) || 10;
        const offset = (page - 1) * limit;
        const search = req.query.search; // mencari code PO atau nama supplier

        let where = {
            status: 'APPROVED' // Hanya PO yang sudah di approve
        };

        if (req.query.unit_bussiness_id) {
            where.unit_bussiness_id = req.query.unit_bussiness_id;
        }

        if (req.query.item_type_id) {
            where.item_type_id = req.query.item_type_id;
        }

        // Implementasi search untuk code PO atau nama supplier
        if (search) {
            where[Op.or] = [
                { code: { [Op.iLike]: `%${search}%` } },
                // { '$poSupplier.name$': { [Op.iLike]: `%${search}%` } }
            ];
        }

        const include = [
            {
                model: m_supplier,
                as: 'poSupplier',
                attributes: ['name'],
                required: false
            },
            {
                model: t_purchase_order_d,
                as: 'poDetails',
                attributes: ['id'], // Minimal attributes untuk pengecekan saja
                // Hanya ambil detail yang masih ada outstanding quantity
                where: literal(`
                    "poDetails".qty > (
                        COALESCE((
                            SELECT SUM(pbd.qty_receipt)
                            FROM t_penerimaan_barang_d pbd
                            JOIN t_penerimaan_barang pb ON pbd.t_penerimaan_barang_id = pb.id
                            WHERE pbd.purchase_order_d_id = "poDetails".id 
                            AND pb.status = 'POSTED'
                        ), 0)
                        +
                        COALESCE((
                            SELECT SUM(pocd.qty)
                            FROM t_purchase_order_closing_d pocd
                            JOIN t_purchase_order_closing poc ON pocd.purchase_order_closing_id = poc.id
                            WHERE pocd.purchase_order_d_id = "poDetails".id 
                            AND poc.status = 'POSTED'
                        ), 0)
                    )
                `),
                required: true // Harus ada minimal 1 detail yang outstanding
            }
        ];

        const { count, rows } = await t_purchase_order.findAndCountAll({
            include,
            where,
            limit,
            offset,
            order: [['code', 'DESC']],
            subQuery: false,
            distinct: true
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
