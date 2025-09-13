// Controller for t_sales_quotation
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_sales_quotation
//
// Tambahkan custom function di bawah ini
import { fn, col, literal, Op } from "sequelize";

export const t_sales_quotationController = {
    // Contoh: Upload gambar ke database (kolom image: Buffer/BLOB)
    async uploadImage(req, res) {
        const imageFile = req.files?.find(f => f.mimetype.startsWith('image/'));
        if (!imageFile) return res.status(400).json({ error: 'No image file found' });
        try {
        const inserted = await req.models.t_sales_quotation.create({ image: imageFile.buffer });
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
        const inserted = await req.models.t_sales_quotation.bulkCreate(records);
        res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
        res.status(500).json({ error: err.message });
        }
    },

    async generateCode(req, res) {
        const params = req.query;
        const code = await getCodeStructure(req.models.t_sales_quotation, params.menu_id, params.unit_bussiness_id)
        if (code.status === 'err') {
            res.json(errorResponse(code.error))
        }
        res.json(successResponse(code.data))
    },

    async customIndex(req, res) {
        const { m_customer, user_default, m_unit_bussiness, t_sales_quotation, t_sales_quotation_approval, m_approval, m_approval_d } = req.models;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const menu_id = 'a15b76ba-daa3-4dec-8af0-03ec2d04ab71';

        let searchConditions = buildSearchQuery(req.query.search || null, req.query.searchfield || null);

        let where = {};

        if (searchConditions.length > 0) {
            where[Op.or] = searchConditions;
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
            m_customer && {
                model: m_customer,
                as: 'm_customer',
                attributes: ['id', 'code', 'name']
            },
            user_default && {
                model: user_default,
                as: 'user_default',
                attributes: ['id', 'name']
            },
            m_unit_bussiness && {
                model: m_unit_bussiness,
                as: 'm_unit_bussiness',
                attributes: ['id', 'name']
            },
        ].filter(Boolean);

        if (req.query.auth_user_id) {
            // Cek role user
            const checkAprrovalRole = await m_approval_d.findOne({
                where: {
                    user_id: req.query.auth_user_id,
                    type: 'menyetujui'
                },
                include: [{
                    model: m_approval,
                    where: {
                        menu_id: menu_id
                    },
                    attributes: []
                }]
            });

            if (checkAprrovalRole) {
                include.push({
                    model: t_sales_quotation_approval,
                    as: 't_sales_quotation_approvals',
                    attributes: [],
                    required: true,
                    where: {
                        user_id: req.query.auth_user_id
                    }
                });
            }
        }

        where = await parseWhereQueryParam(req.query.where);

        // Proses filter_column_{model_alias}.{field}
        Object.keys(req.query).forEach(key => {
            if (key.startsWith('filter_column_')) {
                const match = key.match(/^filter_column_(.+)\.(.+)$/);
                if (match) {
                    const modelAlias = match[1];
                    const field = match[2];
                    const value = req.query[key];

                    const targetInclude = include.find(i => i.as === modelAlias);
                    if (targetInclude) {
                        if (!targetInclude.where) targetInclude.where = {};
                        targetInclude.where[field] = { [Op.iLike]: `%${value}%` };
                    }
                }
            }
        });

        const { count, rows } = await t_sales_quotation.findAndCountAll({
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
                next_page: null,
                prev_page: null
            }
        });
    },

    async createSalesQuotation(req, res) {
        const payload = req.body;
        const user = req.user;
        const sequelize = req.models.t_sales_quotation.sequelize;
        const t = await sequelize.transaction();

        try {
            const details = payload.t_sales_quotation_d || [];
            let totalAmount = 0;
            const processedDetails = [];

            // Cek apakah data customer ada
            const cust = await req.models.m_customer.findByPk(payload.customer_id);
            if (!cust) {
                return res.status(404).json({ error: 'Customer tidak ditemukan' });
            }

            // Proses dan validasi detail dalam loop
            for (const detail of details) {
                const item = await req.models.m_item.findByPk(detail.item_id, { transaction: t });
                if (!item) {
                    throw new Error(`Item tidak ditemukan`);
                }

                const qty = detail.qty || 0;
                const price = detail.price || 0;
                const subtotal = qty * price;

                totalAmount += subtotal;

                processedDetails.push({
                    ...detail,
                    subtotal: parseFloat(subtotal.toFixed(2)),
                    qty_snapshot: detail.qty,
                });
            }

            // Simpan header sales quotation
            const salesQuotation = await req.models.t_sales_quotation.create({
                ...payload,
                total: parseFloat(totalAmount.toFixed(2)),
                created_by: user.id,
                // created_by: "06da1eab-b88d-4ff2-b264-c792ab386684",
            }, { transaction: t });

            // Simpan semua detail sales quotation
            for (const detail of processedDetails) {
                await req.models.t_sales_quotation_d.create({
                    ...detail,
                    sales_quotation_id: salesQuotation.id,
                }, { transaction: t });
            }

            // Logika update default address jika change_default = true
            if (payload.change_default === true) {
                await updateCustomerDefaultAddress(
                    req.models,
                    payload.customer_id,
                    payload.address_id,
                    t
                );
            }

            await t.commit();
            res.status(201).json({ message: 'Sales quotation berhasil disimpan', data: salesQuotation });
        } catch (err) {
            // Rollback jika terjadi error
            await t.rollback();
            res.status(500).json({ error: err.message });
        }
    },

    async updateSalesQuotation(req, res) {
        const { id } = req.query;
        const payload = req.body;
        const user = req.user;
        const sequelize = req.models.t_sales_quotation.sequelize;
        const t = await sequelize.transaction();

        try {
            // Cek apakah data header ada
            const quotation = await req.models.t_sales_quotation.findByPk(id);
            if (!quotation) {
                return res.status(404).json({ error: 'Sales quotation tidak ditemukan' });
            }

            // Cek apakah data customer ada
            const cust = await req.models.m_customer.findByPk(payload.customer_id);
            if (!cust) {
                return res.status(404).json({ error: 'Customer tidak ditemukan' });
            }

            const nonEditableStatuses = [2, 4, 9]; // in approval, approved, rejected
            if (nonEditableStatuses.includes(quotation.status)) {
                await t.rollback();
                return res.status(403).json({ error: 'Tidak dapat mengubah data sales quotation' });
            }

            const details = payload.t_sales_quotation_d || [];
            let totalAmount = 0;
            const processedDetails = [];

            // Validasi dan proses detail baru
            for (const detail of details) {
                const item = await req.models.m_item.findByPk(detail.item_id, { transaction: t });
                if (!item) {
                    throw new Error(`Item tidak ditemukan`);
                }

                const qty = detail.qty || 0;
                const price = detail.price || 0;
                const subtotal = qty * price;

                totalAmount += subtotal;

                processedDetails.push({
                    ...detail,
                    subtotal: parseFloat(subtotal.toFixed(2)),
                    qty_snapshot: detail.qty,
                });
            }

            // Update header sales quotation
            await quotation.update({
                ...payload,
                total: parseFloat(totalAmount.toFixed(2)),
                updated_by: user.id,
                // updated_by: "06da1eab-b88d-4ff2-b264-c792ab386684",
            }, { transaction: t });

            // Hapus semua detail lama
            await req.models.t_sales_quotation_d.destroy({
                where: { sales_quotation_id: quotation.id },
                transaction: t,
            });

            // Simpan detail baru
            for (const detail of processedDetails) {
                await req.models.t_sales_quotation_d.create({
                    ...detail,
                    sales_quotation_id: quotation.id,
                }, { transaction: t });
            }

            // Jika ada permintaan update default address
            if (payload.change_default === true) {
                await updateCustomerDefaultAddress(
                    req.models,
                    payload.customer_id,
                    payload.address_id,
                    t
                );
            }

            await t.commit();
            res.status(200).json({ message: 'Sales quotation berhasil diperbarui', data: quotation });
        } catch (err) {
            await t.rollback();
            res.status(500).json({ error: err.message });
        }
    },

    async getSalesQuotationReport(req, res) {
        try {

            const {
                t_sales_quotation,
                t_sales_quotation_d,
                t_sales_order,
                t_sales_order_d,
                m_customer,
                m_customer_d_address,
                m_unit_bussiness,
                user,
                m_gen,
                m_item,
                m_sales_area,
                m_sales_area_d_sales,
            } = req.models;

            const {
                start_date,
                end_date,
            } = req.query;

            const unit_bussiness_ids = toArray(req.query.unit_bussiness_ids);
            const customer_ids = toArray(req.query.customer_ids);
            const sq_ids = toArray(req.query.sq_ids);
            const sales_ids = toArray(req.query.sales_ids);
            const sales_area_ids = toArray(req.query.sales_area_ids);
            const item_ids = toArray(req.query.item_ids);
            const item_group_ids = toArray(req.query.item_group_ids);
            const status = toArray(req.query.status);

            const whereClause = {};

            if (unit_bussiness_ids) {
                whereClause.unit_bussiness_id = { [Op.in]: unit_bussiness_ids };
            }

            if (customer_ids) {
                whereClause.customer_id = { [Op.in]: customer_ids };
            }

            if (sq_ids) {
                whereClause.id = { [Op.in]: sq_ids };
            }

            if (sales_ids) {
                whereClause.sales_id = { [Op.in]: sales_ids };
            }

            if (status) {
                whereClause.status = { [Op.in]: status };
            }

            if (start_date && end_date) {
                whereClause.date = { [Op.between]: [start_date, end_date] };
            }

            const quotations = await t_sales_quotation.findAll({
                where: whereClause,
                include: [
                    {
                        model: m_unit_bussiness,
                        as: 'm_unit_bussiness',
                        attributes: ['id', 'code', 'name'],
                    },
                    {
                        model: m_customer,
                        as: 'm_customer',
                        attributes: ['id', 'code', 'name'],
                    },
                    {
                        model: m_customer_d_address,
                        as: 'm_customer_d_address',
                        attributes: ['id', 'name', 'address', 'postal_code'],
                    },
                    {
                        model: m_gen,
                        as: 'salesQuotationTop',
                        attributes: ['id', 'group', 'key1', 'value1', 'value2', 'value3'],
                    },
                    {
                        model: user,
                        as: 'user_default',
                        attributes: ['id', 'name'],
                        include: [
                            {
                            model: m_sales_area_d_sales,
                            as: 'm_sales_area_d_sale',
                            attributes: ['id', 'sales_id', 'sales_area_id'],
                            where: sales_area_ids
                                ? { sales_area_id: { [Op.in]: sales_area_ids } }
                                : undefined,
                            include: [
                                {
                                model: m_sales_area,
                                as: 'm_sales_area',
                                attributes: ['id', 'code'],
                                }
                            ]
                            }
                        ]
                    },
                    {
                        model: t_sales_quotation_d,
                        as: 't_sales_quotation_ds',
                        include: [
                            {
                                model: m_item,
                                as: 'm_item',
                                where: item_ids || item_group_ids ? {
                                    ...(item_ids && { id: { [Op.in]: item_ids } }),
                                    ...(item_group_ids && { item_group_id: { [Op.in]: item_group_ids } }),
                                } : undefined,
                                required: !!(item_ids || item_group_ids),
                                attributes: ['id', 'code', 'name', 'item_group_id', 'actual_weight'],
                            },
                        ],
                    },
                    {
                        model: user,
                        as: 'tsqcreatedBy',
                        attributes: ['id', 'name'],
                    },
                ],
            });

            const result = [];

            for (const q of quotations) {
                const qJSON = q.toJSON();

                for (const detail of qJSON.t_sales_quotation_ds) {
                    const orders = await t_sales_order.findAll({
                        where: {
                            sq_id: q.id,
                            status: 4, // approved
                        },
                        include: [
                            {
                                model: t_sales_order_d,
                                as: 't_sales_order_ds',
                            },
                        ],
                    });

                    let soQty = 0;

                    for (const order of orders) {
                        for (const sod of order.t_sales_order_ds || []) {
                            if (sod.item_id === detail.item_id) {
                                soQty = sod.qty_snapshot || 0;
                            }
                        }
                    }

                    detail.qty_so = soQty;
                    detail.qty_os = detail.qty_snapshot - soQty;
                    detail.weight = detail.qty * (detail?.m_item?.actual_weight || 0);
                }

                const totalQty = qJSON.t_sales_quotation_ds.reduce((sum, d) => sum + (d.qty_snapshot || 0), 0);
                const totalAmount = qJSON.t_sales_quotation_ds.reduce((sum, d) => sum + (d.subtotal || 0), 0);
                const totalWeight = qJSON.t_sales_quotation_ds.reduce((sum, d) => sum + (d.weight || 0), 0);

                result.push({
                    ...qJSON,
                    tonase: totalWeight,
                    qty: totalQty,
                    amount: totalAmount,
                });
            }

            return res.json({ data: result, total: result.length });
        } catch (error) {
            console.error('Error in getSalesQuotationReport:', error);
            return res.status(500).json({ error: error.message });
        }
    },

};
