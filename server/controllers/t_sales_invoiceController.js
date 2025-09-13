// Controller for t_sales_invoice
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_sales_invoice
//
// Tambahkan custom function di bawah ini
import { fn, col, literal, Op, QueryTypes } from "sequelize";

export const t_sales_invoiceController = {
    // Contoh: Upload gambar ke database (kolom image: Buffer/BLOB)
    async uploadImage(req, res) {
        const imageFile = req.files?.find(f => f.mimetype.startsWith('image/'));
        if (!imageFile) return res.status(400).json({ error: 'No image file found' });
        try {
        const inserted = await req.models.t_sales_invoice.create({ image: imageFile.buffer });
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
        const inserted = await req.models.t_sales_invoice.bulkCreate(records);
        res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
        res.status(500).json({ error: err.message });
        }
    },

    async generateCode(req, res) {
        const params = req.query;
        const code = await getCodeStructure(req.models.t_sales_invoice, params.menu_id, params.unit_bussiness_id)
        if (code.status === 'err') {
            res.json(errorResponse(code.error))
        }
        res.json(successResponse(code.data))
    },

    async customIndex(req, res) {
        const { 
            m_customer, 
            m_unit_bussiness, 
            t_surat_jalan, 
            t_sales_invoice, 
            t_sales_invoice_approval,
            user
        } = req.models;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const menu_id = 'bc12a5ff-fc8f-4ea1-a84a-6bd0dfe3d833';

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
            t_surat_jalan && {
                model: t_surat_jalan,
                as: 't_surat_jalan',
                attributes: ['id', 'code']
            },
            m_customer && {
                model: m_customer,
                as: 'm_customer',
                attributes: ['id', 'code', 'name']
            },
            m_unit_bussiness && {
                model: m_unit_bussiness,
                as: 'm_unit_bussiness',
                attributes: ['id', 'name']
            },
            user && {
                model: user,
                as: 'user_default',
                attributes: ['id', 'name']
            },
            t_sales_invoice_approval && {
                model: t_sales_invoice_approval,
                as: 't_sales_invoice_approvals',
            },
        ].filter(Boolean);

        // if (req.query.auth_user_id) {
        //     // Cek role user
        //     const checkAprrovalRole = await m_approval_d.findOne({
        //         where: {
        //             user_id: req.query.auth_user_id,
        //             type: 'menyetujui'
        //         },
        //         include: [{
        //             model: m_approval,
        //             where: {
        //                 menu_id: menu_id
        //             },
        //             attributes: []
        //         }]
        //     });

        //     if (checkAprrovalRole) {
        //         include.push({
        //             model: t_sales_invoice_approval,
        //             as: 't_sales_invoice_approvals',
        //             attributes: [],
        //             required: true,
        //             where: {
        //                 user_id: req.query.auth_user_id
        //             }
        //         });
        //     }
        // }

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

        const { count, rows } = await t_sales_invoice.findAndCountAll({
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

    async createSalesInvoice(req, res) {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed.' });
        }
        
        const payload = req.body;
        const user = req.user;
        const {
            t_sales_invoice,
            t_sales_invoice_d,
            t_surat_jalan,
            m_gen
        } = req.models;

        const menuId = 'bc12a5ff-fc8f-4ea1-a84a-6bd0dfe3d833';
        const sequelize = t_sales_invoice.sequelize;
        const t = await sequelize.transaction();

        try {
            const code = await getCodeStructure(t_sales_invoice, menuId, payload.unit_bussiness_id);
            payload.code = code.data;

            const details = payload.t_sales_invoice_d || [];
            let dpp = 0, dpp2 = 0, ppn = 0, totalDisc = 0, grandTotal = 0;
            const processedDetails = [];

            // Ambil jenis pajak, m_tax_type
            let taxType = 'EXCLUDE';
            if (payload.tax_id) {
                const tax = await m_gen.findOne({
                    where: { id: payload.tax_id, group: 'm_tax_type' },
                    transaction: t
                });
                if (tax) taxType = tax.value1;
            }

            const ppnPercent = payload.ppn_percent || 12;

            // Proses per detail
            for (const detail of details) {
                let dppDetail = 0, dpp2Detail = 0, ppnDetail = 0;

                const result = calculateSODetail(detail, 'qty_inv');

                if (taxType !== 'NONE') {
                    const isInclude = taxType.toUpperCase().includes('INCLUDE');
                    if (isInclude) {
                        dppDetail = (result.subtotal - result.total_disc) / 1.12;
                    } else {
                        dppDetail = result.subtotal - result.total_disc;
                    }
                }

                dpp2Detail = dppDetail * 11 / 12;
                ppnDetail = dpp2Detail * ppnPercent / 100;
                result.total_amt = dppDetail + ppnDetail;

                dpp += dppDetail;
                dpp2 += dpp2Detail;
                ppn += ppnDetail;
                totalDisc += result.total_disc;
                grandTotal += result.total_amt;

                processedDetails.push({
                    ...detail,
                    ...result,
                    dpp: dppDetail,
                    dpp2: dpp2Detail,
                    total_tax: ppnDetail
                });
            }

            // Simpan header invoice
            const invoice = await t_sales_invoice.create({
                ...payload,
                dpp: parseFloat(dpp.toFixed(2)),
                dpp2: parseFloat(dpp2.toFixed(2)),
                ppn: parseFloat(ppn.toFixed(2)),
                ppn_percent: ppnPercent,
                total_disc: parseFloat(totalDisc.toFixed(2)),
                grand_total: parseFloat(grandTotal.toFixed(2)),
                grand_total_snapshot: parseFloat(grandTotal.toFixed(2)),
                created_by: user.id,
            }, { transaction: t });

            // Simpan detail invoice
            for (const detail of processedDetails) {
                await t_sales_invoice_d.create({
                    ...detail,
                    sales_invoice_id: invoice.id
                }, { transaction: t });
            }

            // Update surat jalan hanya sekali pakai
            await t_surat_jalan.update(
                { si_used: true },
                {
                    where: { id: payload.sj_id },
                    transaction: t
                }
            );

            await t.commit();

            res.status(201).json({
                message: 'Sales invoice created',
                data: invoice
            });

        } catch (err) {
            await t.rollback();
            res.status(500).json({ error: err.message });
        }
    },

    async updateSalesInvoice(req, res) {
        if (req.method !== 'PUT') {
            return res.status(405).json({ error: 'Method not allowed.' });
        }

        const id = req.query.id;
        const payload = req.body;
        const user = req.user;
        const {
            t_sales_invoice,
            t_sales_invoice_d,
            m_gen
        } = req.models;

        const sequelize = t_sales_invoice.sequelize;
        const t = await sequelize.transaction();

        try {
            // Cek invoice
            const invoice = await t_sales_invoice.findByPk(id);
            if (!invoice) {
                return res.status(404).json({ error: 'Sales invoice tidak ditemukan' });
            }

            const details = payload.t_sales_invoice_d || [];
            let dpp = 0, dpp2 = 0, ppn = 0, totalDisc = 0, grandTotal = 0;
            const processedDetails = [];

            // Ambil jenis PPN
            let taxType = 'EXCLUDE';
            if (payload.tax_id) {
                const tax = await m_gen.findOne({
                    where: { id: payload.tax_id, group: 'm_tax_type' },
                    transaction: t
                });
                if (tax) taxType = tax.value1;
            }

            const ppnPercent = payload.ppn_percent || 12;

            for (const detail of details) {
                let dppDetail = 0, dpp2Detail = 0, ppnDetail = 0;

                const result = calculateSODetail(detail, 'qty_inv');

                if (taxType !== 'NONE') {
                    const isInclude = taxType.toUpperCase().includes('INCLUDE');
                    if (isInclude) {
                        dppDetail = (result.subtotal - result.total_disc) / 1.12;
                    } else {
                        dppDetail = result.subtotal - result.total_disc;
                    }
                }

                dpp2Detail = dppDetail * 11 / 12;
                ppnDetail = dpp2Detail * ppnPercent / 100;
                result.total_amt = dppDetail + ppnDetail;

                dpp += dppDetail;
                dpp2 += dpp2Detail;
                ppn += ppnDetail;
                totalDisc += result.total_disc;
                grandTotal += result.total_amt;

                processedDetails.push({
                    ...detail,
                    ...result,
                    dpp: dppDetail,
                    dpp2: dpp2Detail,
                    total_tax: ppnDetail
                });
            }

            // Update header
            await invoice.update({
                ...payload,
                dpp: parseFloat(dpp.toFixed(2)),
                dpp2: parseFloat(dpp2.toFixed(2)),
                ppn: parseFloat(ppn.toFixed(2)),
                ppn_percent: ppnPercent,
                total_disc: parseFloat(totalDisc.toFixed(2)),
                grand_total: parseFloat(grandTotal.toFixed(2)),
                grand_total_snapshot: parseFloat(grandTotal.toFixed(2)),
                updated_by: user.id,
            }, { transaction: t });

            // Hapus semua detail sebelumnya
            await t_sales_invoice_d.destroy({
                where: { sales_invoice_id: invoice.id },
                transaction: t
            });

            // Simpan ulang detail
            for (const detail of processedDetails) {
                await t_sales_invoice_d.create({
                    ...detail,
                    sales_invoice_id: invoice.id
                }, { transaction: t });
            }

            await t.commit();

            res.status(200).json({
                message: 'Sales invoice updated',
                data: invoice
            });

        } catch (err) {
            await t.rollback();
            res.status(500).json({ error: err.message });
        }
    },

    async printSI(req, res) {
        const { id } = req.query;
        if (!id) {
            return res.status(400).json({ status: 'error', message: 'ID wajib diisi!' });
        }

        const {
            t_surat_jalan,
            t_sales_invoice,
            t_sales_invoice_d,
            t_sales_order,
            m_unit_bussiness,
            m_customer,
            user,
            m_item,
        } = req.models;

        try {
            const salesInvoice = await t_sales_invoice.findOne({
                where: { id },
                include: [
                    {
                        model: m_unit_bussiness,
                        as: 'm_unit_bussiness'
                    },
                    {
                        model: m_customer,
                        as: 'm_customer'
                    },
                    {
                        model: user,
                        as: 'user_default'
                    },
                    {
                        model: t_sales_invoice_d,
                        as: 't_sales_invoice_ds',
                        include: [
                            {
                                model: m_item,
                                as: 'm_item'
                            }
                        ]
                    },
                    {
                        model: t_surat_jalan,
                        as: 't_surat_jalan',
                        include: [
                            {
                                model: t_sales_order,
                                as: 't_sales_order'
                            }
                        ]
                    }
                ]
            });

            // Hitung subtotal
            const subtotal = salesInvoice.t_sales_invoice_ds.reduce((sum, item) => {
                return sum + (item.total_amt || 0);
            }, 0);

            return res.status(200).json({
                status: 'success',
                data: {
                    ...salesInvoice.toJSON(),
                    subtotal
                }
            });

        } catch (error) {
            console.error(error);
            return res.status(500).json({ status: 'error', message: 'Gagal mengambil data surat jalan' });
        }
    },

    // Laporan Sales Invoice
    async getSalesInvoiceReport(req, res) {
        const {
            t_sales_invoice,
            t_sales_invoice_d,
            t_sales_order,
            t_sales_order_d,
            t_surat_jalan,
            t_surat_jalan_d,
            t_sales_return,
            t_sales_return_d,
            t_delivery_plan,
            m_customer,
            m_customer_d_address,
            m_unit_bussiness,
            m_item,
            m_gen,
            user,
            m_sales_area,
            m_sales_area_d_sales,
        } = req.models;

        try {
            const {
            start_date,
            end_date
            } = req.query;

            // filters from FE
            const unit_bussiness_ids = toArray(req.query.unit_bussiness_ids);
            const customer_group_ids = toArray(req.query.customer_group_ids);
            const customer_ids = toArray(req.query.customer_ids);
            const sales_ids = toArray(req.query.sales_ids);
            const sales_area_ids = toArray(req.query.sales_area_ids);
            const si_ids = toArray(req.query.si_ids);
            const sj_ids = toArray(req.query.sj_ids);
            const so_ids = toArray(req.query.so_ids); // filter for sales order ids (via invoice detail)
            const item_ids = toArray(req.query.item_ids);
            const item_group_ids = toArray(req.query.item_group_ids);
            // status or others can be added similarly

            // build where clause for t_sales_invoice
            const whereClause = {};
            if (unit_bussiness_ids && unit_bussiness_ids.length) whereClause.unit_bussiness_id = { [Op.in]: unit_bussiness_ids };
            if (customer_ids && customer_ids.length) whereClause.customer_id = { [Op.in]: customer_ids };
            if (si_ids && si_ids.length) whereClause.id = { [Op.in]: si_ids };
            if (sales_ids && sales_ids.length) whereClause.sales_id = { [Op.in]: sales_ids };
            if (start_date && end_date) whereClause.date = { [Op.between]: [start_date, end_date] };

            // include invoice details + item (apply item filters at detail level if provided)
            const invoices = await t_sales_invoice.findAll({
                where: whereClause,
                include: [
                    { model: m_unit_bussiness, as: 'm_unit_bussiness', attributes: ['id', 'code', 'name'] },
                    {
                        model: m_customer,
                        as: 'm_customer',
                        attributes: ['id', 'code', 'name', 'group_id'],
                        where: (customer_group_ids?.length) ? { group_id: { [Op.in]: customer_group_ids } } : undefined,
                        required: !!(customer_group_ids?.length),
                        include: [
                            {
                                model: m_customer_d_address,
                                required: false,             // <-- penting: LEFT JOIN
                                where: {'is_default' : true},
                            },
                        ]
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
                    { model: user, as: 'tsicreatedBy', attributes: ['id', 'name'] },
                    { model: user, as: 'tsiupdatedBy', attributes: ['id', 'name'] },
                    {
                        model: t_surat_jalan,
                        as: 't_surat_jalan',
                        include: [
                            {
                                model: t_sales_order,
                                as: 't_sales_order'
                            },
                            {
                                model: t_delivery_plan,
                                as: 't_delivery_plan'
                            }
                        ]
                    },
                    {
                        model: t_sales_return,
                        as: 't_sales_return'
                    },
                    {
                        model: t_sales_invoice_d,
                        as: 't_sales_invoice_ds',
                        include: [
                            {
                            model: m_item,
                            as: 'm_item',
                            attributes: ['id', 'code', 'name', 'item_group_id', 'actual_weight'],
                            where: (item_ids && item_ids.length) || (item_group_ids && item_group_ids.length) ? {
                                ...(item_ids && item_ids.length ? { id: { [Op.in]: item_ids } } : {}),
                                ...(item_group_ids && item_group_ids.length ? { item_group_id: { [Op.in]: item_group_ids } } : {})
                            } : undefined,
                            required: !!((item_ids && item_ids.length) || (item_group_ids && item_group_ids.length)),
                            include: [{ model: m_gen, as: 'itemGroup' }]

                            }
                        ]
                    },

                ],
                order: [['date', 'ASC']]
            });

            if (!invoices || !invoices.length) {
            return res.json({ data: [], total: 0 });
            }

            // gather ids for prefetch
            const siIds = invoices.map(si => si.id);
            const sjIdsFromInvoices = []; // some invoices may have sj_id as fk
            const soIdsFromDetails = new Set();
            const itemIdSet = new Set();

            const codeReturnTemp = [];
            for (const si of invoices) {
            // if invoice has sj_id field
            if (si.sj_id) sjIdsFromInvoices.push(si.sj_id);

                if (si.t_sales_invoice_ds && si.t_sales_invoice_ds.length) {
                    for (const d of si.t_sales_invoice_ds) {
                    if (d.so_id) soIdsFromDetails.add(d.so_id);
                    if (d.item_id) itemIdSet.add(d.item_id);
                    }
                }

                const salesReturnRows = await t_sales_return.findAll({
                    where: { si_id: si.id, status: 4 },
                    attributes: ['id', 'si_id', 'code', 'date']
                });

                const sjReturnRows = await req.models.t_surat_jalan_return.findAll({
                    where: { sj_id: si.sj_id, status: 2 },
                    attributes: ['id', 'sj_id', 'code', 'date']
                });

                // si.setDataValue('hai', salesReturnRows)
                const codes = [
                ...salesReturnRows.map(r => r.get('code') ?? String(r.get('id'))),
                ...sjReturnRows.map(r => r.get('code') ?? String(r.get('id'))),
                ].filter(Boolean); // buang null/undefined/''

                const dates = [
                ...salesReturnRows.map(r => r.get('date') ?? String(r.get('id'))),
                ...sjReturnRows.map(r => r.get('date') ?? String(r.get('id'))),
                ].filter(Boolean); // buang null/undefined/''

                si.setDataValue('code_return', codes.join(','));
                si.setDataValue('date_return', dates.join(','));

            }

            // merge with explicit so_ids filter from query if given
            if (so_ids && so_ids.length) {
            for (const id of so_ids) soIdsFromDetails.add(id);
            }

            const soIds = Array.from(soIdsFromDetails);
            const itemIdsAll = Array.from(itemIdSet);
            const sjIds = Array.from(new Set([...sjIdsFromInvoices, ...(sj_ids || [])]));

            // -----------------------------
            // 1) sales order detail quantities -> qty_so per so_id + item_id
            // -----------------------------
            let soDetailRows = [];
            if (soIds.length && itemIdsAll.length) {
            soDetailRows = await t_sales_order_d.findAll({
                where: {
                so_id: { [Op.in]: soIds },
                item_id: { [Op.in]: itemIdsAll }
                },
            });
            }

            const soMap = {}; // key `${soId}|${itemId}` -> sum qty
            for (const r of soDetailRows) {
            const key = `${r.so_id}|${r.item_id}`;
            soMap[key] = (soMap[key] || 0) + (r.qty_snapshot || 0);
            }

            // -----------------------------
            // 2) surat jalan details -> qty_sj per so_id + item_id (via t_surat_jalan.so_id)
            //    include any SJ referenced directly by invoice (sjIds) or by soIds
            // -----------------------------
            let sjDetails = [];
            // prefer querying sj details where parent t_surat_jalan.so_id in soIds OR surat_jalan.id in sjIds
            if ((soIds && soIds.length) || (sjIds && sjIds.length)) {
            sjDetails = await t_surat_jalan_d.findAll({
                include: [{
                model: t_surat_jalan,
                as: 't_surat_jalan',
                where: {
                    ...(soIds.length ? { so_id: { [Op.in]: soIds } } : {}),
                    ...(sjIds.length ? { id: { [Op.in]: sjIds } } : {})
                },
                attributes: ['id', 'so_id', 'code', 'date']
                }],
                where: itemIdsAll.length ? { item_id: { [Op.in]: itemIdsAll } } : undefined,
                attributes: ['surat_jalan_id', 'item_id', 'qty', 'id', 'item_name','qty_snapshot']
            });
            }

            const sjMap = {}; // key `${soId}|${itemId}` -> sum qty_sj
            const sjListMap = {}; // key => array of SJ meta
            const sjIdToSoId = {};
            for (const sd of sjDetails) {
            const sj = sd.t_surat_jalan;
            if (!sj) continue;
            const soId = sj.so_id;
            const key = `${soId}|${sd.item_id}`;
            // sjMap[key] = (sjMap[key] || 0) + (sd.qty || 0);
            sjMap[key] = (sjMap[key] || 0) + (sd.qty_snapshot || 0);

            sjListMap[key] = sjListMap[key] || [];
            sjListMap[key].push({
                surat_jalan_id: sj.id,
                surat_jalan_code: sj.code,
                surat_jalan_date: sj.date
            });

            sjIdToSoId[sj.id] = sj.so_id;
            }

            // -----------------------------
            // 3) sales return (t_sales_return_d) + surat jalan return
            // -----------------------------
            let returnDetails = [];
            let sjReturnDetails = [];

            if (siIds.length) {
                // --- SALES RETURN ---
                const salesReturnRows = await t_sales_return.findAll({
                    where: { si_id: { [Op.in]: siIds }, status: 4 },
                    attributes: ['id', 'si_id']
                });

                const salesReturnIds = salesReturnRows.map(r => r.id);
                if (salesReturnIds.length) {
                    returnDetails = await t_sales_return_d.findAll({
                        where: {
                            sales_return_id: { [Op.in]: salesReturnIds },
                            ...(itemIdsAll.length ? { item_id: { [Op.in]: itemIdsAll } } : {})
                        },
                        attributes: ['sales_return_id', 'item_id', 'qty_return'],
                        include: [{ model: t_sales_return, as: 't_sales_return', attributes: ['id', 'si_id'] }]
                    });
                }

                // --- SURAT JALAN RETURN ---
                // cari semua sj yang terkait dengan si (dari invoices → sjIds)
                if (sjIds.length) {
                    const sjReturnRows = await req.models.t_surat_jalan_return.findAll({
                        where: { sj_id: { [Op.in]: sjIds }, status: 2 },
                        attributes: ['id', 'sj_id']
                    });

                    const sjReturnIds = sjReturnRows.map(r => r.id);

                    if (sjReturnIds.length) {
                        sjReturnDetails = await req.models.t_surat_jalan_return_d.findAll({
                            where: {
                                surat_jalan_return_id: { [Op.in]: sjReturnIds },
                                ...(itemIdsAll.length ? { item_id: { [Op.in]: itemIdsAll } } : {})
                            },
                            attributes: ['surat_jalan_return_id', 'item_id', 'qty_return'],
                            include: [{
                                model: req.models.t_surat_jalan_return,
                                as: 't_surat_jalan_return',
                                attributes: ['id', 'sj_id']
                            }]
                        });
                    }
                }
            }

            // map return keyed by `${siId}|${itemId}` (sum)
            const returnMap = {};
            for (const rd of returnDetails) {
                const ret = rd.t_sales_return;
                if (!ret) continue;
                const siId = ret.si_id;
                const key = `${siId}|${rd.item_id}`;
                returnMap[key] = (returnMap[key] || 0) + (rd.qty_return || 0);
            }

            // map surat jalan return keyed by `${soId}|${itemId}` via sj → so_id
            for (const rd of sjReturnDetails) {
                const sjRet = rd.t_surat_jalan_return;
                if (!sjRet) continue;
                const sjId = sjRet.sj_id;
                const soId = sjIdToSoId[sjId]; // mapping sj → so_id yang sudah kita buat di step 2
                if (!soId) continue;

                const key = `${soId}|${rd.item_id}`;
                // bedanya: ini tidak via invoice, tapi via soId
                returnMap[key] = (returnMap[key] || 0) + (rd.qty_return || 0);
            }

            // -----------------------------
            // 4) Map results into invoice details and accumulate header totals
            // -----------------------------
            for (const si of invoices) {
                let header_qty_so = 0;
                let header_qty_sj = 0;
                let header_qty_return = 0;
                let header_weight_total = 0; // tambahkan akumulasi weight

                const header_subtotal = si.subtotal != null ? si.subtotal : (si.t_sales_invoice_ds ? si.t_sales_invoice_ds.reduce((acc, d) => acc + (d.amount || 0), 0) : 0);
                const header_tax = si.tax != null ? si.tax : si.ppn || 0;
                const header_grand_total = si.grand_total != null ? si.grand_total : si.total_amount || 0;

                if (si.t_sales_invoice_ds && si.t_sales_invoice_ds.length) {
                    for (const d of si.t_sales_invoice_ds) {
                        const soId = d.so_id;
                        const itemId = d.item_id;
                        const keyBySo = `${soId}|${itemId}`;
                        const keyBySi = `${si.id}|${itemId}`;

                        const qty_so = soMap[keyBySo] || 0;
                        const qty_sj = sjMap[keyBySo] || 0;
                        // const qty_return = returnMap[keyBySi] || 0;
                        const qty_return = (returnMap[keyBySi] || 0) + (returnMap[keyBySo] || 0);

                        // Ambil actual_weight dari m_item
                        const actual_weight = d.m_item?.actual_weight || 0;
                        const weight = (d.qty_inv || 0) * actual_weight;

                        // Set ke detail
                        d.setDataValue('qty_so', qty_so);
                        d.setDataValue('qty_sj', qty_sj);
                        d.setDataValue('qty_return', qty_return);
                        d.setDataValue('weight', weight);

                        header_qty_so += qty_so;
                        header_qty_sj += qty_sj;
                        header_qty_return += qty_return;
                        header_weight_total += weight; // akumulasi
                    }
                }

                // set header derived fields
                si.setDataValue('qty_so', header_qty_so);
                si.setDataValue('qty_sj', header_qty_sj);
                si.setDataValue('qty_return', header_qty_return);

                si.setDataValue('subtotal', header_subtotal);
                si.setDataValue('tax', header_tax);
                si.setDataValue('grand_total', header_grand_total);
                si.setDataValue('weight_total', header_weight_total); // total weight
            }

            return res.json({ data: invoices, total: invoices.length });
        } catch (err) {
            console.error('Error in getSalesInvoiceReport:', err);
            return res.status(500).json({ error: err.message });
        }
    },

    // Laporan Rekapitulasi Penjualan
    async getSalesRecapitulationReport(req, res) {
        try {
            const group_by = (req.query.group_by || 'customer').toLowerCase();
            const {
            unit_bussiness_ids,
            customer_ids,
            sales_ids,
            item_ids,
            si_ids,
            start_date,
            end_date
            } = req.query;

            const {
            t_sales_invoice,
            t_sales_invoice_d,
            t_surat_jalan,
            t_sales_order,
            m_customer_d_address,
            m_unit_bussiness,
            m_customer,
            m_item,
            m_gen,
            } = req.models;

            // ====== WHERE CLAUSE HEADER ======
            const whereHeader = {};
            if (unit_bussiness_ids?.length) whereHeader.unit_bussiness_id = unit_bussiness_ids;
            if (customer_ids?.length) whereHeader.customer_id = customer_ids;
            if (sales_ids?.length) whereHeader.sales_id = sales_ids;
            if (si_ids?.length) whereHeader.id = si_ids;
            if (start_date && end_date) whereHeader.date = { [Op.between]: [start_date, end_date] };

            // ====== WHERE CLAUSE DETAIL ======
            const whereDetail = {};
            if (item_ids?.length) whereDetail.item_id = item_ids;

            // ====== INCLUDE BASE ======
            const includeBase = [
            { model: m_unit_bussiness, as: 'm_unit_bussiness', attributes: ['id', 'code', 'name'] },
            { model: m_customer, as: 'm_customer', attributes: ['id', 'code', 'name'] },
            {
                model: t_surat_jalan,
                as: 't_surat_jalan',
                include: [
                {
                    model: t_sales_order,
                    as: 't_sales_order',
                    include: [
                    { model: m_customer_d_address, as: 'm_customer_d_address', attributes: ['address'] }
                    ]
                }
                ]
            },
            {
                model: t_sales_invoice_d,
                as: 't_sales_invoice_ds',
                where: whereDetail,
                include: [{
                    model: m_item,
                    as: 'm_item',
                    attributes: ['id', 'code', 'name', 'actual_weight', 'item_group_id'],
                    include: [{
                        model: m_gen,
                        as: 'itemGroup',
                        attributes: [['id', 'value1']]
                    }]
                }]
            }
            ];

            // ====== FETCH DATA ======
            const invoices = await t_sales_invoice.findAll({
            where: whereHeader,
            include: includeBase,
            order: [['date', 'ASC']]
            });

            let result = [];

            if (group_by === 'customer') {
            for (const inv of invoices) {
                const unitBusiness = inv.m_unit_bussiness;
                const customer = inv.m_customer;
                const customerAddress = inv.t_surat_jalan?.t_sales_order?.m_customer_d_address?.address || '';

                for (const detail of inv.t_sales_invoice_ds) {
                const actual_weight = detail.m_item?.actual_weight || 0;
                const weight = detail.qty_inv * actual_weight;

                result.push({
                    company: unitBusiness?.name || '',
                    customer_code: customer?.code || '',
                    customer_name: customer?.name || '',
                    customer_address: customerAddress,
                    qty: detail.qty_inv,
                    weight: weight,
                    dpp: inv.dpp || 0,
                    tax_amt: inv.ppn || 0,
                    return: 0,
                    netto: (inv.dpp || 0) - (inv.ppn || 0)
                });
                }
            }
            } 
            else if (group_by === 'customer_item') {
            const grouped = {};

            for (const inv of invoices) {
                const unitBusiness = inv.m_unit_bussiness;
                const customer = inv.m_customer;
                const customerAddress = inv.t_surat_jalan?.t_sales_order?.m_customer_d_address?.address || '';

                for (const detail of inv.t_sales_invoice_ds) {
                const item = detail.m_item;
                if (!item) continue;

                const actual_weight = item.actual_weight || 0;
                const weight = detail.qty_inv * actual_weight;

                if (!grouped[item.id]) {
                    grouped[item.id] = {
                    item_id: item.id,
                    item_code: item.code,
                    item_name: item.name,
                    group_item: item.itemGroup.value1 || '',
                    details: []
                    };
                }

                grouped[item.id].details.push({
                    sales_invoice_no: inv.no || '',
                    sales_invoice_date: inv.date,
                    unit_business: unitBusiness?.name || '',
                    customer_code: customer?.code || '',
                    customer_name: customer?.name || '',
                    customer_address: customerAddress,
                    qty: detail.qty_inv,
                    weight: weight,
                    dpp: inv.dpp || 0,
                    ppn: inv.ppn || 0,
                    pph: 0,
                    grand_total: (inv.dpp || 0) + (inv.ppn || 0)
                });
                }
            }

            result = Object.values(grouped);
            }

            res.status(200).json({ message: 'Berhasil', data: result, total: result.length });

        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Laporan Rekapitulasi Penjualan - Item
    async getItemSalesRecapitulationReport(req, res) {
        try {
            // ambil instance sequelize dari salah satu model
            const sequelize =
            req.models?.sequelize ||
            req.models?.t_sales_order?.sequelize;

            if (!sequelize) {
            return res.status(500).json({ error: "Sequelize instance not found" });
            }

            const dialect = sequelize.getDialect();

            const {
            unit_bussiness_ids,
            customer_ids,
            sales_ids,
            item_ids,
            so_ids,
            start_date,
            end_date,
            } = req.query;

            const arrOrNull = (v) => (Array.isArray(v) && v.length ? v : null);
            const replacements = {
            unit_bussiness_ids: arrOrNull(unit_bussiness_ids),
            customer_ids: arrOrNull(customer_ids),
            sales_ids: arrOrNull(sales_ids),
            item_ids: arrOrNull(item_ids),
            so_ids: arrOrNull(so_ids),
            start_date: start_date || null,
            end_date: end_date || null,
            };

            const SQL = `
            WITH so_base AS (
                SELECT
                so.id  AS so_id,
                so.unit_bussiness_id,
                so.customer_id,
                so.sales_id,
                so.date,
                sod.item_id,
                (sod.qty_snapshot * COALESCE(sod.uom_value, 1)) AS qty_std,
                sod.price
                FROM t_sales_order so
                JOIN t_sales_order_d sod ON sod.so_id = so.id
                WHERE 1=1
                AND (:start_date IS NULL OR :end_date IS NULL OR so.date BETWEEN :start_date AND :end_date)
                ${dialect === "postgres"
                    ? `AND (:unit_bussiness_ids IS NULL OR so.unit_bussiness_id = ANY(:unit_bussiness_ids))`
                    : `AND (:unit_bussiness_ids IS NULL OR so.unit_bussiness_id IN (:unit_bussiness_ids))`}
                ${dialect === "postgres"
                    ? `AND (:customer_ids IS NULL OR so.customer_id = ANY(:customer_ids))`
                    : `AND (:customer_ids IS NULL OR so.customer_id IN (:customer_ids))`}
                ${dialect === "postgres"
                    ? `AND (:sales_ids IS NULL OR so.sales_id = ANY(:sales_ids))`
                    : `AND (:sales_ids IS NULL OR so.sales_id IN (:sales_ids))`}
                ${dialect === "postgres"
                    ? `AND (:so_ids IS NULL OR so.id = ANY(:so_ids))`
                    : `AND (:so_ids IS NULL OR so.id IN (:so_ids))`}
                ${dialect === "postgres"
                    ? `AND (:item_ids IS NULL OR sod.item_id = ANY(:item_ids))`
                    : `AND (:item_ids IS NULL OR sod.item_id IN (:item_ids))`}
            ),
            flags AS (
                SELECT
                b.so_id,
                EXISTS (SELECT 1 FROM t_surat_jalan sj WHERE sj.so_id = b.so_id) AS has_sj,
                EXISTS (
                    SELECT 1
                    FROM t_surat_jalan sj
                    JOIN t_sales_invoice si ON si.sj_id = sj.id
                    WHERE sj.so_id = b.so_id
                ) AS has_invoice,
                EXISTS (SELECT 1 FROM t_delivery_plan_d dpd WHERE dpd.so_id = b.so_id) AS has_dp
                FROM so_base b
                GROUP BY b.so_id
            )
            SELECT
                ub.id    AS company_id,
                ub.code  AS company_code,
                ub.name  AS company_name,

                mi.item_group_id,
                mi.item_group_name,
                mi.item_division_id,
                mi.item_division_name,
                mi.code  AS item_code,
                mi.name  AS item_name,
                mi.actual_weight,

                COALESCE(SUM(CASE WHEN f.has_invoice                    THEN b.qty_std * mi.actual_weight ELSE 0 END), 0) AS omzet_weight,
                COALESCE(SUM(CASE WHEN f.has_invoice                    THEN b.qty_std * b.price          ELSE 0 END), 0) AS omzet_amount,

                COALESCE(SUM(CASE WHEN f.has_sj AND NOT f.has_invoice   THEN b.qty_std * mi.actual_weight ELSE 0 END), 0) AS sj_belum_inv_weight,
                COALESCE(SUM(CASE WHEN f.has_sj AND NOT f.has_invoice   THEN b.qty_std * b.price          ELSE 0 END), 0) AS sj_belum_inv_amount,

                COALESCE(SUM(CASE WHEN NOT f.has_sj                      THEN b.qty_std * mi.actual_weight ELSE 0 END), 0) AS request_belum_sj_weight,
                COALESCE(SUM(CASE WHEN NOT f.has_sj                      THEN b.qty_std * b.price          ELSE 0 END), 0) AS request_belum_sj_amount,

                COALESCE(SUM(CASE WHEN NOT f.has_dp                      THEN b.qty_std * mi.actual_weight ELSE 0 END), 0) AS order_pending_weight,
                COALESCE(SUM(CASE WHEN NOT f.has_dp                      THEN b.qty_std * b.price          ELSE 0 END), 0) AS order_pending_amount

            FROM so_base b
            JOIN flags f ON f.so_id = b.so_id
            JOIN m_item mi ON mi.id = b.item_id
            JOIN m_unit_bussiness ub ON ub.id = b.unit_bussiness_id
            GROUP BY
                ub.id, ub.code, ub.name,
                mi.item_group_id, mi.item_group_name, mi.item_division_id, mi.item_division_name,
                mi.code, mi.name, mi.actual_weight
            ORDER BY ub.name, mi.item_group_name, mi.item_division_name, mi.code
            `;

            const rows = await sequelize.query(SQL, {
            type: QueryTypes.SELECT,
            replacements,
            });

            // (Opsional) mapping format angka/kolom agar cocok untuk UI
            res.json({ data: rows });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    },

    async getSalesInvoiceDebitAndCreditNote(req, res) {
        const { id } = req.query;
        const {
            t_sales_invoice,
            t_sales_return
        } = req.models;

        try {
            // ambil data sales invoice
            const salesInvoice = await t_sales_invoice.findOne(
                { where: { id, status: 4 } }
            )

            if (!salesInvoice) {
                res.status(404).json({ message: 'Sales invoice tidak ditemukan' })
            }

            // ambil data total return
            let totalReturn = 0;
            const salesReturns = await t_sales_return.findAll({
                where: { si_id: id, status: 4 }
            })

            for (const ret of salesReturns) {
                totalReturn += ret.total;
            }

            const invoiceData = salesInvoice.toJSON();
            invoiceData.total_return = totalReturn;

            return res.status(200).json({
                message: 'Success',
                data: invoiceData,
            });
        } catch (err) {
            res.status(500).json({ error: err.message, message: 'Gagal mendapatkan data' });
        }
    },

    async getSalesInvoiceWithPelunasanPiutang(req, res) {
        const { unit_bussiness_ids } = req.query;
        const {
            t_sales_invoice,
            t_sales_invoice_d,
            t_receivables_payment_d,
        } = req.models;

        try {
            const where = { status: 4 };
            if (unit_bussiness_ids) {
                const idsArray = unit_bussiness_ids.split(",").map(id => id.trim());

                if (idsArray.length > 0) {
                    where.unit_bussiness_id = { [Op.in]: idsArray };
                }
            }
            
            const salesInvoices = await t_sales_invoice.findAll({
                where,
                include: [
                    {
                        model: t_sales_invoice_d,
                        as: 't_sales_invoice_ds',
                    }
                ],
            });

            if (!salesInvoices || salesInvoices.length <= 0) {
                return res.status(404).json({ message: 'Data tidak ditemukan' });
            }

            const salesInvoice = [];
            for (const invoice of salesInvoices) {
                const si = invoice.toJSON();
                const totalPelunasan = await t_receivables_payment_d.sum('total_payment', {
                    where: { si_id: si.id }
                });
                si.total_pelunasan = totalPelunasan || 0;
                salesInvoice.push(si);
            }

            return res.status(200).json({
                message: 'Data berhasil didapatkan',
                data: salesInvoice
            });

        } catch (err) {
            console.error(err);
            return res.status(500).json({ 
                error: err.message, 
                message: 'Gagal mendapatkan data' 
            });
        }
    }

};
