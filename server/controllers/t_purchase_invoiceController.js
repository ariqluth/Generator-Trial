// Controller for t_purchase_invoice
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_purchase_invoice
//
// Tambahkan custom function di bawah ini
import { user as user_default } from '../models/index.js';
import { literal, Op, fn, col, Sequelize } from "sequelize";

export const t_purchase_invoiceController = {
  // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
    async uploadImage(req, res) {
        const fileFields = Object.keys(req.models.t_purchase_invoice.rawAttributes).filter(
        key => req.models.t_purchase_invoice.rawAttributes[key].type && req.models.t_purchase_invoice.rawAttributes[key].type.key === 'STRING'
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
        const inserted = await req.models.t_purchase_invoice.create(data);
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
        const inserted = await req.models.t_purchase_invoice.bulkCreate(records);
        res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
        res.status(500).json({ error: err.message });
        }
    },

    async generateCode(req, res) {
        const params = req.query;
        const code = await getCodeStructure(req.models.t_purchase_invoice, params.menu_id, params.unit_bussiness_id)
        if (code.status === 'err') {
            res.json(errorResponse(code.error))
        }
        res.json(successResponse(code.data))
    },

    async paymentReportIndex(req, res) {
        const {
            m_gen,
            m_supplier,
            m_currency,
            m_unit_bussiness,
            t_purchase_invoice,
            t_purchase_invoice_d,
            t_penerimaan_barang,
            t_penerimaan_barang_d,
        } = req.models;

        const {
            unit_bussiness_id,
            start_date,
            end_date,
            status,
            purchase_order_id,
            supplier_id,
            order_by,
            order_as,
            withPagination,
            page: pageParam,
            paginate
        } = req.query;

        const usePagination = withPagination !== 'false';
        const page = parseInt(pageParam) || 1;
        const limit = parseInt(paginate) || 10;
        const offset = (page - 1) * limit;

        // WHERE CLAUSES
        const wherePBClause = {};
        const wherePIClause = {};

        if (unit_bussiness_id) {
            const ids = unit_bussiness_id.split(",");
            wherePBClause.unit_bussiness_id = { [Op.in]: ids };
        }

        if (start_date && end_date) {
            wherePIClause.date = { [Op.between]: [start_date, end_date] };
        } else if (start_date) {
            wherePIClause.date = { [Op.gte]: start_date };
        } else if (end_date) {
            wherePIClause.date = { [Op.lte]: end_date };
        }

        if (status && status !== "all") {
            wherePIClause.status = status;
        }

        if (purchase_order_id) {
            wherePBClause.purchase_order_id = purchase_order_id;
        }

        if (supplier_id) {
            wherePBClause.supplier_id = supplier_id;
        }

        const include = [
            {
                model: m_gen,
                as: 'piItemType',
                required: true,
                attributes: ['value1']
            },
            {
                model: t_penerimaan_barang,
                as: 'piPenerimaanBarang',
                required: true,
                where: wherePBClause,
                include: [
                    {
                        model: m_unit_bussiness,
                        as: 'pbCompany',
                        required: true,
                        attributes: ['name']
                    }
                ]
            },
            {
                model: m_currency,
                as: 'piCurrency',
                required: true,
                attributes: ['name', 'code']
            },
            {
                model: m_supplier,
                as: 'piSupplier',
                required: true,
                attributes: ['name', 'code']
            },
            {
                model: t_purchase_invoice_d,
                as: 'piDetails',
                required: true,
                include: [
                    {
                        model: t_penerimaan_barang_d,
                        as: 'piDetailPenerimaanBarangDetail',
                        required: true,
                    }
                ]
            },
        ];

        const orderDirection = order_as?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        let order = [['createdAt', orderDirection]];

        const queryOptions = {
            where: wherePIClause,
            include,
            order,
            subQuery: false,
            distinct: true,
            raw: false,
            nest: true
        };

        if (usePagination) {
            queryOptions.limit = limit;
            queryOptions.offset = offset;
        }

        try {
            const { count, rows } = await t_purchase_invoice.findAndCountAll(queryOptions);
            const processedRows = rows.map(row => row.toJSON ? row.toJSON() : row);
            const totalPages = usePagination ? Math.ceil(count / limit) : 1;

            return res.json({
                status: "success",
                data: processedRows,
                pagination: {
                    total: count,
                    page: usePagination ? page : 1,
                    totalPages: usePagination ? totalPages : 1,
                    limit: usePagination ? limit : count,
                    currentRowsCount: processedRows.length,
                    next_page: usePagination && page < totalPages ? page + 1 : null,
                    prev_page: usePagination && page > 1 ? page - 1 : null,
                },
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({
                status: "error",
                message: error.message
            });
        }
    },

    async summaryReportIndex(req, res) {
        const {
            t_purchase_invoice,
            t_purchase_invoice_d,
            t_penerimaan_barang,
            t_penerimaan_barang_d,
            t_purchase_order,
            m_supplier,
            m_item,
        } = req.models;

        const {
            start_date,
            end_date,
            id,
            order_by,
            order_as,
            withPagination,
            unit_bussiness_id,
            status_invoice,
            status_penerimaan,
            status_po,
            purchase_order_id,
            supplier_id,
            item_id,
            penerimaan_barang_id,
            purchase_invoice_id
        } = req.query;

        const usePagination = withPagination !== 'false';
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.paginate) || 10;
        const offset = (page - 1) * limit;

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

        const whereClause = {};

        if (id) {
            whereClause.id = id;
        }
        if (purchase_invoice_id) {
            whereClause.t_purchase_invoice_id = purchase_invoice_id;
        }

        const piDetailWhere = {};
        const supplierWhere = {};
        const penerimaanBarangWhere = {};
        const purchaseOrderWhere = {};
        const penerimaanBarangDetailWhere = {};
        const itemWhere = {};

        if (start_date && end_date) {
            const startDate = getStartOfDay(start_date);
            const endDate = getEndOfDay(end_date);            
            piDetailWhere.date = { [Op.between]: [startDate, endDate] };
        } else if (start_date) {
            const startDate = getStartOfDay(start_date);
            piDetailWhere.date = { [Op.gte]: startDate };
        } else if (end_date) {
            const endDate = getEndOfDay(end_date);
            piDetailWhere.date = { [Op.lte]: endDate };
        }

        if (status_invoice && status_invoice !== "all") {
            piDetailWhere.status = status_invoice;
        }
        if (status_penerimaan && status_penerimaan !== "all") {
            penerimaanBarangWhere.status = status_penerimaan;
        }
        if (status_po && status_po !== "all") {
            purchaseOrderWhere.status = status_po;
        }
        if (purchase_order_id) {
            penerimaanBarangDetailWhere.purchase_order_id = purchase_order_id;
        }
        if (penerimaan_barang_id) {
            penerimaanBarangDetailWhere.t_penerimaan_barang_id = penerimaan_barang_id;
        }
        if (supplier_id) {
            supplierWhere.id = supplier_id;
        }
        if (unit_bussiness_id) {
            const ids = unit_bussiness_id.split(",");
            purchaseOrderWhere.unit_bussiness_id = { [Op.in]: ids };
        }
        if (item_id) {
            itemWhere.id = item_id;
        }

        const include = [
            {
                model: t_purchase_invoice,
                as: 'piDetail',
                required: true,
                attributes: ['code', 'facture_supplier', 'facture_tax', 'date', 'status', 'supplier_id', 'ppn_nominal', 'pph_nominal', 'total_dpp', 'grand_total', 'createdAt'],
                where: Object.keys(piDetailWhere).length > 0 ? piDetailWhere : undefined,
                include: [
                    {
                        model: m_supplier,
                        as: 'piSupplier',
                        required: false,
                        attributes: ['code', 'name'],
                        where: Object.keys(supplierWhere).length > 0 ? supplierWhere : undefined
                    }
                ]
            },
            {
                model: t_penerimaan_barang_d,
                as: 'piDetailPenerimaanBarangDetail',
                required: false,
                where: Object.keys(penerimaanBarangDetailWhere).length > 0 ? penerimaanBarangDetailWhere : undefined,
                include: [
                    {
                        model: t_penerimaan_barang,
                        as: 'pbDetailPenerimaanBarang',
                        required: false,
                        where: Object.keys(penerimaanBarangWhere).length > 0 ? penerimaanBarangWhere : undefined,
                    },
                    {
                        model: t_purchase_order,
                        as: 'pbDetailPurchaseOrder',
                        required: false,
                        where: Object.keys(purchaseOrderWhere).length > 0 ? purchaseOrderWhere : undefined
                    },
                    {
                        model: m_item,
                        as: 'pbDetailItem',
                        required: false,
                        attributes: ['code', 'name'],
                        where: Object.keys(itemWhere).length > 0 ? itemWhere : undefined
                    },
                ]
            }
        ];

        let order = [];
        const orderDirection = order_as?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        if (order_by === 'item_name') {
            order = [
                [
                    { model: t_penerimaan_barang_d, as: 'piDetailPenerimaanBarangDetail' },
                    { model: m_item, as: 'pbDetailItem' },
                    'name',
                    orderDirection
                ]
            ];
        } else if (order_by === 'po_code') {
            order = [
                [
                    { model: t_penerimaan_barang_d, as: 'piDetailPenerimaanBarangDetail' },
                    { model: t_purchase_order, as: 'pbDetailPurchaseOrder' },
                    'code',
                    orderDirection
                ]
            ];
        } else if (order_by === 'pi_code') {
            order = [
                [
                    { model: t_purchase_invoice, as: 'piDetail' },
                    'code',
                    orderDirection
                ]
            ];
        } else if (order_by === 'pi_date') {
            order = [
                [
                    { model: t_purchase_invoice, as: 'piDetail' },
                    'date',
                    orderDirection
                ]
            ];
        } else if (order_by === 'supplier_name') {
            order = [
                [
                    { model: t_purchase_invoice, as: 'piDetail' },
                    { model: m_supplier, as: 'piSupplier' },
                    'name',
                    orderDirection
                ]
            ];
        } else {
            order = [['createdAt', 'DESC']];
        }

        const queryOptions = {
            where: whereClause,
            include,
            order,
            subQuery: false,
            distinct: true,
            raw: false,
            nest: true,
        };

        const { count, rows } = await t_purchase_invoice_d.findAndCountAll(queryOptions);
        
        const groupedData = {};
        
        rows.forEach(row => {
            const rowData = row.toJSON();
            const piId = rowData.t_purchase_invoice_id;
            
            if (!groupedData[piId]) {
                const cleanRowData = {
                    id: rowData.id,
                    t_purchase_invoice_id: rowData.t_purchase_invoice_id,
                    item_receipt_d_id: rowData.item_receipt_d_id,
                    discount_amt: rowData.discount_amt,
                    qty: rowData.qty,
                    notes: rowData.notes,
                    discount_rate: rowData.discount_rate,
                    ppn_rate: rowData.ppn_rate,
                    pph_rate: rowData.pph_rate,
                    createdAt: rowData.createdAt,
                    updatedAt: rowData.updatedAt,
                    piDetail: rowData.piDetail || null
                };

                if (rowData.piDetailPenerimaanBarangDetail) {
                    const penerimaan = rowData.piDetailPenerimaanBarangDetail;

                    cleanRowData.piDetailPenerimaanBarangDetail = {
                        id: penerimaan.id,
                        t_penerimaan_barang_id: penerimaan.t_penerimaan_barang_id,
                        purchase_order_id: penerimaan.purchase_order_id,
                        purchase_order_d_id: penerimaan.purchase_order_d_id,
                        item_id: penerimaan.item_id,
                        qty_received: penerimaan.qty_received,
                        qty_receipt: penerimaan.qty_receipt,
                        notes: penerimaan.notes,
                        createdAt: penerimaan.createdAt,
                        updatedAt: penerimaan.updatedAt
                    };

                    if (penerimaan.pbDetailPenerimaanBarang) {
                        const originalPB = penerimaan.pbDetailPenerimaanBarang;

                        cleanRowData.piDetailPenerimaanBarangDetail.pbDetailPenerimaanBarang = {
                            id: originalPB.id,
                            code: originalPB.code,
                            no_sj_supplier: originalPB.no_sj_supplier || originalPB.no_sj_s || null,
                            date: originalPB.date
                        };
                    }

                    if (penerimaan.pbDetailPurchaseOrder) {
                        const originalPO = penerimaan.pbDetailPurchaseOrder;

                        cleanRowData.piDetailPenerimaanBarangDetail.pbDetailPurchaseOrder = {
                            id: originalPO.id,
                            unit_business_name: originalPO.unit_business_name || originalPO.unit_bussi || originalPO.unit_bussiness_name || null,
                            code: originalPO.code,
                            date: originalPO.date,
                            selling_price: originalPO.selling_price || originalPO.selling_pr || null,
                            dpp: originalPO.total_dpp || null,
                            ppn_nominal: originalPO.ppn_nominal || originalPO.ppn_nomina || null,
                            pph_nominal: originalPO.pph_nominal || originalPO.pph_nomina || null,
                            total_discount: originalPO.total_discount || originalPO.total_disc || null,
                            currency: originalPO.currency
                        };
                    }

                    if (penerimaan.pbDetailItem) {
                        cleanRowData.piDetailPenerimaanBarangDetail.pbDetailItem = penerimaan.pbDetailItem;
                    }
                }

                groupedData[piId] = cleanRowData;
            }
        });

        const processedRows = Object.values(groupedData);
        
        const totalGroupedCount = processedRows.length;
        const paginatedRows = usePagination 
            ? processedRows.slice(offset, offset + limit)
            : processedRows;

        const totalPages = usePagination ? Math.ceil(totalGroupedCount / limit) : 1;

        return res.json({
            status: "success",
            data: paginatedRows,
            pagination: {
                total: totalGroupedCount,
                page: usePagination ? page : 1,
                totalPages: usePagination ? totalPages : 1,
                limit: usePagination ? limit : totalGroupedCount,
                currentRowsCount: paginatedRows.length,
                next_page: usePagination && page < totalPages ? page + 1 : null,
                prev_page: usePagination && page > 1 ? page - 1 : null,
            },
        });
    },

    async detailReportIndex(req, res) {
        const {
            t_purchase_invoice,
            t_purchase_invoice_d,
            t_penerimaan_barang,
            t_penerimaan_barang_d,
            t_purchase_order,
            m_supplier,
            m_item,
        } = req.models;

        const {
            start_date,
            end_date,
            id,
            order_by,
            order_as,
            withPagination,
            unit_bussiness_id,
            status_invoice,
            status_penerimaan,
            status_po,
            purchase_order_id,
            supplier_id,
            item_id,
            penerimaan_barang_id,
            purchase_invoice_id
        } = req.query;

        const usePagination = withPagination !== 'false';
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.paginate) || 10;
        const offset = (page - 1) * limit;

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

        const whereClause = {};

        if (id) {
            whereClause.id = id;
        }
        if (purchase_invoice_id) {
            whereClause.t_purchase_invoice_id = purchase_invoice_id;
        }

        const piDetailWhere = {};
        const supplierWhere = {};
        const penerimaanBarangWhere = {};
        const purchaseOrderWhere = {};
        const penerimaanBarangDetailWhere = {};
        const itemWhere = {};

        if (start_date && end_date) {
            const startDate = getStartOfDay(start_date);
            const endDate = getEndOfDay(end_date);            
            piDetailWhere.date = { [Op.between]: [startDate, endDate] };
        } else if (start_date) {
            const startDate = getStartOfDay(start_date);
            piDetailWhere.date = { [Op.gte]: startDate };
        } else if (end_date) {
            const endDate = getEndOfDay(end_date);
            piDetailWhere.date = { [Op.lte]: endDate };
        }

        if (status_invoice && status_invoice !== "all") {
            piDetailWhere.status = status_invoice;
        }
        if (status_penerimaan && status_penerimaan !== "all") {
            penerimaanBarangWhere.status = status_penerimaan;
        }
        if (status_po && status_po !== "all") {
            purchaseOrderWhere.status = status_po;
        }
        if (purchase_order_id) {
            penerimaanBarangDetailWhere.purchase_order_id = purchase_order_id;
        }
        if (penerimaan_barang_id) {
            penerimaanBarangDetailWhere.t_penerimaan_barang_id = penerimaan_barang_id;
        }
        if (supplier_id) {
            supplierWhere.id = supplier_id;
        }
        if (unit_bussiness_id) {
            const ids = unit_bussiness_id.split(",");
            purchaseOrderWhere.unit_bussiness_id = { [Op.in]: ids };
        }
        if (item_id) {
            itemWhere.id = item_id;
        }

        const include = [
            {
                model: t_purchase_invoice,
                as: 'piDetail',
                required: true,
                attributes: ['code', 'facture_supplier', 'facture_tax', 'date', 'status', 'supplier_id', 'createdAt'],
                where: Object.keys(piDetailWhere).length > 0 ? piDetailWhere : undefined,
                include: [
                    {
                        model: m_supplier,
                        as: 'piSupplier',
                        required: false,
                        attributes: ['code', 'name'],
                        where: Object.keys(supplierWhere).length > 0 ? supplierWhere : undefined
                    }
                ]
            },
            {
                model: t_penerimaan_barang_d,
                as: 'piDetailPenerimaanBarangDetail',
                required: false,
                where: Object.keys(penerimaanBarangDetailWhere).length > 0 ? penerimaanBarangDetailWhere : undefined,
                include: [
                    {
                        model: t_penerimaan_barang,
                        as: 'pbDetailPenerimaanBarang',
                        required: false,
                        where: Object.keys(penerimaanBarangWhere).length > 0 ? penerimaanBarangWhere : undefined,
                    },
                    {
                        model: t_purchase_order,
                        as: 'pbDetailPurchaseOrder',
                        required: false,
                        where: Object.keys(purchaseOrderWhere).length > 0 ? purchaseOrderWhere : undefined
                    },
                    {
                        model: m_item,
                        as: 'pbDetailItem',
                        required: false,
                        attributes: ['code', 'name'],
                        where: Object.keys(itemWhere).length > 0 ? itemWhere : undefined
                    },
                ]
            }
        ];

        let order = [];
        const orderDirection = order_as?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        if (order_by === 'item_name') {
            order = [
                [
                    { model: t_penerimaan_barang_d, as: 'piDetailPenerimaanBarangDetail' },
                    { model: m_item, as: 'pbDetailItem' },
                    'name',
                    orderDirection
                ]
            ];
        } else if (order_by === 'po_code') {
            order = [
                [
                    { model: t_penerimaan_barang_d, as: 'piDetailPenerimaanBarangDetail' },
                    { model: t_purchase_order, as: 'pbDetailPurchaseOrder' },
                    'code',
                    orderDirection
                ]
            ];
        } else if (order_by === 'pi_code') {
            order = [
                [
                    { model: t_purchase_invoice, as: 'piDetail' },
                    'code',
                    orderDirection
                ]
            ];
        } else if (order_by === 'pi_date') {
            order = [
                [
                    { model: t_purchase_invoice, as: 'piDetail' },
                    'date',
                    orderDirection
                ]
            ];
        } else if (order_by === 'supplier_name') {
            order = [
                [
                    { model: t_purchase_invoice, as: 'piDetail' },
                    { model: m_supplier, as: 'piSupplier' },
                    'name',
                    orderDirection
                ]
            ];
        } else {
            order = [['createdAt', 'DESC']];
        }

        const queryOptions = {
            where: whereClause,
            include,
            order,
            subQuery: false,
            distinct: true,
            raw: false,
            nest: true,
        };

        if (usePagination) {
            queryOptions.limit = limit;
            queryOptions.offset = offset;
        }

        const { count, rows } = await t_purchase_invoice_d.findAndCountAll(queryOptions);

        const processedRows = rows.map(row => {
            const rowData = row.toJSON();
            const cleanRowData = {
                id: rowData.id,
                t_purchase_invoice_id: rowData.t_purchase_invoice_id,
                item_receipt_d_id: rowData.item_receipt_d_id,
                discount_amt: rowData.discount_amt,
                qty: rowData.qty,
                price: rowData.price,
                notes: rowData.notes,
                discount_rate: rowData.discount_rate,
                discount_total: rowData.discount_total,
                dpp: rowData.dpp,
                ppn_rate: rowData.ppn_rate,
                pph_rate: rowData.pph_rate,
                ppn_nominal: rowData.ppn_nominal,
                pph_nominal: rowData.pph_nominal,
                total: rowData.total,
                createdAt: rowData.createdAt,
                updatedAt: rowData.updatedAt,
                piDetail: rowData.piDetail || null
            };

            if (rowData.piDetailPenerimaanBarangDetail) {
                const penerimaan = rowData.piDetailPenerimaanBarangDetail;

                cleanRowData.piDetailPenerimaanBarangDetail = {
                    id: penerimaan.id,
                    t_penerimaan_barang_id: penerimaan.t_penerimaan_barang_id,
                    purchase_order_id: penerimaan.purchase_order_id,
                    purchase_order_d_id: penerimaan.purchase_order_d_id,
                    item_id: penerimaan.item_id,
                    qty_received: penerimaan.qty_received,
                    qty_receipt: penerimaan.qty_receipt,
                    notes: penerimaan.notes,
                    createdAt: penerimaan.createdAt,
                    updatedAt: penerimaan.updatedAt
                };

                // Handle pbDetailPenerimaanBarang with field mapping
                if (penerimaan.pbDetailPenerimaanBarang) {
                    const originalPB = penerimaan.pbDetailPenerimaanBarang;

                    cleanRowData.piDetailPenerimaanBarangDetail.pbDetailPenerimaanBarang = {
                        id: originalPB.id,
                        code: originalPB.code,
                        no_sj_supplier: originalPB.no_sj_supplier || originalPB.no_sj_s || null,
                        date: originalPB.date
                    };
                }

                // Handle pbDetailPurchaseOrder with field mapping
                if (penerimaan.pbDetailPurchaseOrder) {
                    const originalPO = penerimaan.pbDetailPurchaseOrder;

                    cleanRowData.piDetailPenerimaanBarangDetail.pbDetailPurchaseOrder = {
                        id: originalPO.id,
                        unit_business_name: originalPO.unit_business_name || originalPO.unit_bussi || originalPO.unit_bussiness_name || null,
                        code: originalPO.code,
                        date: originalPO.date,
                        selling_price: originalPO.selling_price || originalPO.selling_pr || null,
                        dpp: originalPO.total_dpp || null,
                        ppn_nominal: originalPO.ppn_nominal || originalPO.ppn_nomina || null,
                        pph_nominal: originalPO.pph_nominal || originalPO.pph_nomina || null,
                        total_discount: originalPO.total_discount || originalPO.total_disc || null,
                        currency: originalPO.currency
                    };
                }

                if (penerimaan.pbDetailPurchaseOrderDetail) {
                    const originalPOD = penerimaan.pbDetailPurchaseOrderDetail;

                    cleanRowData.piDetailPenerimaanBarangDetail.pbDetailPurchaseOrderDetail = {
                        id: originalPOD.id,
                        purchase_order_id: originalPOD.purc || originalPOD.purchase_order_id,
                        item_id: originalPOD.item || originalPOD.item_id,
                        reference: originalPOD.refe || originalPOD.reference,
                        qty: originalPOD.qty,
                        price: originalPOD.pric || originalPOD.price,
                        discount: originalPOD.disc || originalPOD.discount,
                        total: originalPOD.tota || originalPOD.total,
                        notes: originalPOD.note || originalPOD.notes,
                        ppn: originalPOD.ppn,
                        ppn_nominal: originalPOD.ppn_ || originalPOD.ppn_nominal,
                        pph: originalPOD.pph,
                        pph_nominal: originalPOD.pph_ || originalPOD.pph_nominal,
                        uom: originalPOD.uom,
                        dpp: originalPOD.dpp,
                        createdAt: originalPOD.crea || originalPOD.createdAt,
                        updatedAt: originalPOD.upda || originalPOD.updatedAt
                    };
                }

                if (penerimaan.pbDetailItem) {
                    cleanRowData.piDetailPenerimaanBarangDetail.pbDetailItem = penerimaan.pbDetailItem;
                }
            }

            return cleanRowData;
        });

        const totalPages = usePagination ? Math.ceil(count / limit) : 1;

        return res.json({
            status: "success",
            data: processedRows,
            pagination: {
                total: count,
                page: usePagination ? page : 1,
                totalPages: usePagination ? totalPages : 1,
                limit: usePagination ? limit : count,
                currentRowsCount: processedRows.length,
                next_page: usePagination && page < totalPages ? page + 1 : null,
                prev_page: usePagination && page > 1 ? page - 1 : null,
            },
        });
    },
    
    async getPurchaseInvoiceDebitAndCreditNote(req, res) {
        const { id } = req.query;
        const {
            t_purchase_invoice,
            t_purchase_return
        } = req.models;

        try {
            // ambil data purchase invoice
            const purchaseInvoice = await t_purchase_invoice.findOne(
                { where: { id, status: 'POSTED' } }
            )

            if (!purchaseInvoice) {
                res.status(404).json({ message: 'Purchase invoice tidak ditemukan' })
            }

            // ambil data total return
            let totalReturn = 0;
            const purchaseReturns = await t_purchase_return.findAll({
                where: { purchase_invoice_id: id, status: 'APPROVED' }
            })

            for (const ret of purchaseReturns) {
                totalReturn += ret.total;
            }

            const invoiceData = purchaseInvoice.toJSON();
            invoiceData.total_return = totalReturn;

            return res.status(200).json({
                message: 'Success',
                data: invoiceData,
            });
        } catch (err) {
            res.status(500).json({ error: err.message, message: 'Gagal mendapatkan data' });
        }
    }
};
