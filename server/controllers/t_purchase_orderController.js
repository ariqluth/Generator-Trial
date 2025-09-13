// Controller for t_purchase_order
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_purchase_order
//
// Tambahkan custom function di bawah ini

import t_purchase_request from '../models/t_purchase_request.js'
import t_purchase_order from '../models/t_purchase_order.js'
import t_purchase_order_d from '../models/t_purchase_order_d.js'
import t_purchase_order_closing from '../models/t_purchase_order_closing.js'
import t_purchase_order_closing_d from '../models/t_purchase_order_closing_d.js'
import t_purchase_order_revision_d from '../models/t_purchase_order_revision_d.js'
import t_purchase_return from '../models/t_purchase_return.js'
import t_purchase_return_d from '../models/t_purchase_return_d.js'
import t_penerimaan_barang from '../models/t_penerimaan_barang.js'
import t_penerimaan_barang_d from '../models/t_penerimaan_barang_d.js'
import m_supplier from '../models/m_supplier.js'
import m_item from '../models/m_item.js'
import user_default from '../models/user_default.js'
import { literal, Op, fn, col } from "sequelize";

export const t_purchase_orderController = {
    // Contoh: Upload gambar ke database (kolom image: Buffer/BLOB)
    async uploadImage(req, res) {
        const imageFile = req.files?.find(f => f.mimetype.startsWith('image/'));
        if (!imageFile) return res.status(400).json({ error: 'No image file found' });
        try {
            const inserted = await req.models.t_purchase_order.create({ image: imageFile.buffer });
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
            const inserted = await req.models.t_purchase_order.bulkCreate(records);
            res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async generateCode(req, res) {
        const params = req.query;
        const code = await getCodeStructure(t_purchase_order, params.menu_id, params.unit_bussiness_id)
        if (code.status === 'err') {
            res.json(errorResponse(code.error))
        }
        res.json(successResponse(code.data))
    },

    async fetchPOFilter(req, res) {
        try {
            const { t_purchase_order } = req.models;
            const whereConditions = {};

            if (req.query.search) {
                whereConditions['code'] = {
                    [Op.like]: `%${req.query.search}%`
                };
            }

            if (req.query.unit_bussiness_id) {
                whereConditions['unit_bussiness_id'] = {
                    [Op.in]: req.query.unit_bussiness_id.split(',')
                };
            }

            const purchaseOrders = await t_purchase_order.findAll({
                attributes: ['id', 'code'],
                where: whereConditions,
                order: [['createdAt', 'DESC']]
            });

            return res.json({
                data: purchaseOrders
            });
        } catch (error) {
            return res.status(500).json({
                message: "Error fetching purchase orders",
                error: error.message
            });
        }
    },

    async customIndex(req, res) {
        const {
            m_gen,
            m_supplier,
            m_unit_bussiness,
            t_purchase_order_approval,
            m_approval,
            m_approval_d,
            t_purchase_order_d,
            t_penerimaan_barang,
            t_penerimaan_barang_d,
            t_purchase_invoice,
            t_purchase_invoice_d,
            t_purchase_order_closing,
            t_purchase_order_closing_d
        } = req.models;

        const sequelize = t_purchase_order.sequelize;

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.paginate) || 10;
        const offset = (page - 1) * limit;

        let searchConditions = buildSearchQuery(req.query.search || null, req.query.searchfield || null);

        const where = {};

        // Global search conditions
        if (searchConditions.length > 0) {
            where[Op.or] = searchConditions;
        }

        // Column-specific search conditions

        // Search untuk code
        if (req.query.search_code) {
            where.code = {
                [Op.like]: `%${req.query.search_code}%`
            };
        }

        // Search untuk date (format: YYYY-MM-DD)
        if (req.query.search_date) {
            const searchDate = req.query.search_date;
            // Jika format lengkap YYYY-MM-DD
            if (searchDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                where.date = {
                    [Op.eq]: searchDate
                };
            } else {
                // Jika partial search (contoh: 2025-08 atau 2025)
                where.date = {
                    [Op.like]: `${searchDate}%`
                };
            }
        }

        // Search untuk grand_total (bisa exact match atau range)
        if (req.query.search_grand_total) {
            const searchGrandTotal = req.query.search_grand_total;
            // Jika hanya angka, cari yang sama persis
            if (/^\d+(\.\d+)?$/.test(searchGrandTotal)) {
                where.grand_total = {
                    [Op.eq]: parseFloat(searchGrandTotal)
                };
            } else {
                // Jika mengandung karakter lain, gunakan LIKE
                where.grand_total = {
                    [Op.like]: `%${searchGrandTotal}%`
                };
            }
        }

        // Search untuk supplier_name (melalui association)
        let supplierIncludeWhere = {};
        if (req.query.search_supplier_name) {
            supplierIncludeWhere.name = {
                [Op.like]: `%${req.query.search_supplier_name}%`
            };
        }

        // Search untuk top_supplier (melalui association)
        let topSupplierIncludeWhere = {};
        if (req.query.search_top_supplier) {
            topSupplierIncludeWhere.value1 = {
                [Op.like]: `%${req.query.search_top_supplier}%`
            };
        }

        // Search untuk ship_unit_business_name (melalui association)
        let shipCompanyIncludeWhere = {};
        if (req.query.search_ship_unit_business_name) {
            shipCompanyIncludeWhere.name = {
                [Op.like]: `%${req.query.search_ship_unit_business_name}%`
            };
        }

        let order = [];

        if (req.query.order_by_raw) {
            const parts = req.query.order_by_raw.split(' ');
            if (parts.length === 2) {
                const [field, direction] = parts;
                order.push([field, direction.toUpperCase()]);
            }
        } else if (req.query.order_by && req.query.order_dir) {
            order.push([req.query.order_by, req.query.order_dir.toUpperCase()]);
        }

        const include = [
            {
                model: m_gen,
                as: 'poItemType',
                attributes: ['id', 'value1'],
            },
            {
                model: m_gen,
                as: 'poTaxType',
                attributes: ['id', 'value1'],
            },
            {
                model: m_gen,
                as: 'poPaymentType',
                attributes: ['id', 'value1'],
            },
            {
                model: m_gen,
                as: 'poTopSupplier',
                attributes: ['id', 'value1'],
                // Tambahkan where condition untuk search top_supplier
                where: Object.keys(topSupplierIncludeWhere).length > 0 ? topSupplierIncludeWhere : undefined,
                required: Object.keys(topSupplierIncludeWhere).length > 0 ? true : false
            },
            {
                model: m_supplier,
                as: 'poSupplier',
                attributes: ['id', 'name', 'is_pajak'],
                // Tambahkan where condition untuk search supplier_name
                where: Object.keys(supplierIncludeWhere).length > 0 ? supplierIncludeWhere : undefined,
                required: Object.keys(supplierIncludeWhere).length > 0 ? true : false
            },
            {
                model: m_unit_bussiness,
                as: 'poCompany',
                attributes: ['id', 'name']
            },
            {
                model: m_unit_bussiness,
                as: 'poShipCompany',
                attributes: ['id', 'name'],
                // Tambahkan where condition untuk search ship_unit_business_name
                where: Object.keys(shipCompanyIncludeWhere).length > 0 ? shipCompanyIncludeWhere : undefined,
                required: Object.keys(shipCompanyIncludeWhere).length > 0 ? true : false
            },
            // Include PO Details untuk kalkulasi status
            {
                model: t_purchase_order_d,
                as: 'poDetails',
                attributes: ['id', 'qty', 'item_id'],
                required: false
            },
            // Include Penerimaan Barang
            {
                model: t_penerimaan_barang,
                as: 'pbPurchaseOrders',
                attributes: ['id', 'status'],
                required: false
            },
            // Include PO Closing
            {
                model: t_purchase_order_closing,
                as: 'poClosePurchaseOrders',
                attributes: ['id', 'status'],
                required: false
            }
        ];

        if (req.query.auth_user_id && req.query.menu_id) {
            // Cek role user
            const checkAprrovalRole = await m_approval_d.findOne({
                where: {
                    user_id: req.query.auth_user_id,
                    type: 'menyetujui'
                },
                include: [{
                    model: m_approval,
                    where: {
                        menu_id: req.query.menu_id
                    },
                    attributes: []
                }]
            });
            if (checkAprrovalRole) {
                include.push({
                    model: t_purchase_order_approval,
                    as: 'poApprovalPOs',
                    attributes: ['id', 'user_id', 'status', 'full_approval'],
                    required: true,
                    where: {
                        user_id: req.query.auth_user_id,
                        is_active: true,
                    }
                });
            }
        }

        if (req.query.unit_bussiness_id) {
            where.unit_bussiness_id = {
                [Op.eq]: req.query.unit_bussiness_id
            };
        }
        if (req.query.status) {
            where.status = {
                [Op.eq]: req.query.status
            };
        }

        const { count, rows } = await t_purchase_order.findAndCountAll({
            include,
            where,
            order,
            limit,
            offset,
            distinct: true // Tambahkan distinct untuk menghitung dengan benar
        });

        // Function untuk menghitung status_po
        const calculateStatusPo = async (po) => {
            const poDetails = po.poDetails || [];

            if (poDetails.length === 0) {
                return '-';
            }

            // Hitung total qty PO
            const totalPoQty = poDetails.reduce((sum, detail) => sum + (detail.qty || 0), 0);

            // Query untuk mendapatkan data penerimaan barang dengan raw query jika perlu
            const penerimaanData = await sequelize.query(`
            SELECT pb.id, pb.purchase_order_d_id, pb.qty_received 
            FROM t_penerimaan_barang_d pb
            INNER JOIN t_penerimaan_barang p ON p.id = pb.t_penerimaan_barang_id
            WHERE p.purchase_order_id = :poId
        `, {
                replacements: { poId: po.id },
                type: sequelize.QueryTypes.SELECT
            });

            // Query untuk mendapatkan data invoice
            const invoiceData = await sequelize.query(`
            SELECT pi.id, pi.qty, pii.status
            FROM t_purchase_invoice_d pi
            INNER JOIN t_purchase_invoice pii ON pii.id = pi.t_purchase_invoice_id
            WHERE pi.item_receipt_d_id IN (
                SELECT pb.id 
                FROM t_penerimaan_barang_d pb
                INNER JOIN t_penerimaan_barang p ON p.id = pb.t_penerimaan_barang_id
                WHERE p.purchase_order_id = :poId
            ) AND pii.status != 'cancelled'
        `, {
                replacements: { poId: po.id },
                type: sequelize.QueryTypes.SELECT
            });

            // Query untuk mendapatkan data closing
            const closingData = await t_purchase_order_closing_d.findAll({
                include: [
                    {
                        model: t_purchase_order_closing,
                        as: 'poClosingDetail',
                        where: {
                            purchase_order_id: po.id
                        },
                        attributes: ['id']
                    }
                ],
                attributes: ['id', 'purchase_order_d_id', 'qty']
            });

            // Hitung qty yang sudah diterima (PB)
            let totalReceivedQty = 0;
            let totalInvoicedQty = 0;

            penerimaanData.forEach(pbDetail => {
                totalReceivedQty += pbDetail.qty_received || 0;
            });

            // Hitung qty yang sudah di-invoice
            invoiceData.forEach(piDetail => {
                totalInvoicedQty += piDetail.qty || 0;
            });

            // Hitung qty yang di-closing
            let totalClosedQty = 0;
            closingData.forEach(closingDetail => {
                totalClosedQty += closingDetail.qty || 0;
            });

            // Logic status_po berdasarkan kondisi

            // Jika tidak ada tindakan apapun
            if (totalReceivedQty === 0 && totalClosedQty === 0) {
                return '-';
            }

            // Jika ada PO Closing (sebagian atau semua)
            if (totalClosedQty > 0) {
                return 'RECEIVED';
            }

            // Jika PO sudah dilakukan Penerimaan Barang tapi belum semua
            if (totalReceivedQty > 0 && totalReceivedQty < totalPoQty) {
                return '-';
            }

            // Jika PO sudah dilakukan Penerimaan Barang semua
            if (totalReceivedQty >= totalPoQty) {
                // Jika sudah dilakukan PI semua
                if (totalInvoicedQty >= totalReceivedQty) {
                    return 'INVOICED';
                }
                // Jika sudah di PB semua tapi PI belum semua atau belum ada
                return 'RECEIVED';
            }

            return '-';
        };

        // Add status_po to each row
        const processedRows = await Promise.all(rows.map(async (row) => {
            const rowData = row.toJSON();
            rowData.status_po = await calculateStatusPo(rowData);
            return rowData;
        }));

        const total = Array.isArray(count) ? count.length : count;
        const totalPages = Math.ceil(total / limit);

        return res.json({
            status: "success",
            data: processedRows,
            pagination: {
                total,
                page,
                totalPages,
                limit,
                currentRowsCount: processedRows.length,
                next_page: page < totalPages ? page + 1 : null,
                prev_page: page > 1 ? page - 1 : null
            }
        });
    },

    async getOutstandingPo(req, res) {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.paginate) || 10;
        const offset = (page - 1) * limit;

        const searchTerm = req.query.search || null;

        const whereConditions = {};
        const includeConditions = [];

        if (searchTerm) {
            whereConditions[Op.or] = [
                { item_name: { [Op.iLike]: `%${searchTerm}%` } },
                { '$poDetail.code$': { [Op.iLike]: `%${searchTerm}%` } }
            ];
            includeConditions.push({
                model: t_purchase_order,
                as: 'poDetail',
                attributes: ['code'],
                required: true,
            });
        } else {
            includeConditions.push({
                model: t_purchase_order,
                as: 'poDetail',
                attributes: ['code'],
                required: true,
            });
        }

        includeConditions.push(
            {
                model: m_item,
                as: 'poDetailItem',
                attributes: ['name'],
            },
            {
                model: t_purchase_order_closing_d,
                as: 'poClosingPoDetails',
                attributes: [],
                include: [
                    {
                        model: t_purchase_order_closing,
                        as: 'poClosingDetail',
                        attributes: [],
                        required: true,
                        where: {
                            status: 'POSTED'
                        }
                    }
                ],
            },
            {
                model: t_purchase_order_revision_d,
                as: 'podRevisionDetails',
                attributes: [],
                required: false,
            },
            {
                model: t_penerimaan_barang_d,
                as: 'pbDetailPurchaseOrderDetails',
                attributes: [],
                required: false,
                include: [
                    {
                        model: t_penerimaan_barang,
                        as: 'pbDetailPenerimaanBarang',
                        attributes: [],
                        required: false,
                        where: {
                            status: 'POSTED'
                        }
                    }
                ]
            },
            {
                model: t_purchase_return_d,
                as: 'prtDetailPoDetails',
                attributes: [],
                required: false,
                include: [
                    {
                        model: t_purchase_return,
                        as: 'prtDetailPurchaseReturn',
                        attributes: [],
                        required: false,
                        where: {
                            status: 'POSTED'
                        }
                    }
                ]
            }
        );

        const { count, rows } = await t_purchase_order_d.findAndCountAll({
            attributes: [
                'id',
                'purchase_order_id',
                [
                    literal(`COALESCE(
                        NULLIF((SELECT MAX(qty) FROM t_purchase_order_revision_d 
                        WHERE t_purchase_order_revision_d.purchase_order_d_id = t_purchase_order_d.id), 0),
                        t_purchase_order_d.qty
                    )`),
                    'qty'
                ],
                [
                    literal(`COALESCE(CAST(SUM("poClosingPoDetails"."qty") AS INTEGER), 0)`),
                    'qty_closing'
                ],
                [
                    literal(`COALESCE(
                        (SELECT CAST(SUM(qty_receipt) AS INTEGER) FROM t_penerimaan_barang_d 
                        WHERE t_penerimaan_barang_d.purchase_order_d_id = t_purchase_order_d.id
                        AND EXISTS (
                            SELECT 1 FROM t_penerimaan_barang 
                            WHERE t_penerimaan_barang.id = t_penerimaan_barang_d.t_penerimaan_barang_id 
                            AND t_penerimaan_barang.status = 'POSTED'
                        )),
                        0
                    )`),
                    'qty_lpb'
                ],
                [
                    literal(`COALESCE(
                        (SELECT CAST(SUM(qty) AS INTEGER) FROM t_purchase_return_d 
                        WHERE t_purchase_return_d.purchase_order_d_id = t_purchase_order_d.id
                        AND EXISTS (
                            SELECT 1 FROM t_purchase_return 
                            WHERE t_purchase_return.id = t_purchase_return_d.t_purchase_return_id 
                            AND t_purchase_return.status = 'POSTED'
                        )),
                        0
                    )`),
                    'qty_retur'
                ]
            ],
            include: includeConditions,
            where: whereConditions,
            group: [
                't_purchase_order_d.id',
                'poDetail.id',
                'poDetailItem.id'
            ],
            having: literal(`(
                COALESCE(
                    NULLIF((
                        SELECT MAX(qty) 
                        FROM t_purchase_order_revision_d 
                        WHERE t_purchase_order_revision_d.purchase_order_d_id = t_purchase_order_d.id
                    ), 0),
                    t_purchase_order_d.qty
                )
                - COALESCE(CAST(SUM("poClosingPoDetails"."qty") AS INTEGER), 0)
                - COALESCE((
                    SELECT CAST(SUM(qty_receipt) AS INTEGER) 
                    FROM t_penerimaan_barang_d 
                    WHERE t_penerimaan_barang_d.purchase_order_d_id = t_purchase_order_d.id
                    AND EXISTS (
                        SELECT 1 FROM t_penerimaan_barang 
                        WHERE t_penerimaan_barang.id = t_penerimaan_barang_d.t_penerimaan_barang_id 
                            AND t_penerimaan_barang.status = 'POSTED'
                    )
                ), 0)
                - COALESCE((
                    SELECT CAST(SUM(qty) AS INTEGER) 
                    FROM t_purchase_return_d 
                    WHERE t_purchase_return_d.purchase_order_d_id = t_purchase_order_d.id
                    AND EXISTS (
                        SELECT 1 FROM t_purchase_return 
                        WHERE t_purchase_return.id = t_purchase_return_d.t_purchase_return_id 
                            AND t_purchase_return.status = 'POSTED'
                    )
                ), 0)
            ) > 0`),
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
                next_page: null,
                prev_page: null
            }
        });
    },

    async summaryReportStatusIndex(req, res) {
        const whereConditions = {};
        const includeConditions = [];
        const order = [];

        try {
            if (req.query.where) {
                const parsedWhere = await parseWhereQueryParam(req.query.where);
                Object.assign(whereConditions, parsedWhere);
            }
        } catch (err) {
            console.warn('Failed to parse where param:', err.message);
        }

        if (req.query.unit_bussiness_id) {
            whereConditions['$poDetail.unit_bussiness_id$'] = {
                [Op.in]: req.query.unit_bussiness_id.split(',')
            };
        }

        if (req.query.status && req.query.status !== 'all') {
            whereConditions['$poDetail.status$'] = req.query.status;
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

        if (req.query.start_date && req.query.end_date) {
            const startDate = getStartOfDay(req.query.start_date);
            const endDate = getEndOfDay(req.query.end_date);

            whereConditions['$poDetail.createdAt$'] = {
                [Op.between]: [startDate, endDate]
            };
        } else if (req.query.start_date) {
            whereConditions['$poDetail.createdAt$'] = { 
                [Op.gte]: getStartOfDay(req.query.start_date) 
            };
        } else if (req.query.end_date) {
            whereConditions['$poDetail.createdAt$'] = { 
                [Op.lte]: getEndOfDay(req.query.end_date) 
            };
        }

        if (req.query.item_id) {
            whereConditions['$poDetailItem.id$'] = req.query.item_id;
        }

        if (req.query.purchase_order_id) {
            whereConditions['purchase_order_id'] = req.query.purchase_order_id;
        }

        if (req.query.supplier_id) {
            whereConditions['$poDetail.poSupplier.id$'] = req.query.supplier_id;
        }

        const sortBy = req.query.sort_by || 'createdAt';
        const sortDir = (req.query.sort_dir || 'desc').toUpperCase();

        if (['createdAt', 'code'].includes(sortBy)) {
            order.push([{ model: t_purchase_order, as: 'poDetail' }, sortBy, sortDir]);
        }

        includeConditions.push({
            model: t_purchase_order,
            as: 'poDetail',
            attributes: [
                'code', 'unit_bussiness_id', 'unit_bussiness_name', 'status',
                'notes', 'createdAt', 'createdBy', 'submitted_at', 'submitted_by'
            ],
            required: true,
            include: [
                {
                    model: m_supplier,
                    as: 'poSupplier',
                    attributes: ['id', 'name', 'code']
                },
                {
                    model: t_purchase_order_closing,
                    as: 'poClosePurchaseOrders',
                    attributes: ['reason']
                },
                {
                    model: user_default,
                    as: 'poSubmittedBy',
                    attributes: ['name']
                },
                {
                    model: user_default,
                    as: 'poCreatedBy',
                    attributes: ['name']
                }
            ]
        });

        includeConditions.push(
            {
                model: m_item,
                as: 'poDetailItem',
                attributes: ['id', 'code', 'name', 'actual_weight'],
            },
            {
                model: t_purchase_order_closing_d,
                as: 'poClosingPoDetails',
                attributes: [],
                where: { 
                    '$poClosingPoDetails.item_id$': { [Op.col]: 'poDetailItem.id' }
                },
                required: false
            },
            {
                model: t_penerimaan_barang_d,
                as: 'pbDetailPurchaseOrderDetails',
                attributes: [],
                where: { 
                    '$pbDetailPurchaseOrderDetails.item_id$': { [Op.col]: 'poDetailItem.id' }
                },
                required: false
            }
        );

        try {
            const rows = await t_purchase_order_d.findAll({
                attributes: [
                    'id',
                    'purchase_order_id',
                    'qty',
                    'price',
                    'uom',
                    [literal(`COALESCE(CAST(SUM("poClosingPoDetails"."qty") AS INTEGER), 0)`), 'qty_closing'],
                    [literal(`COALESCE(CAST(SUM("pbDetailPurchaseOrderDetails"."qty_receipt") AS INTEGER), 0)`), 'qty_lpb'],
                    [literal(`0`), 'qty_retur'],
                ],
                include: includeConditions,
                where: whereConditions,
                group: [
                    't_purchase_order_d.id',
                    'poDetail.id',
                    'poDetailItem.id',
                    'poDetail->poSupplier.id',
                    'poDetail->poCreatedBy.id',
                    'poDetail->poSubmittedBy.id',
                    'poDetail->poClosePurchaseOrders.id'
                ],
                order,
                subQuery: false
            });

            return res.json({
                status: 'success',
                data: rows,
                pagination: {
                    total: rows.length,
                    page: 1,
                    totalPages: 1,
                    limit: null,
                    currentRowsCount: rows.length,
                    next_page: null,
                    prev_page: null
                }
            });
        } catch (err) {
            return res.status(500).json({
                status: 'error',
                message: err.message || 'Internal server error'
            });
        }
    },

    async detailReportStatusIndex(req, res) {
        const whereConditions = {};
        const includeConditions = [];
        const order = [];

        try {
            if (req.query.where) {
                const parsedWhere = await parseWhereQueryParam(req.query.where);
                Object.assign(whereConditions, parsedWhere);
            }
        } catch (err) {
            console.warn('Failed to parse where param:', err.message);
        }

        if (req.query.unit_bussiness_id) {
            whereConditions['$poDetail.unit_bussiness_id$'] = {
                [Op.in]: req.query.unit_bussiness_id.split(',')
            };
        }

        if (req.query.status && req.query.status !== 'all') {
            whereConditions['$poDetail.status$'] = req.query.status;
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

        if (req.query.start_date && req.query.end_date) {
            const startDate = getStartOfDay(req.query.start_date);
            const endDate = getEndOfDay(req.query.end_date);

            whereConditions['$poDetail.createdAt$'] = {
                [Op.between]: [startDate, endDate]
            };
        } else if (req.query.start_date) {
            whereConditions['$poDetail.createdAt$'] = { 
                [Op.gte]: getStartOfDay(req.query.start_date) 
            };
        } else if (req.query.end_date) {
            whereConditions['$poDetail.createdAt$'] = { 
                [Op.lte]: getEndOfDay(req.query.end_date) 
            };
        }

        if (req.query.item_id) {
            whereConditions['$poDetailItem.id$'] = req.query.item_id;
        }

        if (req.query.purchase_order_id) {
            whereConditions['purchase_order_id'] = req.query.purchase_order_id;
        }

        if (req.query.supplier_id) {
            whereConditions['$poDetail.poSupplier.id$'] = req.query.supplier_id;
        }

        const sortBy = req.query.sort_by || 'createdAt';
        const sortDir = (req.query.sort_dir || 'desc').toUpperCase();

        if (['createdAt', 'code'].includes(sortBy)) {
            order.push([{ model: t_purchase_order, as: 'poDetail' }, sortBy, sortDir]);
        }

        includeConditions.push({
            model: t_purchase_order,
            as: 'poDetail',
            attributes: [
                'code', 'unit_bussiness_id', 'unit_bussiness_name', 'status',
                'notes', 'createdAt', 'createdBy', 'submitted_at', 'submitted_by'
            ],
            required: true,
            include: [
                {
                    model: m_supplier,
                    as: 'poSupplier',
                    attributes: ['id', 'name', 'code']
                },
                {
                    model: t_purchase_request,
                    as: 'poPurchaseRequest',
                    attributes: ['id', 'code']
                },
                {
                    model: t_purchase_order_closing,
                    as: 'poClosePurchaseOrders',
                    attributes: ['reason'],
                    include: [
                        {
                            model: t_purchase_order_closing_d,
                            as: 'poClosingDetails',
                            attributes: ['item_id', 'item_code', 'item_name', 'qty']
                        }
                    ]
                },
                {
                    model: t_penerimaan_barang,
                    as: 'pbPurchaseOrders',
                    attributes: ['date', 'code'],
                    include: [
                        {
                            model: t_penerimaan_barang_d,
                            as: 'pbDetailPenerimaanBarangs',
                            attributes: ['item_id', 'qty_received', 'qty_receipt']
                        }
                    ]
                },
                {
                    model: user_default,
                    as: 'poSubmittedBy',
                    attributes: ['name']
                },
                {
                    model: user_default,
                    as: 'poCreatedBy',
                    attributes: ['name']
                }
            ]
        });

        includeConditions.push(
            {
                model: m_item,
                as: 'poDetailItem',
                attributes: ['id', 'code', 'name', 'actual_weight'],
            },
            {
                model: t_purchase_order_closing_d,
                as: 'poClosingPoDetails',
                attributes: [],
            }
        );

        try {
            const rows = await t_purchase_order_d.findAll({
                attributes: [
                    'id',
                    'purchase_order_id',
                    'qty',
                    'price',
                    'uom',
                    [literal(`COALESCE(CAST(SUM("poClosingPoDetails"."qty") AS INTEGER), 0)`), 'qty_closing'],
                    [literal(`0`), 'qty_lpb'],
                    [literal(`0`), 'qty_retur'],
                ],
                include: includeConditions,
                where: whereConditions,
                group: [
                    't_purchase_order_d.id',
                    'poDetail.id',
                    'poDetailItem.id',
                    'poDetail->poPurchaseRequest.id',
                    'poDetail->poClosePurchaseOrders.id',
                    'poDetail->poClosePurchaseOrders->poClosingDetails.id',
                    'poDetail->pbPurchaseOrders.id',
                    'poDetail->pbPurchaseOrders->pbDetailPenerimaanBarangs.id',
                    'poDetail->poSupplier.id',
                    'poDetail->poCreatedBy.id',
                    'poDetail->poSubmittedBy.id',
                ],
                order,
                subQuery: false
            });

            const filteredRows = rows.map(row => {
                const itemId = row.poDetailItem?.id;
                const filteredRow = JSON.parse(JSON.stringify(row));

                if (filteredRow.poDetail?.poClosePurchaseOrders?.poClosingDetails) {
                    filteredRow.poDetail.poClosePurchaseOrders.poClosingDetails =
                        filteredRow.poDetail.poClosePurchaseOrders.poClosingDetails.filter(detail =>
                            detail.item_id === itemId
                        );
                }

                if (filteredRow.poDetail?.pbPurchaseOrders?.pbDetailPenerimaanBarangs) {
                    filteredRow.poDetail.pbPurchaseOrders.pbDetailPenerimaanBarangs =
                        filteredRow.poDetail.pbPurchaseOrders.pbDetailPenerimaanBarangs.filter(detail =>
                            detail.item_id === itemId
                        );
                }

                if (filteredRow.poDetail?.pbPurchaseOrders?.pbDetailPenerimaanBarangs) {
                    const totalQtyReceipt = filteredRow.poDetail.pbPurchaseOrders.pbDetailPenerimaanBarangs
                        .reduce((sum, detail) => sum + (detail.qty_receipt || 0), 0);
                    filteredRow.qty_lpb = totalQtyReceipt;
                }
                return filteredRow;
            });

            return res.json({
                status: 'success',
                data: filteredRows,
                pagination: {
                    total: filteredRows.length,
                    page: 1,
                    totalPages: 1,
                    limit: null,
                    currentRowsCount: filteredRows.length,
                    next_page: null,
                    prev_page: null
                }
            });
        } catch (err) {
            return res.status(500).json({
                status: 'error',
                message: err.message || 'Internal server error'
            });
        }
    },

    async getBeritaAcaraPos(req, res) {
        const { t_news_program, m_gen, m_supplier, m_unit_bussiness } = req.models;

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.paginate) || 10;
        const offset = (page - 1) * limit;

        // Create search query
        let searchConditions = buildSearchQuery(req.query.search || null, req.query.searchfield || null);

        const where = {};

        if (searchConditions.length > 0) {
            where[Op.or] = searchConditions;
        }

        const include = [
            {
                model: m_gen,
                as: 'poItemType',
                attributes: ['id', 'value1'],
            },
            {
                model: m_gen,
                as: 'poTaxType',
                attributes: ['id', 'value1'],
            },
            {
                model: m_gen,
                as: 'poPaymentType',
                attributes: ['id', 'value1'],
            },
            {
                model: m_gen,
                as: 'poTopSupplier',
                attributes: ['id', 'value1'],
            },
            {
                model: m_supplier,
                as: 'poSupplier',
                attributes: ['id', 'name', 'is_pajak']
            },
            {
                model: m_unit_bussiness,
                as: 'poCompany',
                attributes: ['id', 'name']
            },
            {
                model: m_unit_bussiness,
                as: 'poShipCompany',
                attributes: ['id', 'name']
            },
            {
                model: t_news_program,
                as: 'tbaPurchaseOrders',
                required: true,
                attributes: ['id', 'code', 'status'],
                where: {
                    status: 'APPROVED'
                }
            }
        ];

        // kondisi: 
        // 1. Pernah direvisi tapi REJECTED
        // 2. Belum pernah direvisi
        // 3. Pernah direvisi tapi DRAFT
        const whereRevisionCondition = {
        [Op.or]: [
            literal(`EXISTS (
            SELECT 1 FROM t_purchase_order_revision rev
            WHERE rev.purchase_order_id = "t_purchase_order".id
                AND rev.status = 'REJECTED'
            )`),
            literal(`NOT EXISTS (
            SELECT 1 FROM t_purchase_order_revision rev
            WHERE rev.purchase_order_id = "t_purchase_order".id
            )`),
            literal(`EXISTS (
            SELECT 1 FROM t_purchase_order_revision rev
            WHERE rev.purchase_order_id = "t_purchase_order".id
                AND rev.status = 'DRAFT'
            )`),
        ]
        };


        const { count, rows } = await t_purchase_order.findAndCountAll({
            include,
            where: {
                ...where,
                ...whereRevisionCondition,
            },
            order: [['code', 'DESC']],
            distinct: true,
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
                next_page: null,
                prev_page: null
            }
        });
    }



};
