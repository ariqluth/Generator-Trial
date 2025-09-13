// Controller for t_news_program
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_news_program
//
// Tambahkan custom function di bawah ini

import { Op, literal } from "sequelize";

export const t_news_programController = {
    // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
    async uploadImage(req, res) {
        const fileFields = Object.keys(req.models.t_news_program.rawAttributes).filter(
            key => req.models.t_news_program.rawAttributes[key].type && req.models.t_news_program.rawAttributes[key].type.key === 'STRING'
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
            const inserted = await req.models.t_news_program.create(data);
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
            const inserted = await req.models.t_news_program.bulkCreate(records);
            res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async generateCode(req, res) {
        const params = req.query;
        const code = await getCodeStructure(req.models.t_news_program, params.menu_id, params.unit_bussiness_id)
        if (code.status === 'err') {
            res.json(errorResponse(code.error))
        }
        res.json(successResponse(code.data))
    },

    // Contoh: Custom function
    async customFunction(req, res) {
        res.json({ message: 'Custom function untuk t_news_program', body: req.body, query: req.query });
    },

    async customIndex(req, res) {
        const { m_gen, m_supplier, m_unit_bussiness, t_purchase_order, t_news_program, t_news_program_approval, m_approval, m_approval_d } = req.models;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.paginate) || 10;
        const offset = (page - 1) * limit;

        let searchConditions = buildSearchQuery(req.query.search || null, req.query.searchfield || null);

        const where = {};

        if (searchConditions.length > 0) {
            where[Op.or] = searchConditions;
        }

        if (req.query.search_code) {
            where.code = {
                [Op.like]: `%${req.query.search_code}%`
            };
        }

        if (req.query.search_date) {
            const searchDate = req.query.search_date;
            if (searchDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                const startDate = new Date(`${searchDate}T00:00:00.000Z`);
                const endDate = new Date(`${searchDate}T23:59:59.999Z`);
                where.date = {
                    [Op.between]: [startDate, endDate]
                };
            } else if (searchDate.match(/^\d{4}-\d{2}$/)) {
                const year = parseInt(searchDate.split('-')[0]);
                const month = parseInt(searchDate.split('-')[1]) - 1;
                const startDate = new Date(year, month, 1);
                const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
                where.date = {
                    [Op.between]: [startDate, endDate]
                };
            } else if (searchDate.match(/^\d{4}$/)) {
                const year = parseInt(searchDate);
                const startDate = new Date(year, 0, 1);
                const endDate = new Date(year, 11, 31, 23, 59, 59, 999);
                where.date = {
                    [Op.between]: [startDate, endDate]
                };
            } else {
                where.date = {
                    [Op.like]: `${searchDate}%`
                };
            }
        }

        if (req.query.search_reason) {
            where.reason = {
                [Op.like]: `%${req.query.search_reason}%`
            };
        }

        let companyIncludeWhere = {};
        if (req.query.search_unit_business_name) {
            companyIncludeWhere.name = {
                [Op.like]: `%${req.query.search_unit_business_name}%`
            };
        }

        let purchaseOrderIncludeWhere = {};
        if (req.query.search_purchase_order_code) {
            purchaseOrderIncludeWhere.code = {
                [Op.like]: `%${req.query.search_purchase_order_code}%`
            };
        }

        let supplierIncludeWhere = {};
        if (req.query.search_supplier_name) {
            supplierIncludeWhere.name = {
                [Op.like]: `%${req.query.search_supplier_name}%`
            };
        }

        let itemTypeIncludeWhere = {};
        if (req.query.search_item_type) {
            itemTypeIncludeWhere.value1 = {
                [Op.like]: `%${req.query.search_item_type}%`
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

        const hasAssociationSearch = Object.keys(companyIncludeWhere).length > 0 || 
                                    Object.keys(purchaseOrderIncludeWhere).length > 0 || 
                                    Object.keys(supplierIncludeWhere).length > 0 ||
                                    Object.keys(itemTypeIncludeWhere).length > 0;

        let combinedPurchaseOrderWhere = {};
        if (Object.keys(purchaseOrderIncludeWhere).length > 0) {
            combinedPurchaseOrderWhere = { ...purchaseOrderIncludeWhere };
        }

        const include = [
            {
                model: t_purchase_order,
                as: 'tbaPurchaseOrder',
                required: hasAssociationSearch ? true : true,
                where: Object.keys(combinedPurchaseOrderWhere).length > 0 ? combinedPurchaseOrderWhere : undefined,
                include: [
                    {
                        model: m_gen,
                        as: 'poItemType',
                        attributes: ['id', 'value1'],
                        where: Object.keys(itemTypeIncludeWhere).length > 0 ? itemTypeIncludeWhere : undefined,
                        required: Object.keys(itemTypeIncludeWhere).length > 0 ? true : false
                    },
                    {
                        model: m_supplier,
                        as: 'poSupplier',
                        attributes: ['id', 'name'],
                        where: Object.keys(supplierIncludeWhere).length > 0 ? supplierIncludeWhere : undefined,
                        required: Object.keys(supplierIncludeWhere).length > 0 ? true : false
                    },
                    {
                        model: m_unit_bussiness,
                        as: 'poCompany',
                        attributes: ['id', 'name'],
                        where: Object.keys(companyIncludeWhere).length > 0 ? companyIncludeWhere : undefined,
                        required: Object.keys(companyIncludeWhere).length > 0 ? true : false
                    },
                ]
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
                    model: t_news_program_approval,
                    as: 'newsProgramApprovals',
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

        const { count, rows } = await t_news_program.findAndCountAll({
            include,
            where,
            order,
            limit,
            offset,
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

    async getAvailablePurchaseOrders(req, res) {
        const { search, paginate = 10 } = req.query;
        const { t_purchase_order, t_news_program } = req.models;

        let whereConditions = {
            status: 'APPROVED'
        };

        if (search) {
            whereConditions.code = { [Op.like]: `%${search}%` };
        }

        const purchaseOrders = await t_purchase_order.findAll({
            where: {
                ...whereConditions,
                [Op.and]: [
                    // PO hanya muncul jika tidak punya berita acara yang statusnya mengunci
                    literal(`
                        NOT EXISTS (
                            SELECT 1
                            FROM t_news_program ba
                            WHERE ba.purchase_order_id = t_purchase_order.id
                            AND ba.status IN ('IN_APPROVAL', 'APPROVED', 'REVISED')
                        )
                    `),
                    // PO hanya muncul jika belum pernah dipakai di penerimaan barang
                    literal(`
                        NOT EXISTS (
                            SELECT 1
                            FROM t_penerimaan_barang pb
                            WHERE pb.purchase_order_id = t_purchase_order.id
                        )
                    `),
                    // PO hanya muncul jika belum pernah di closing
                    literal(`
                        NOT EXISTS (
                            SELECT 1
                            FROM t_purchase_order_closing poc
                            WHERE poc.purchase_order_id = t_purchase_order.id
                            AND poc.status = 'POSTED'
                        )
                    `)
                ],
            },
            attributes: ['id', 'code'],
            order: [['code', 'DESC']],
            limit: parseInt(paginate, 10)
        });

        return res.json(successResponse(purchaseOrders));
    }


};
