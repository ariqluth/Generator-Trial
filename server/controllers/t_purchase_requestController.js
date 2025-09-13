// Controller for t_purchase_request
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_purchase_request
//
// Tambahkan custom function di bawah ini

import t_purchase_request from '../models/t_purchase_request.js';
import t_purchase_request_d from '../models/t_purchase_request_d.js';
import t_purchase_order from '../models/t_purchase_order.js';
import t_purchase_order_d from '../models/t_purchase_order_d.js';
import m_gen from '../models/m_gen.js';
import m_item from '../models/m_item.js';
import t_purchase_request_closing from '../models/t_purchase_request_closing.js';
import t_purchase_request_closing_d from '../models/t_purchase_request_closing_d.js';
import m_unit_bussiness from '../models/m_unit_bussiness.js';
import { Op, fn, col, literal } from "sequelize";
import { user as user_default } from '../models/index.js';

export const t_purchase_requestController = {
    // Contoh: Upload gambar ke database (kolom image: Buffer/BLOB)
    async uploadImage(req, res) {
        const imageFile = req.files?.find(f => f.mimetype.startsWith('image/'));
        if (!imageFile) return res.status(400).json({ error: 'No image file found' });
        try {
            const inserted = await req.models.t_purchase_request.create({ image: imageFile.buffer });
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
            const inserted = await req.models.t_purchase_request.bulkCreate(records);
            res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async getStockAllWarehouse(req, res) {
        try {
            const unit_bussiness_id = req.query.unit_bussiness_id;
            const item_ids = req.query.item_ids;

            const itemIdsArray = Array.isArray(item_ids)
                ? item_ids
                : item_ids.split(',');

            const result = await inventoryService.getCurrentStockForItemsByCompany(itemIdsArray, unit_bussiness_id);

            return res.json(successResponse(result));
        } catch (error) {
            return res.json(errorResponse(error));
        }
    },

    async fetchPRFilter(req, res) {
        try {
            const { t_purchase_request } = req.models;
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

            const purchaseRequests = await t_purchase_request.findAll({
                attributes: ['id', 'code'],
                where: whereConditions,
                order: [['createdAt', 'DESC']]
            });

            return res.json({
                data: purchaseRequests
            });
        } catch (error) {
            return res.status(500).json({
                message: "Error fetching purchase request",
                error: error.message
            });
        }
    },

    async generateCode(req, res) {
        const params = req.query;
        const code = await getCodeStructure(t_purchase_request, params.menu_id, params.unit_bussiness_id)
        if (code.status === 'err') {
            res.json(errorResponse(code.error))
        }
        res.json(successResponse(code.data))
    },

    async customIndex(req, res) {
        const { m_approval, m_approval_d, t_purchase_request_approval } = req.models;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.paginate) || 10;
        const offset = (page - 1) * limit;

        let searchConditions = buildSearchQuery(req.query.search || null, req.query.searchfield || null);

        let columnSearchConditions = [];

        if (req.query.search_unit_business_name) {
            columnSearchConditions.push({
                '$purchaseRequestCompany.name$': {
                    [Op.iLike]: `%${req.query.search_unit_business_name}%`
                }
            });
        }

        if (req.query.search_code) {
            columnSearchConditions.push({
                'code': {
                    [Op.iLike]: `%${req.query.search_code}%`
                }
            });
        }

        if (req.query.search_date) {
            const searchDate = req.query.search_date;
            if (searchDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                columnSearchConditions.push({
                    'date': {
                        [Op.eq]: searchDate
                    }
                });
            } else {
                columnSearchConditions.push({
                    'date': {
                        [Op.iLike]: `${searchDate}%`
                    }
                });
            }
        }

        if (req.query.search_date_required) {
            const searchDateRequired = req.query.search_date_required;
            if (searchDateRequired.match(/^\d{4}-\d{2}-\d{2}$/)) {
                columnSearchConditions.push({
                    'date_required': {
                        [Op.eq]: searchDateRequired
                    }
                });
            } else {
                columnSearchConditions.push({
                    'date_required': {
                        [Op.iLike]: `${searchDateRequired}%`
                    }
                });
            }
        }

        if (req.query.search_notes) {
            columnSearchConditions.push({
                'notes': {
                    [Op.iLike]: `%${req.query.search_notes}%`
                }
            });
        }

        if (req.query.search_item_type) {
            columnSearchConditions.push({
                '$purchaseRequestItemType.value1$': {
                    [Op.iLike]: `%${req.query.search_item_type}%`
                }
            });
        }

        const where = {};

        let globalSearchConditions = [];
        if (req.query.search_all) {
            globalSearchConditions.push(
                { 'code': { [Op.iLike]: `%${req.query.search_all}%` } },
                { 'notes': { [Op.iLike]: `%${req.query.search_all}%` } },
                { '$purchaseRequestCompany.name$': { [Op.iLike]: `%${req.query.search_all}%` } },
                { '$purchaseRequestItemType.value1$': { [Op.iLike]: `%${req.query.search_all}%` } }
            );
        } else if (searchConditions.length > 0) {
            globalSearchConditions = searchConditions;
        }

        const orGlobalSearch = globalSearchConditions.length > 0 ? { [Op.or]: globalSearchConditions } : null;
        const orColumnSearch = columnSearchConditions.length > 0 ? { [Op.or]: columnSearchConditions } : null;

        const andConditions = [];
        if (orGlobalSearch) andConditions.push(orGlobalSearch);
        if (orColumnSearch) andConditions.push(orColumnSearch);

        if (andConditions.length > 0) {
            where[Op.and] = andConditions;
        }

        Object.entries(req.query).forEach(([key, value]) => {
            if (key.startsWith("filter_column_")) {
                const columnName = key.replace("filter_column_", "");
                where[columnName] = value;
            }
        });

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
                model: t_purchase_request_d,
                as: 'purchaseRequestDetails',
            },
            {
                model: t_purchase_order_d,
                as: 'poDetailPrRequests',
                attributes: [],
            },
            {
                model: m_gen,
                as: 'purchaseRequestDivision',
                attributes: ['id', 'value1'],
            },
            {
                model: m_gen,
                as: 'purchaseRequestItemType',
                attributes: ['id', 'value1'],
                required: false
            },
            {
                model: m_unit_bussiness,
                as: 'purchaseRequestCompany',
                attributes: ['id', 'name'],
                required: false
            },
            {
                model: user_default,
                as: 'prCreatedBy',
                attributes: ['name'],
            },
            {
                model: user_default,
                as: 'prUpdatedBy',
                attributes: ['name'],
            },
        ];

        if (req.query.auth_user_id && req.query.menu_id) {
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
                    model: t_purchase_request_approval,
                    as: 'prApprovalPRs',
                    attributes: ['id', 'user_id', 'status', 'full_approval'],
                    required: true,
                    where: {
                        user_id: req.query.auth_user_id
                    }
                });
            }
        }

        const { count, rows } = await t_purchase_request.findAndCountAll({
            include,
            where,
            order,
            limit,
            offset,
            distinct: true,
            subQuery: false
        });

        const purchaseRequestIds = rows.map(row => row.id);

        const prQtyData = await t_purchase_request_d.findAll({
            attributes: [
                'purchase_request_id',
                [fn('SUM', col('qty')), 'total_pr_qty']
            ],
            where: {
                purchase_request_id: {
                    [Op.in]: purchaseRequestIds
                }
            },
            group: ['purchase_request_id'],
            raw: true
        });

        const poQtyData = await t_purchase_order_d.findAll({
            attributes: [
                'purchase_request_id',
                [fn('SUM', col('qty')), 'total_po_qty']
            ],
            where: {
                purchase_request_id: {
                    [Op.in]: purchaseRequestIds
                }
            },
            group: ['purchase_request_id'],
            raw: true
        });

        const prQtyMap = prQtyData.reduce((map, item) => {
            map[item.purchase_request_id] = parseFloat(item.total_pr_qty) || 0;
            return map;
        }, {});

        const poQtyMap = poQtyData.reduce((map, item) => {
            map[item.purchase_request_id] = parseFloat(item.total_po_qty) || 0;
            return map;
        }, {});

        const enrichedRows = rows.map(row => {
            const rowData = row.toJSON();
            const prId = row.id;

            const totalPrQty = prQtyMap[prId] || 0;
            const totalPoQty = poQtyMap[prId] || 0;

            let poStatus = 'DRAFT';
            if (totalPoQty > 0) {
                if (totalPoQty < totalPrQty) {
                    poStatus = 'OUTSTANDING';
                } else {
                    poStatus = 'ORDERED';
                }
            }

            return {
                ...rowData,
                total_pr_qty: totalPrQty,
                total_po_qty: totalPoQty,
                po_status: poStatus
            };
        });

        const total = Array.isArray(count) ? count.length : count;
        const totalPages = Math.ceil(total / limit);

        return res.json({
            status: "success",
            data: enrichedRows,
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

    async summaryReportIndex(req, res) {
        const { m_approval, m_approval_d, t_purchase_request_approval } = req.models;

        const page = 1;
        const limit = null;
        const offset = null;

        let where = {};

        if (req.query.where) {
            try {
                const parsedWhere = await parseWhereQueryParam(req.query.where);
                where = { ...where, ...parsedWhere };
            } catch (error) {
                console.warn("Failed to parse where parameter:", error.message);
            }
        }

        if (req.query.unit_bussiness_id) {
            const rawIds = Array.isArray(req.query.unit_bussiness_id)
                ? req.query.unit_bussiness_id
                : req.query.unit_bussiness_id.split(',');
            where.unit_bussiness_id = { [Op.in]: rawIds };
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
            where.createdAt = { [Op.between]: [startDate, endDate] };
        } else if (req.query.start_date) {
            where.createdAt = { [Op.gte]: getStartOfDay(req.query.start_date) };
        } else if (req.query.end_date) {
            where.createdAt = { [Op.lte]: getEndOfDay(req.query.end_date) };
        }

        if (req.query.required_start_date && req.query.required_end_date) {
            const startDate = getStartOfDay(req.query.required_start_date);
            const endDate = getEndOfDay(req.query.required_end_date);

            where.date_required = { [Op.between]: [startDate, endDate] };
        } else if (req.query.required_start_date) {
            where.date_required = { [Op.gte]: getStartOfDay(req.query.required_start_date) };
        } else if (req.query.required_end_date) {
            where.date_required = { [Op.lte]: getEndOfDay(req.query.required_end_date) };
        }

        if (req.query.item_type_id) {
            where.item_type_id = req.query.item_type_id;
        }

        if (req.query.status && req.query.status !== 'all') {
            where.status = req.query.status;
        }

        if (req.query.id) {
            where.id = req.query.id;
        }

        const include = [
            {
                model: t_purchase_request_d,
                as: 'purchaseRequestDetails',
            },
            {
                model: t_purchase_order_d,
                as: 'poDetailPrRequests',
                attributes: [],
            },
            {
                model: m_gen,
                as: 'purchaseRequestDivision',
                attributes: ['id', 'value1'],
            },
            {
                model: m_gen,
                as: 'purchaseRequestItemType',
                attributes: ['id', 'value1'],
            },
            {
                model: m_unit_bussiness,
                as: 'purchaseRequestCompany',
                attributes: ['id', 'name'],
            },
            {
                model: user_default,
                as: 'prCreatedBy',
                attributes: ['name'],
            },
            {
                model: user_default,
                as: 'prUpdatedBy',
                attributes: ['name'],
            }
        ];

        const approvalInclude = {
            model: t_purchase_request_approval,
            as: 'prApprovalPRs',
            attributes: ['id', 'user_id', 'status', 'full_approval', 'createdAt'],
            required: false,
            include: [
                {
                    model: user_default,
                    as: 'prApprovalUser',
                    attributes: ['name']
                }
            ]
        };

        if (req.query.auth_user_id && req.query.menu_id) {
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
                approvalInclude.required = true;
                approvalInclude.where = { user_id: req.query.auth_user_id };
            }
        }

        include.push(approvalInclude);

        try {
            const rows = await t_purchase_request.findAll({
                include,
                where,
                order: [['createdAt', 'desc']],
                limit,
                offset,
                distinct: true
            });

            const purchaseRequestIds = rows.map(row => row.id);

            const prQtyData = await t_purchase_request_d.findAll({
                attributes: [
                    'purchase_request_id',
                    [fn('SUM', col('qty')), 'total_pr_qty']
                ],
                where: {
                    purchase_request_id: { [Op.in]: purchaseRequestIds }
                },
                group: ['purchase_request_id'],
                raw: true
            });

            const poQtyData = await t_purchase_order_d.findAll({
                attributes: [
                    'purchase_request_id',
                    [fn('SUM', col('qty')), 'total_po_qty']
                ],
                where: {
                    purchase_request_id: { [Op.in]: purchaseRequestIds }
                },
                group: ['purchase_request_id'],
                raw: true
            });

            const prQtyMap = prQtyData.reduce((map, item) => {
                map[item.purchase_request_id] = parseFloat(item.total_pr_qty) || 0;
                return map;
            }, {});

            const poQtyMap = poQtyData.reduce((map, item) => {
                map[item.purchase_request_id] = parseFloat(item.total_po_qty) || 0;
                return map;
            }, {});

            const enrichedRows = rows.map(row => {
                const rowData = row.toJSON();
                const prId = row.id;

                const totalPrQty = prQtyMap[prId] || 0;
                const totalPoQty = poQtyMap[prId] || 0;

                let poStatus = 'DRAFT';
                if (totalPoQty > 0) {
                    if (totalPoQty < totalPrQty) {
                        poStatus = 'OUTSTANDING';
                    } else {
                        poStatus = 'ORDERED';
                    }
                }

                let prApprovalLast = null;
                if (Array.isArray(rowData.prApprovalPRs) && rowData.prApprovalPRs.length > 0) {
                    const sorted = rowData.prApprovalPRs.sort((a, b) =>
                        new Date(b.createdAt) - new Date(a.createdAt)
                    );
                    const latest = sorted[0];
                    prApprovalLast = {
                        ...latest,
                        name: latest?.prApprovalUser?.name || null
                    };
                }

                return {
                    ...rowData,
                    total_pr_qty: totalPrQty,
                    total_po_qty: totalPoQty,
                    po_status: poStatus,
                    prApprovalLast
                };
            });

            return res.json({
                status: "success",
                data: enrichedRows,
                pagination: {
                    total: enrichedRows.length,
                    page,
                    totalPages: 1,
                    limit: null,
                    currentRowsCount: enrichedRows.length,
                    next_page: null,
                    prev_page: null
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 'error',
                message: error.message || 'Internal server error'
            });
        }
    },

    async detailReportIndex(req, res) {
        let where = {};

        if (req.query.where) {
            try {
                const parsedWhere = await parseWhereQueryParam(req.query.where);
                where = { ...where, ...parsedWhere };
            } catch (error) {
                console.warn("Failed to parse where parameter:", error.message);
            }
        }

        if (req.query.unit_bussiness_id) {
            const rawIds = Array.isArray(req.query.unit_bussiness_id)
                ? req.query.unit_bussiness_id
                : req.query.unit_bussiness_id.split(',');
            where['$purchaseRequestDetail.unit_bussiness_id$'] = { [Op.in]: rawIds };
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
            where.createdAt = { [Op.between]: [startDate, endDate] };
        } else if (req.query.start_date) {
            where.createdAt = { [Op.gte]: getStartOfDay(req.query.start_date) };
        } else if (req.query.end_date) {
            where.createdAt = { [Op.lte]: getEndOfDay(req.query.end_date) };
        }

        if (req.query.start_date && req.query.end_date) {
            const startDate = getStartOfDay(req.query.start_date);
            const endDate = getEndOfDay(req.query.end_date);

            where['$purchaseRequestDetail.createdAt$'] = {
                [Op.between]: [startDate, endDate]
            };
        } else if (req.query.start_date) {
            where['$purchaseRequestDetail.createdAt$'] = { 
                [Op.gte]: getStartOfDay(req.query.start_date) 
            };
        } else if (req.query.end_date) {
            where['$purchaseRequestDetail.createdAt$'] = { 
                [Op.lte]: getEndOfDay(req.query.end_date) 
            };
        }

        if (req.query.required_start_date && req.query.required_end_date) {
            const startDate = getStartOfDay(req.query.required_start_date);
            const endDate = getEndOfDay(req.query.required_end_date);

            where['$purchaseRequestDetail.date_required$'] = {
                [Op.between]: [startDate, endDate]
            };
        } else if (req.query.required_start_date) {
            where['$purchaseRequestDetail.date_required$'] = { 
                [Op.gte]: getStartOfDay(req.query.required_start_date) 
            };
        } else if (req.query.required_end_date) {
            where['$purchaseRequestDetail.date_required$'] = { 
                [Op.lte]: getEndOfDay(req.query.required_end_date) 
            };
        }

        if (req.query.item_type_id) {
            where['$purchaseRequestDetail.item_type_id$'] = req.query.item_type_id;
        }

        if (req.query.status && req.query.status !== 'all') {
            where['$purchaseRequestDetail.status$'] = req.query.status;
        }

        if (req.query.purchase_request_id) {
            where.purchase_request_id = req.query.purchase_request_id;
        }

        try {
            const rows = await t_purchase_request_d.findAll({
                attributes: [
                    'id',
                    'purchase_request_id',
                    'qty',
                    'item_uom',
                    [
                        literal(`COALESCE(CAST(SUM("poDetailPrDetails"."qty") AS INTEGER), 0)`),
                        'qty_po'
                    ],
                    [
                        fn('COALESCE', fn('SUM', col('prcDetails.qty_closing')), 0),
                        'qty_pr_closing'
                    ],
                ],
                include: [
                    {
                        model: t_purchase_request,
                        as: 'purchaseRequestDetail',
                        attributes: ['unit_bussiness_id', 'code', 'division_id', 'item_type_id', 'status', 'notes', 'createdAt', 'date_required'],
                        required: true,
                        where: {
                            status: {
                                [Op.in]: ['APPROVED', 'IN_APPROVAL']
                            }
                        },
                        include: [
                            {
                                model: m_gen,
                                as: 'purchaseRequestDivision',
                                attributes: ['id', 'value1']
                            },
                            {
                                model: m_gen,
                                as: 'purchaseRequestItemType',
                                attributes: ['id', 'value1']
                            },
                            {
                                model: m_unit_bussiness,
                                as: 'purchaseRequestCompany',
                                attributes: ['id', 'name']
                            }
                        ]
                    },
                    {
                        model: m_item,
                        as: 'purchaseRequestDetailItem',
                        attributes: ['code', 'name', 'item_uom_id'],
                        include: [
                            {
                                model: m_gen,
                                as: 'itemUom',
                                attributes: ['id', 'value1']
                            },
                        ]
                    },
                    {
                        model: t_purchase_order_d,
                        as: 'poDetailPrDetails',
                        attributes: [],
                    },
                    {
                        model: t_purchase_request_closing_d,
                        as: 'prcDetails',
                        attributes: [],
                    },
                ],
                group: [
                    't_purchase_request_d.id',
                    'purchaseRequestDetail.id',
                    'purchaseRequestDetail.purchaseRequestDivision.id',
                    'purchaseRequestDetail.purchaseRequestItemType.id',
                    'purchaseRequestDetail.purchaseRequestCompany.id',
                    'purchaseRequestDetailItem.id',
                    'purchaseRequestDetailItem.itemUom.id'
                ],
                order: [[{ model: t_purchase_request, as: 'purchaseRequestDetail' }, 'code', 'DESC']],
                where,
                subQuery: false
            });

            return res.json({
                status: "success",
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
        } catch (error) {
            return res.status(500).json({
                status: 'error',
                message: error.message || 'Internal server error'
            });
        }
    },

    async getOutstandingPr(req, res) {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.paginate) || 10;
        const offset = (page - 1) * limit;

        let searchConditions = buildSearchQuery(req.query.search || null, req.query.searchfield || null);

        let columnSearchConditions = [];
        if (req.query.search_code) {
            columnSearchConditions.push({ '$purchaseRequestDetail.code$': { [Op.iLike]: `%${req.query.search_code}%` } })
        }
        if (req.query.search_item_name) {
            columnSearchConditions.push({ '$purchaseRequestDetailItem.name$': { [Op.iLike]: `%${req.query.search_item_name}%` } })
        }

        const where = {};

        const orSearch = searchConditions.length > 0 ? { [Op.or]: searchConditions } : null;
        const orColumnSearch = columnSearchConditions.length > 0 ? { [Op.or]: columnSearchConditions } : null;

        const andConditions = [];
        if (orSearch) andConditions.push(orSearch);
        if (orColumnSearch) andConditions.push(orColumnSearch);

        if (andConditions.length > 0) {
            where[Op.and] = andConditions;
        }

        const { count, rows } = await t_purchase_request_d.findAndCountAll({
            attributes: [
                'id',
                'purchase_request_id',
                'qty',
                [
                    literal(`COALESCE(CAST(SUM("poDetailPrDetails"."qty") AS INTEGER), 0)`),
                    'qty_po'
                ],
                [
                    fn('COALESCE', fn('SUM', col('prcDetails.qty_closing')), 0),
                    'qty_pr_closing'
                ],
            ],
            include: [
                {
                    model: t_purchase_request,
                    as: 'purchaseRequestDetail',
                    attributes: ['code', 'status'],
                    required: true,
                    where: {
                        status: 'APPROVED'
                    }
                },
                {
                    model: m_item,
                    as: 'purchaseRequestDetailItem',
                    attributes: ['name'],
                },
                {
                    model: t_purchase_order_d,
                    as: 'poDetailPrDetails',
                    attributes: [],
                },
                {
                    model: t_purchase_request_closing_d,
                    as: 'prcDetails',
                    attributes: [],
                    include: [
                        {
                            model: t_purchase_request_closing,
                            as: 'prClosingDetail',
                            attributes: [],
                            required: true,
                            where: {
                                status: 'POSTED'
                            }
                        }
                    ]
                },
            ],
            group: [
                't_purchase_request_d.id',
                'purchaseRequestDetail.id',
                'purchaseRequestDetailItem.id'
            ],
            order: [[{ model: t_purchase_request, as: 'purchaseRequestDetail' }, 'code', 'DESC']],
            where,
            limit,
            offset,
            subQuery: false,
            having: literal(`t_purchase_request_d.qty - (COALESCE(SUM("poDetailPrDetails"."qty"), 0) + COALESCE(SUM("prcDetails"."qty_closing"), 0)) > 0`)
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

    async getOutstandingForPrClosing(req, res) {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.paginate) || 10;
        const offset = (page - 1) * limit;

        let searchConditions = buildSearchQuery(req.query.search || null, req.query.searchfield || null);

        const where = {};
        if (searchConditions.length > 0) {
            where[Op.or] = searchConditions;
        }

        const prDetailsWhere = {
            [Op.and]: [
                literal(`(
                    "t_purchase_request_d"."qty" > 
                    COALESCE((
                        SELECT SUM(pod.qty) 
                        FROM t_purchase_order_d pod 
                        INNER JOIN t_purchase_order po ON pod.purchase_order_id = po.id 
                        WHERE pod.purchase_request_d_id = "t_purchase_request_d"."id" 
                        AND po.status IN ('APPROVED', 'POSTED')
                    ), 0) + 
                    COALESCE((
                        SELECT SUM(prcd.qty_closing) 
                        FROM t_purchase_request_closing_d prcd 
                        INNER JOIN t_purchase_request_closing prc ON prcd.purchase_request_closing_id = prc.id 
                        WHERE prcd.purchase_request_d_id = "t_purchase_request_d"."id" 
                        AND prc.status = 'POSTED'
                    ), 0)
                )`)
            ]
        };

        const { count, rows } = await t_purchase_request_d.findAndCountAll({
            attributes: [
                'id',
                'purchase_request_id',
                'item_id',
                'item_uom_id',
                'qty',
                'on_hand',
                'notes',
                'item_name',
                'item_code',
                'item_uom',
                'createdAt',
                'updatedAt',
                [
                    literal(`COALESCE((
                        SELECT SUM(pod.qty) 
                        FROM t_purchase_order_d pod 
                        INNER JOIN t_purchase_order po ON pod.purchase_order_id = po.id 
                        WHERE pod.purchase_request_d_id = "t_purchase_request_d"."id" 
                        AND po.status IN ('APPROVED', 'POSTED')
                    ), 0)`),
                    'qty_po'
                ],
                [
                    literal(`COALESCE((
                        SELECT SUM(prcd.qty_closing) 
                        FROM t_purchase_request_closing_d prcd 
                        INNER JOIN t_purchase_request_closing prc ON prcd.purchase_request_closing_id = prc.id 
                        WHERE prcd.purchase_request_d_id = "t_purchase_request_d"."id" 
                        AND prc.status = 'POSTED'
                    ), 0)`),
                    'qty_pr_closing'
                ],
                [
                    literal(`(
                        "t_purchase_request_d"."qty" - 
                        COALESCE((
                            SELECT SUM(pod.qty) 
                            FROM t_purchase_order_d pod 
                            INNER JOIN t_purchase_order po ON pod.purchase_order_id = po.id 
                            WHERE pod.purchase_request_d_id = "t_purchase_request_d"."id" 
                            AND po.status IN ('APPROVED', 'POSTED')
                        ), 0) - 
                        COALESCE((
                            SELECT SUM(prcd.qty_closing) 
                            FROM t_purchase_request_closing_d prcd 
                            INNER JOIN t_purchase_request_closing prc ON prcd.purchase_request_closing_id = prc.id 
                            WHERE prcd.purchase_request_d_id = "t_purchase_request_d"."id" 
                            AND prc.status = 'POSTED'
                        ), 0)
                    )`),
                    'qty_outstanding'
                ]
            ],
            include: [
                {
                    model: t_purchase_request,
                    as: 'purchaseRequestDetail',
                    attributes: [
                        'id', 'code', 'status', 'unit_bussiness_name', 
                        'division', 'item_type', 'date', 'date_required'
                    ],
                    required: true,
                    where: {
                        status: 'APPROVED'
                    }
                },
                {
                    model: m_item,
                    as: 'purchaseRequestDetailItem',
                    attributes: ['id', 'name', 'code'],
                    required: false
                },
                {
                    model: m_gen,
                    as: 'purchaseRequestDetailUom',
                    attributes: ['id', 'value1'],
                    required: false
                }
            ],
            where: {
                ...where,
                ...prDetailsWhere
            },
            order: [
                [{ model: t_purchase_request, as: 'purchaseRequestDetail' }, 'code', 'DESC'],
                ['id', 'ASC']
            ],
            limit,
            offset,
            subQuery: false
        });

        const groupedData = {};
        
        rows.forEach(row => {
            const detail = row.toJSON();
            const prId = detail.purchase_request_id;
            
            if (!groupedData[prId]) {
                groupedData[prId] = {
                    id: prId,
                    code: detail.purchaseRequestDetail.code,
                    status: detail.purchaseRequestDetail.status,
                    unit_bussiness_name: detail.purchaseRequestDetail.unit_bussiness_name,
                    division: detail.purchaseRequestDetail.division,
                    item_type: detail.purchaseRequestDetail.item_type,
                    date: detail.purchaseRequestDetail.date,
                    date_required: detail.purchaseRequestDetail.date_required,
                    purchaseRequestDetails: []
                };
            }
            delete detail.purchaseRequestDetail;
            
            groupedData[prId].purchaseRequestDetails.push(detail);
        });

        const processedRows = Object.values(groupedData);
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

    async getOutstandingPRGrouped(req, res) {
        const sequelize = t_purchase_request.sequelize;
        const { search, unit_bussiness_id, item_type_id } = req.query;

        let whereClause = `WHERE pr.status = 'APPROVED'`;
        const replacements = {};

        if (search) {
            whereClause += ` AND pr.code ILIKE :search`;
            replacements.search = `%${search}%`;
        }

        if (unit_bussiness_id) {
            whereClause += ` AND pr.unit_bussiness_id = :unit_bussiness_id`;
            replacements.unit_bussiness_id = unit_bussiness_id;
        }

        if (item_type_id) {
            whereClause += ` AND mi.item_type_id = :item_type_id`;
            replacements.item_type_id = item_type_id;
        }

        const [rows] = await sequelize.query(`
            SELECT
                pr.id,
                pr.unit_bussiness_id,
                pr.code,
                pr.status,
                mi.item_type_id,
                COUNT(DISTINCT prd.id) AS total_outstanding_items,
                SUM(prd.qty - COALESCE(pod.qty, 0) - COALESCE(prc.qty_closing, 0)) AS total_outstanding_qty
            FROM t_purchase_request pr
            JOIN t_purchase_request_d prd ON pr.id = prd.purchase_request_id
            JOIN m_item mi ON mi.id = prd.item_id
            LEFT JOIN (
                SELECT pod.purchase_request_d_id, SUM(pod.qty) AS qty
                FROM t_purchase_order_d pod
                INNER JOIN t_purchase_order po ON po.id = pod.purchase_order_id
                GROUP BY pod.purchase_request_d_id
            ) pod ON pod.purchase_request_d_id = prd.id
            LEFT JOIN (
                SELECT purchase_request_d_id, SUM(qty_closing) AS qty_closing
                FROM t_purchase_request_closing_d
                GROUP BY purchase_request_d_id
            ) prc ON prc.purchase_request_d_id = prd.id
            ${whereClause}
            GROUP BY pr.id, pr.unit_bussiness_id, pr.code, pr.status, mi.item_type_id
            HAVING SUM(prd.qty - COALESCE(pod.qty, 0) - COALESCE(prc.qty_closing, 0)) > 0
        `, {
            replacements
        });

        return res.json({
            status: "success",
            data: rows
        });
    }

};
