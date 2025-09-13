// Controller for t_purchase_invoice_d
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_purchase_invoice_d
//
// Tambahkan custom function di bawah ini

import user_default from '../models/user_default.js'
import { literal, Op, fn, col, Sequelize } from "sequelize";

export const t_purchase_invoice_dController = {
    // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
    async uploadImage(req, res) {
        const fileFields = Object.keys(req.models.t_purchase_invoice_d.rawAttributes).filter(
            key => req.models.t_purchase_invoice_d.rawAttributes[key].type && req.models.t_purchase_invoice_d.rawAttributes[key].type.key === 'STRING'
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
            const inserted = await req.models.t_purchase_invoice_d.create(data);
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
            const inserted = await req.models.t_purchase_invoice_d.bulkCreate(records);
            res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async summaryRecapReportIndex(req, res) {
        const {
            t_penerimaan_barang,
            t_purchase_order,
            t_purchase_request,
            m_unit_bussiness,
            t_purchase_invoice,
            m_supplier,
            m_currency,
            m_item,
        } = req.models;

        const {
            unit_bussiness_id,
            start_date,
            end_date,
            status,
            purchase_order_id,
            grand_total,
            supplier_id,
            id,
            menu_id,
            auth_user_id,
            order_by,
            order_as,
            withPagination
        } = req.query;

        const usePagination = withPagination !== 'false';

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.paginate) || 10;
        const offset = (page - 1) * limit;


        const wherePBClause = {};
        const wherePIClause = {};

        if (unit_bussiness_id) {
            const ids = unit_bussiness_id.split(",");
            wherePBClause.unit_bussiness_id = { [Op.in]: ids };
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
            wherePIClause.date = { 
                [Op.between]: [getStartOfDay(start_date), getEndOfDay(end_date)] 
            };
        } else if (start_date) {
            wherePIClause.date = { [Op.gte]: getStartOfDay(start_date) };
        } else if (end_date) {
            wherePIClause.date = { [Op.lte]: getEndOfDay(end_date) };
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

        if (grand_total) {
            // wherePIClause.date = { [Op.lte]: grand_total };
        }

        const include = [
            {
                model: m_supplier,
                as: 'piSupplier',
                attributes: ['code', 'name'],
                required: false
            },
            {
                model: m_currency,
                as: 'piCurrency',
                attributes: ['code', 'name'],
                required: false
            },
            {
                model: t_penerimaan_barang,
                as: 'piPenerimaanBarang',
                attributes: ['code', 'date'],
                required: true,
                where: wherePBClause,
                include: [
                    {
                        model: m_unit_bussiness,
                        as: 'pbCompany',
                        attributes: ['name'],
                        required: false
                    },
                    {
                        model: t_purchase_order,
                        as: 'pbPurchaseOrder',
                        attributes: ['code'],
                        required: false,
                    },
                    {
                        model: t_purchase_request,
                        as: 'pbPurchaseRequest',
                        attributes: ['code'],
                        required: false
                    },
                ]
            },
        ];

        const orderDirection = order_as?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        let order = [['date', orderDirection]];

        const queryOptions = {
            where: wherePIClause,
            include,
            order,
        };

        if (usePagination) {
            queryOptions.limit = limit;
            queryOptions.offset = offset;
        }

        const { count, rows } = await t_purchase_invoice.findAndCountAll(queryOptions);

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

    async detailRecapReportIndex(req, res) {
        const {
            t_penerimaan_barang,
            t_penerimaan_barang_d,
            t_purchase_order,
            t_purchase_request,
            m_unit_bussiness,
            t_purchase_invoice,
            t_purchase_invoice_d,
            m_supplier,
            m_currency,
            m_item,
            m_gen,
        } = req.models;

        const {
            unit_bussiness_id,
            start_date,
            end_date,
            status,
            purchase_order_id,
            grand_total,
            supplier_id,
            id,
            menu_id,
            auth_user_id,
            order_by,
            order_as,
            withPagination
        } = req.query;

        const usePagination = withPagination !== 'false';

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.paginate) || 10;
        const offset = (page - 1) * limit;


        const wherePBClause = {};
        const wherePIClause = {};

        if (unit_bussiness_id) {
            const ids = unit_bussiness_id.split(",");
            wherePBClause.unit_bussiness_id = { [Op.in]: ids };
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
            wherePIClause.date = { 
                [Op.between]: [getStartOfDay(start_date), getEndOfDay(end_date)] 
            };
        } else if (start_date) {
            wherePIClause.date = { [Op.gte]: getStartOfDay(start_date) };
        } else if (end_date) {
            wherePIClause.date = { [Op.lte]: getEndOfDay(end_date) };
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

        if (grand_total) {
            // wherePIClause.date = { [Op.lte]: grand_total };
        }

        const include = [
            {
                model: m_gen,
                as: 'piDetailUom',
                attributes: ['id', 'value1']
            },
            {
                model: t_purchase_invoice,
                as: 'piDetail',
                required: true,
                where: wherePIClause,
                include: [
                    {
                        model: m_supplier,
                        as: 'piSupplier',
                        attributes: ['code', 'name'],
                        required: false
                    },
                    {
                        model: m_currency,
                        as: 'piCurrency',
                        attributes: ['code', 'name'],
                        required: false
                    },
                    {
                        model: t_penerimaan_barang,
                        as: 'piPenerimaanBarang',
                        attributes: ['code', 'date'],
                        required: true,
                        where: wherePBClause,
                        include: [
                            {
                                model: m_unit_bussiness,
                                as: 'pbCompany',
                                attributes: ['name'],
                                required: false
                            },
                            {
                                model: t_purchase_order,
                                as: 'pbPurchaseOrder',
                                attributes: ['code'],
                                required: false,
                            },
                            {
                                model: t_purchase_request,
                                as: 'pbPurchaseRequest',
                                attributes: ['code'],
                                required: false
                            },
                        ]
                    },
                ]
            },
            {
                model: t_penerimaan_barang_d,
                as: 'piDetailPenerimaanBarangDetail',
                attributes: ['item_id'],
                required: false,
                include: [
                    {
                        model: m_item,
                        as: 'pbDetailItem',
                        attributes: ['code', 'name', 'actual_weight'],
                        required: false,
                    },
                ]
            }
        ];

        const orderDirection = order_as?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        let order = [['createdAt', orderDirection]];

        const queryOptions = {
            include,
            order,
        };

        if (usePagination) {
            queryOptions.limit = limit;
            queryOptions.offset = offset;
        }

        const { count, rows } = await t_purchase_invoice_d.findAndCountAll(queryOptions);

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

    async supplierRecapReportIndex(req, res) {
        const {
            t_penerimaan_barang,
            t_penerimaan_barang_d,
            t_purchase_order,
            t_purchase_order_d,
            t_purchase_request,
            m_unit_bussiness,
            t_purchase_invoice,
            t_purchase_invoice_d,
            m_supplier,
            m_currency,
            m_item,
            m_gen
        } = req.models;

        const {
            unit_bussiness_id,
            start_date,
            end_date,
            status,
            purchase_order_id,
            grand_total,
            supplier_id,
            id,
            menu_id,
            auth_user_id,
            order_by,
            order_as,
            withPagination
        } = req.query;

        const usePagination = withPagination !== 'false';

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.paginate) || 10;
        const offset = (page - 1) * limit;

        const wherePBClause = {};
        const wherePIClause = {};

        if (unit_bussiness_id) {
            const ids = unit_bussiness_id.split(",");
            wherePBClause.unit_bussiness_id = { [Op.in]: ids };
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
            wherePIClause.date = { 
                [Op.between]: [getStartOfDay(start_date), getEndOfDay(end_date)] 
            };
        } else if (start_date) {
            wherePIClause.date = { [Op.gte]: getStartOfDay(start_date) };
        } else if (end_date) {
            wherePIClause.date = { [Op.lte]: getEndOfDay(end_date) };
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

        if (grand_total) {
            // wherePIClause.date = { [Op.lte]: grand_total };
        }

        const include = [
            {
                model: t_purchase_invoice,
                as: 'piDetail',
                required: true,
                where: wherePIClause,
                include: [
                    {
                        model: m_supplier,
                        as: 'piSupplier',
                        attributes: ['code', 'name'],
                        required: false
                    },
                    {
                        model: m_currency,
                        as: 'piCurrency',
                        attributes: ['code', 'name'],
                        required: false
                    },
                    {
                        model: t_penerimaan_barang,
                        as: 'piPenerimaanBarang',
                        attributes: ['code', 'date'],
                        required: true,
                        where: wherePBClause,
                        include: [
                            {
                                model: m_unit_bussiness,
                                as: 'pbCompany',
                                attributes: ['name'],
                                required: false
                            },
                            {
                                model: t_purchase_order,
                                as: 'pbPurchaseOrder',
                                attributes: ['code'],
                                required: false,
                            },
                            {
                                model: t_purchase_request,
                                as: 'pbPurchaseRequest',
                                attributes: ['code'],
                                required: false
                            },
                        ]
                    },
                ]
            },
            {
                model: t_penerimaan_barang_d,
                as: 'piDetailPenerimaanBarangDetail',
                attributes: ['item_id'],
                required: false,
                include: [
                    {
                        model: t_purchase_order,
                        as: 'pbDetailPurchaseOrder',
                        required: false,
                    },
                    {
                        model: m_item,
                        as: 'pbDetailItem',
                        attributes: ['code', 'name', 'actual_weight'],
                        required: false,
                        include: [
                            {
                                model: m_gen,
                                as: 'itemUom',
                                attributes: ['value1']
                            }
                        ]
                    }
                ]
            }
        ];

        const orderDirection = order_as?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        let order = [['createdAt', orderDirection]];

        const queryOptions = {
            include,
            order,
            distinct: true,
        };

        if (usePagination) {
            queryOptions.limit = limit;
            queryOptions.offset = offset;
        }

        const { count, rows } = await t_purchase_invoice_d.findAndCountAll(queryOptions);

        const processedRows = rows.map(row => {
            const rowData = row.toJSON ? row.toJSON() : row;

            if (rowData.piDetailPenerimaanBarangDetail && 
                rowData.piDetailPenerimaanBarangDetail.pbDetailPurchaseOrder) {
                
                const poDetail = rowData.piDetailPenerimaanBarangDetail.pbDetailPurchaseOrder;

                rowData.piDetailPenerimaanBarangDetail.pbDetailPurchaseOrder = {
                    id: poDetail.id,
                    qty: poDetail.qty,
                    price: poDetail.selling_pr || poDetail.selling_pr,
                    discount: poDetail.total_disc || poDetail.total_disc ,
                    ppn: poDetail.ppn,
                    ppn_nominal: poDetail.ppn_nomina || poDetail.ppn_nomina	,
                    pph: poDetail.pph,
                    pph_nominal: poDetail.pph_nomina || poDetail.pph_nomina	,
                    dpp: poDetail.total_dpp	,
                };

                const qty = Number(rowData.qty || 0);
                const dpp = Number(poDetail.total_dpp || 0);
                const ppn_nominal = Number(poDetail.ppn_nomina || 0);
                const pph_nominal = Number(poDetail.pph_nomina || 0);
                const discount = Number(poDetail.total_disc || 0);
                const price = Number(poDetail.selling_pr || 0)

                const amount = qty * dpp;
                const grand_total = amount + ppn_nominal + pph_nominal - discount;

                rowData.piDetailPenerimaanBarangDetail.pbDetailPurchaseOrder = {
                    qty,
                    dpp,
                    ppn_nominal,
                    pph_nominal,
                    discount,
                    amount,
                    price,
                    grand_total
                };
            }
            return rowData;
        });

        let filteredRows = processedRows;
        if (grand_total) {
            const maxGrandTotal = Number(grand_total);
            filteredRows = processedRows.filter(row => {
                const po = row.piDetailPenerimaanBarangDetail?.pbDetailPurchaseOrder;
                return po && po.grand_total <= maxGrandTotal;
            });
        }

        const totalPages = usePagination
            ? Math.ceil(filteredRows.length / limit)
            : 1;

        return res.json({
            status: "success",
            data: usePagination
                ? filteredRows.slice(offset, offset + limit)
                : filteredRows,
            pagination: {
                total: filteredRows.length,
                page: usePagination ? page : 1,
                totalPages,
                limit: usePagination ? limit : filteredRows.length,
                currentRowsCount: usePagination
                    ? filteredRows.slice(offset, offset + limit).length
                    : filteredRows.length,
                next_page: usePagination && page < totalPages ? page + 1 : null,
                prev_page: usePagination && page > 1 ? page - 1 : null,
            },
        });
    },
};
