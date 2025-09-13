// Controller for t_sales_order
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_sales_order
//
// Tambahkan custom function di bawah ini
import { fn, col, literal, Op } from "sequelize";

export const t_sales_orderController = {
    // Contoh: Upload gambar ke database (kolom image: Buffer/BLOB)
    async uploadImage(req, res) {
        const imageFile = req.files?.find(f => f.mimetype.startsWith('image/'));
        if (!imageFile) return res.status(400).json({ error: 'No image file found' });
        try {
        const inserted = await req.models.t_sales_order.create({ image: imageFile.buffer });
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
        const inserted = await req.models.t_sales_order.bulkCreate(records);
        res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
        res.status(500).json({ error: err.message });
        }
    },

    async generateCode(req, res) {
        const params = req.query;
        const code = await getCodeStructure(req.models.t_sales_order, params.menu_id, params.unit_bussiness_id)
        if (code.status === 'err') {
            res.json(errorResponse(code.error))
        }
        res.json(successResponse(code.data))
    },

    async getSalesOrderByID(req, res) {
        const { id } = req.query;
        const {
            t_sales_order,
            t_sales_order_d,
            t_sales_order_approval,
            t_sales_quotation,
            t_reservation,
            m_unit_bussiness,
            m_customer,
            user,
            m_expedition,
            m_delivery_area,
            m_gen,
            m_item,
            m_warehouse
        } = req.models;

        try {
            const so = await t_sales_order.findByPk(id, {
                include: [
                    { model: m_unit_bussiness, as: 'm_unit_bussiness' },
                    { model: m_customer, as: 'm_customer' },
                    { model: m_expedition, as: 'm_expedition' },
                    { model: m_delivery_area, as: 'm_delivery_area' },
                    {
                        model: m_gen, as: 'soTop',
                        where: { group: 'm_top_sales_quotation' },
                        required: false
                    },
                    {
                        model: m_gen, as: 'soPpn',
                        where: { group: 'm_tax_type' },
                        required: false
                    },
                    {
                        model: m_gen, as: 'soExpeditionType',
                        where: { group: 'm_expedition_type' },
                        required: false
                    },
                    {
                        model: t_sales_quotation,
                        as: 't_sales_quotation',
                        attributes: ['id', 'code']
                    },
                    {
                        model: t_sales_order_d,
                        as: 't_sales_order_ds',
                        required: false,
                        include: [
                            {
                                model: m_item,
                                as: 'm_item'
                            }
                        ]
                    },
                    {
                        model: t_sales_order_approval,
                        as: 't_sales_order_approvals',
                        required: false,
                        include: [
                            { model: user, as: 'user_default', attributes: ['id', 'name'] },
                        ]
                    },
                    { model: user, as: 'user_default', attributes: ['id', 'name'] },
                    { model: user, as: 'tsocreatedBy', attributes: ['id', 'name'] },
                    { model: user, as: 'tsoupdatedBy', attributes: ['id', 'name'] },
                    { model: user, as: 'tsoRequestApprovalBy', attributes: ['id', 'name'] },
                ]
            });

            if (!so) {
                return res.status(404).json({ status: 'error', message: 'Sales order tidak ditemukan' });
            }

            const salesOrder = so.toJSON();

            const reservations = await t_reservation.findAll({
                where: { so_id: so.id },
                attributes: ['status']
            });

            const statusList = reservations.map(r => r.status);

            let trackingStatus = 0;

            if (statusList.includes(2)) {
                trackingStatus = 2;
            } else if (statusList.includes(1)) {
                trackingStatus = 1;
            } else {
                trackingStatus = 0;
            }

            salesOrder.tracking_status = trackingStatus;

            const warehouse = await m_warehouse.findOne({
                where: { unit_bussiness_id: so.unit_bussiness_id }
            });
            if (!warehouse) {
                throw new Error('Gudang tidak ditemukan');
            }

            // Tambahkan stock_on_hand pada setiap item di t_sales_order_ds
            for (const item of salesOrder.t_sales_order_ds) {
                const stockResult = await inventoryService.getCurrentStock(item.item_id, warehouse.id);
                item.stock_on_hand = stockResult.status === 'success' ? stockResult.data : 0;
            }

            return res.json({
                status: 'success',
                data: salesOrder
            });
        } catch (err) {
            console.error('getSalesOrderByID error:', err);
            return res.status(500).json({
                status: 'error',
                message: err.message
            });
        }
    },

    async getSalesOrderToDeliveryPlan(req, res) {
        try {
            const { search = '', limit = 20 } = req.query;

            const salesOrders = await req.models.t_sales_order.findAll({
                where: {
                    code: {
                        [Op.iLike]: `%${search}%`
                    },
                    status: 4,
                },
                limit: parseInt(limit, 10),
                include: [
                    {
                        model: req.models.t_sales_order_d,
                        as: 't_sales_order_ds',
                        required: true,
                        include: [
                            {
                                model: req.models.m_item,
                                as: 'm_item'
                            }
                        ]
                    },
                    {
                        model: req.models.t_reservation,
                        as: 't_reservation',
                        required: true,
                        include: [
                            {
                                model: req.models.t_reservation_d,
                                as: 't_reservation_ds'
                            }
                        ]
                    },
                    {
                        model: req.models.m_customer,
                        as: 'm_customer',
                        include: [
                            { model: req.models.m_customer_d_account, as: 'm_customer_d_accounts' },
                            { model: req.models.m_customer_d_address, as: 'm_customer_d_addresses' },
                            { model: req.models.m_customer_d_docs, as: 'm_customer_d_docs' },
                            { model: req.models.m_customer_d_itemfav, as: 'm_customer_d_itemfavs' },
                            { model: req.models.m_customer_d_npwp, as: 'm_customer_d_npwps' },
                            { model: req.models.m_customer_d_phone, as: 'm_customer_d_phones' },
                            { model: req.models.m_customer_d_restriction, as: 'm_customer_d_restrictions' }
                        ]
                    },
                    {
                        model: req.models.m_gen,
                        as: 'soTop',
                        where: { group: 'm_top_sales_quotation' },
                        required: false
                    },
                    {
                        model: req.models.m_gen,
                        as: 'soPpn',
                        where: { group: 'm_ppn' },
                        required: false
                    }
                ],
                order: [['date', 'DESC']]
            });

            const response = salesOrders.map(order => {
                const details = order.t_sales_order_ds || [];
                const reservations = order.t_reservation?.t_reservation_ds || [];

                const item_qty = details.length;

                const weight = details.reduce((total, detail) => {
                    const itemWeight = detail.m_item?.marketing_weight || 0;
                    const qty = detail.qty || 0;
                    return total + itemWeight * qty;
                }, 0);

                const mappedDetails = details.map(d => {
                    const matchedReservation = reservations.find(r => r.item_id === d.item_id);
                    const stock_booking = matchedReservation?.stock_booking || 0;

                    // Hapus jika ingin bersihkan data internal (optional)
                    const dJSON = d.toJSON();
                    delete dJSON.createdAt;
                    delete dJSON.updatedAt;

                    return {
                        ...dJSON,
                        stock_booking
                    };
                });

                // Buat salinan order tanpa t_reservation
                const { t_reservation, ...orderData } = order.toJSON();

                return {
                    ...orderData,
                    item_qty,
                    weight,
                    t_sales_order_ds: mappedDetails
                };
            });

            res.status(200).json({ data: response });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async customIndex(req, res) {
        const { 
            m_gen, 
            m_customer, 
            user_default, 
            m_unit_bussiness, 
            t_sales_order, 
            t_sales_order_approval, 
            t_reservation, 
            user
        } = req.models;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const menu_id = '98d791ce-988f-41eb-90a5-77fb3aae3c48';

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
            m_gen && {
                model: m_gen,
                as: 'soTop',
                attributes: ['id', 'group', 'key1', 'value1', 'value2', 'value3']
            },
            user && {
                model: user,
                as: 'user_default',
                attributes: ['id', 'name']
            },
            t_sales_order_approval && {
                model: t_sales_order_approval,
                as: 't_sales_order_approvals'
            }
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
        //             model: t_sales_order_approval,
        //             as: 't_sales_order_approvals',
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

        const { count, rows } = await t_sales_order.findAndCountAll({
            include,
            where,
            order,
            limit,
            offset,
            distinct: true
        });

        // Untuk setiap sales order, tambahkan field tracking_status
        for (const so of rows) {
            const reservations = await t_reservation.findAll({
                where: { so_id: so.id },
                attributes: ['status']
            });

            const statusList = reservations.map(r => r.status);

            let trackingStatus = 0;

            if (statusList.includes(2)) {
                trackingStatus = 2;
            } else if (statusList.includes(1)) {
                trackingStatus = 1;
            } else {
                trackingStatus = 0;
            }

            so.setDataValue('tracking_status', trackingStatus);
        }

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

    // async createSalesOrder(req, res) {
    //         const details = payload.t_sales_order_d || [];
    //         let totalAmount = 0;
    //         let totalDisc = 0;
    //         const processedDetails = [];

    //         // Validasi dan proses masing-masing detail
    //         for (const detail of details) {
    //             const itemExist = await req.models.m_item.findByPk(detail.item_id, {
    //                 include: [
    //                     {
    //                         model: req.models.m_gen,
    //                         as: 'itemUom',
    //                         attributes: ['value1'],
    //                     },
    //                 ],
    //                 transaction: t,
    //             });

    //             if (!itemExist) {
    //                 throw new Error(`Item tidak ditemukan`);
    //             }

    //             const calculated = calculateSODetail(detail);

    //             totalAmount += calculated.total_amt;
    //             totalDisc += calculated.total_disc;

    //             processedDetails.push({
    //                 ...detail,
    //                 ...calculated,
    //             });
    //         }

    //         // Ambil jenis PPN (value1 dari m_gen)
    //         let taxType = 'EXCLUDE';
    //         if (payload.ppn_id) {
    //             const tax = await req.models.m_gen.findOne({
    //                 where: {
    //                     id: payload.ppn_id,
    //                     group: 'm_tax_type',
    //                 },
    //                 transaction: t,
    //             });
    //             if (tax) taxType = tax.value1;
    //         }

    //         // Hitung DPP, PPN, Grand Total
    //         let dpp = 0, dpp2 = 0, ppn = 0, grandTotal = 0;
    //         const ppnPercent = payload.ppn_percent || 12;

    //         // === CHANGED: DPP, DPP Lainnya, PPN, Grand Total logic to match useFormula.js ===
    //         if (taxType !== 'NONE') {
    //             const isInclude = taxType.toUpperCase().includes('INCLUDE');
    //             if (isInclude) {
    //                 dpp = totalAmount / 1.12;
    //                 dpp2 = dpp * 11 / 12;
    //                 ppn = dpp2 * 12 / 100;
    //                 grandTotal = dpp2 + ppn;
    //             } else {
    //                 dpp = totalAmount;
    //                 dpp2 = dpp * 11 / 12;
    //                 ppn = dpp2 * 12 / 100;
    //                 grandTotal = dpp2 + ppn;
    //             }
    //             // Round to 2 decimals
    //             dpp = parseFloat(dpp.toFixed(2));
    //             dpp2 = parseFloat(dpp2.toFixed(2));
    //             ppn = parseFloat(ppn.toFixed(2));
    //             grandTotal = parseFloat(grandTotal.toFixed(2));
    //         }
    //         // === END CHANGED ===

    //         // Simpan header sales order
    //         const salesOrder = await req.models.t_sales_order.create({
    //             ...payload,
    //             dpp,
    //             dpp2,
    //             ppn,
    //             grand_total: grandTotal,
    //             total_disc: parseFloat(totalDisc.toFixed(2)),
    //             created_by: user.id,
    //             // created_by: "06da1eab-b88d-4ff2-b264-c792ab386684",
    //         }, { transaction: t });

    async createSalesOrder(req, res) {
        const payload = req.body;
        const user = req.user;
        const sequelize = req.models.t_sales_order.sequelize;
        const t = await sequelize.transaction();

        try {
            // Cek apakah data quotation ada
            const quotation = await req.models.t_sales_quotation.findByPk(payload.sq_id);
            if (!quotation) {
                return res.status(404).json({ error: 'Sales quotation tidak ditemukan' });
            }

            // === START CHANGED TAX TASK ===
            const details = payload.t_sales_order_d || [];
            const processedDetails = [];

            let dpp = 0, dpp2 = 0, ppn = 0, totalDisc = 0, grandTotal = 0;
            const ppnPercent = payload.ppn_percent || 12;

            // Ambil jenis PPN (value1 dari m_gen)
            let taxType = 'EXCLUDE';
            if (payload.ppn_id) {
                const tax = await req.models.m_gen.findOne({
                    where: {
                        id: payload.ppn_id,
                        group: 'm_tax_type',
                    },
                    transaction: t,
                });
                if (tax) taxType = tax.value1;
            }

            // Validasi dan proses masing-masing detail
            for (const detail of details) {
                let dppDetail = 0, dpp2Detail = 0, ppnDetail = 0;

                const itemExist = await req.models.m_item.findByPk(detail.item_id, { transaction: t });
                if (!itemExist) {
                    throw new Error(`Item tidak ditemukan`);
                }

                const calculated = calculateSODetail(detail);

                if (taxType !== 'NONE') {
                    const isInclude = taxType.toUpperCase().includes('INCLUDE');
                    if (isInclude) {
                        dppDetail = (calculated.subtotal - calculated.total_disc) / 1.12;
                    } else {
                        dppDetail = calculated.subtotal - calculated.total_disc;
                    }
                }
                
                dpp2Detail = dppDetail * 11/12;
                ppnDetail = dpp2Detail * ppnPercent / 100;
                calculated.total_amt = dppDetail + ppnDetail;

                dpp += dppDetail;
                dpp2 += dpp2Detail;
                ppn += ppnDetail;
                totalDisc += calculated.total_disc;
                grandTotal += calculated.total_amt;

                processedDetails.push({
                    ...detail,
                    ...calculated,
                    dpp: dppDetail,
                    dpp2: dpp2Detail,
                    total_tax: ppnDetail
                });
            }

            // Simpan header sales order
            const salesOrder = await req.models.t_sales_order.create({
                ...payload,
                dpp,
                dpp2,
                ppn,
                grand_total: parseFloat(grandTotal.toFixed(2)),
                total_disc: parseFloat(totalDisc.toFixed(2)),
                created_by: user.id,
            }, { transaction: t });

            // === END CHANGED ===

            // Simpan detail sales order
            for (const detail of processedDetails) {
                await req.models.t_sales_order_d.create({
                    ...detail,
                    so_id: salesOrder.id
                }, { transaction: t });
            }

            // Update default address jika diminta
            if (payload.change_default === true) {
                await updateCustomerDefaultAddress(
                    req.models,
                    payload.customer_id,
                    payload.address_id,
                    t
                );
            }

            await t.commit();
            res.status(201).json({ message: 'Sales order berhasil disimpan', data: salesOrder });
        } catch (err) {
            await t.rollback();
            res.status(500).json({ error: err.message });
        }
    },

    async updateSalesOrder(req, res) {
        const { id } = req.query;
        const payload = req.body;
        const user = req.user;
        const sequelize = req.models.t_sales_order.sequelize;
        const t = await sequelize.transaction();

        try {
            const salesOrder = await req.models.t_sales_order.findByPk(id);
            if (!salesOrder) {
                return res.status(404).json({ error: 'Sales order tidak ditemukan' });
            }

            const quotation = await req.models.t_sales_quotation.findByPk(payload.sq_id);
            if (!quotation) {
                return res.status(404).json({ error: 'Sales quotation tidak ditemukan' });
            }

            // Prevent update jika status tidak bisa diedit, kecuali revisi dari in approval ke revise (3)
            const nonEditableStatuses = [2, 4, 9]; // in approval, approved, rejected
            const newStatus = payload.status;
            const isInvalidRevision = !(salesOrder.status === 2 && newStatus === 3);

            if (nonEditableStatuses.includes(salesOrder.status) && isInvalidRevision) {
                await t.rollback();
                return res.status(403).json({ error: 'Tidak dapat mengubah data sales order' });
            }

            // ===  START CHANGED TAX TASK ===

            const details = payload.t_sales_order_d || [];
            const processedDetails = [];

            let dpp = 0, dpp2 = 0, ppn = 0, totalDisc = 0, grandTotal = 0;
            const ppnPercent = payload.ppn_percent || 12;

            // Ambil value1 dari m_gen.group = 'm_tax_type'
            let taxType = 'EXCLUDE';
            if (payload.ppn_id) {
                const tax = await req.models.m_gen.findOne({
                    where: {
                        id: payload.ppn_id,
                        group: 'm_tax_type'
                    },
                    transaction: t
                });
                if (tax) taxType = tax.value1;
            }

            for (const detail of details) {
                let dppDetail = 0, dpp2Detail = 0, ppnDetail = 0;

                const item = await req.models.m_item.findByPk(detail.item_id, { transaction: t });
                if (!item) {
                    throw new Error(`Item dengan ID ${detail.item_id} tidak ditemukan`);
                }

                const calculated = calculateSODetail(detail);

                if (taxType !== 'NONE') {
                    const isInclude = taxType.toUpperCase().includes('INCLUDE');
                    if (isInclude) {
                        dppDetail = (calculated.subtotal - calculated.total_disc) / 1.12;
                    } else {
                        dppDetail = calculated.subtotal - calculated.total_disc;
                    }
                }
                
                dpp2Detail = dppDetail * 11/12;
                ppnDetail = dpp2Detail * ppnPercent / 100;
                calculated.total_amt = dppDetail + ppnDetail;

                dpp += dppDetail;
                dpp2 += dpp2Detail;
                ppn += ppnDetail;
                totalDisc += calculated.total_disc;
                grandTotal += calculated.total_amt;

                processedDetails.push({
                    ...detail,
                    ...calculated,
                    dpp: dppDetail,
                    dpp2: dpp2Detail,
                    total_tax: ppnDetail
                });
            }

            // Update header sales order
            await salesOrder.update({
                ...payload,
                dpp,
                dpp2,
                ppn,
                grand_total: parseFloat(grandTotal.toFixed(2)),
                total_disc: parseFloat(totalDisc.toFixed(2)),
                updated_by: user.id,
            }, { transaction: t });

            // === END CHANGED ===

            // Hapus detail lama
            await req.models.t_sales_order_d.destroy({
                where: { so_id: salesOrder.id },
                transaction: t
            });

            // Simpan ulang detail pakai bulkCreate
            await req.models.t_sales_order_d.bulkCreate(
                processedDetails.map(d => ({
                    ...d,
                    so_id: salesOrder.id
                })),
                { transaction: t }
            );

            // Update alamat default jika diminta
            if (payload.change_default === true) {
                await updateCustomerDefaultAddress(
                    req.models,
                    payload.customer_id,
                    payload.address_id,
                    t
                );
            }

            await t.commit();
            res.status(200).json({ message: 'Sales order berhasil diperbarui', data: salesOrder });

        } catch (err) {
            await t.rollback();
            res.status(500).json({ error: err.message });
        }
    },

    // async updateSalesOrder(req, res) {
    //         const details = payload.t_sales_order_d || [];
    //         let totalAmount = 0;
    //         let totalDisc = 0;
    //         const processedDetails = [];

    //         for (const detail of details) {
    //             const item = await req.models.m_item.findByPk(detail.item_id, { transaction: t });
    //             if (!item) {
    //                 throw new Error(`Item dengan ID ${detail.item_id} tidak ditemukan`);
    //             }

    //             const calculated = calculateSODetail(detail);

    //             totalAmount += calculated.total_amt;
    //             totalDisc += calculated.total_disc;

    //             processedDetails.push({
    //                 ...detail,
    //                 ...calculated
    //             });
    //         }

    //         // Ambil value1 dari m_gen.group = 'm_tax_type'
    //         let taxType = 'EXCLUDE';
    //         if (payload.ppn_id) {
    //             const tax = await req.models.m_gen.findOne({
    //                 where: {
    //                     id: payload.ppn_id,
    //                     group: 'm_tax_type'
    //                 },
    //                 transaction: t
    //             });
    //             if (tax) taxType = tax.value1;
    //         }

    //         // Hitung DPP, PPN, Grand Total
    //         let dpp = 0, dpp2 = 0, ppn = 0, grandTotal = 0;
    //         if (taxType !== 'NONE') {
    //             const isInclude = taxType === 'INCLUDE';
    //             dpp = await calculateDPP({
    //                 total: totalAmount,
    //                 isInclude,
    //                 ppn: payload.ppn_percent || 12
    //             });

    //             dpp2 = parseFloat(((dpp * 11) / 12).toFixed(2));
    //             ppn = parseFloat(((dpp2 * (payload.ppn_percent || 12)) / 100).toFixed(2));
    //             grandTotal = parseFloat((dpp2 + ppn).toFixed(2));
    //         }

    //         // Update header sales order
    //         await salesOrder.update({
    //             ...payload,
    //             dpp,
    //             dpp2,
    //             ppn,
    //             grand_total: grandTotal,
    //             total_disc: parseFloat(totalDisc.toFixed(2)),
    //             updated_by: user.id,
    //         }, { transaction: t });
    // },

    async reviseOrReject(req, res) {
        if (req.method !== 'PUT') {
            return res.status(405).json({ error: 'Method not allowed.' });
        }
        
        const id = req.query.id;
        const payload = req.body;
        const { t_sales_order, t_sales_order_d } = req.models;

        try {
            const salesOrder = await t_sales_order.findByPk(id, {
                include: [{
                    model: t_sales_order_d,
                    as: 't_sales_order_ds',
                }],
            });

            if(!payload.status){
                return res.status(400).json({ error: 'Silahkan sertakan status yang ingin diperbarui' });
            }

            if (!salesOrder) {
                return res.status(404).json({ error: 'Sales order tidak ditemukan' });
            }

            if (salesOrder.status != 2) {
                return res.status(400).json({ error: 'Tidak dapat melakukan revise / reject sales order dengan status selain in approval' });
            }

            // Update status sales order menjadi approved
            await salesOrder.update({ status: payload.status, reason: payload.reason });

            res.status(200).json({ message: 'Sales order approved' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async approveSalesOrder(req, res) {
        if (req.method !== 'PUT') {
            return res.status(405).json({ error: 'Method not allowed.' });
        }
        const id = req.query.id;
        const { t_sales_order, t_sales_order_d, t_reservation, t_reservation_d } = req.models;

        try {
            const salesOrder = await t_sales_order.findByPk(id, {
                include: [{
                    model: t_sales_order_d,
                    as: 't_sales_order_ds',
                }],
            });

            if (!salesOrder) {
                return res.status(404).json({ error: 'Sales order tidak ditemukan' });
            }

            if (salesOrder.status != 2) {
                return res.status(400).json({ error: 'Tidak dapat menyetujui sales order dengan status selain in approval' });
            }

            // Update status sales order menjadi approved
            await salesOrder.update({ status: 4 });

            // Buat reservation header
            const reservation = await t_reservation.create({
                unit_bussiness_id: salesOrder.unit_bussiness_id,
                so_id: salesOrder.id,
                code: '', // kosongkan
                customer_id: salesOrder.customer_id,
                sales_id: salesOrder.sales_id,
                status: 0, // need book
                date: new Date(),
                ship_to_id: salesOrder.ship_to_id,
            });

            // Buat detail reservation_d dengan nilai default
            const details = salesOrder.t_sales_order_ds || [];
            for (const detail of details) {
                await t_reservation_d.create({
                    reservation_id: reservation.id,
                    item_id: detail.item_id,
                    so_qty: detail.qty,
                    uom_id: detail.uom_id,
                    price: detail.price,
                    free_stock: detail.free_stock,
                    stock_booking: 0, // default booking 0
                    status: 0,        // default need book
                });
            }

            res.status(200).json({ message: 'Sales order approved' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async getListSOOutstanding(req, res) {
        const { id } = req.query;
        const { 
            t_sales_order,
            t_sales_order_d,
            t_surat_jalan,
            t_surat_jalan_d,
            m_unit_bussiness,
            m_customer,
            user,
            m_item
        } = req.models;

        try {
            const salesOrders = await t_sales_order.findAll({
                where: { id },
                include: [
                    { model: m_unit_bussiness, as: 'm_unit_bussiness', attributes: ['id', 'code', 'name'] },
                    { model: m_customer, as: 'm_customer', attributes: ['id', 'code', 'name'] },
                    { model: user, as: 'user_default', attributes: ['id', 'name'] },
                    {
                        model: t_sales_order_d,
                        as: 't_sales_order_ds',
                        include: [
                            {
                                model: m_item,
                                as: 'm_item',
                            }
                        ]
                    },
                ]
            });

            const result = [];

            for (const so of salesOrders) {
                // Ambil semua SJ untuk SO ini
                const suratJalans = await t_surat_jalan.findAll({
                    where: { so_id: so.id },
                    attributes: ['id']
                });

                const sjIds = suratJalans.map(sj => sj.id);

                // Ambil semua detail SJ terkait
                const sjDetails = sjIds.length
                    ? await t_surat_jalan_d.findAll({
                        where: { surat_jalan_id: sjIds },
                        attributes: ['item_id', 'qty_snapshot']
                    })
                    : [];

                // Group qty SJ per item_id
                const qtySjPerItem = sjDetails.reduce((map, d) => {
                    const itemId = d.item_id;
                    map[itemId] = (map[itemId] || 0) + (d.qty_snapshot || 0);
                    return map;
                }, {});

                // Tambahkan qty_sj di setiap detail SO
                const soJSON = so.toJSON();
                soJSON.t_sales_order_ds = soJSON.t_sales_order_ds.map(detail => {
                    const itemId = detail.item_id;
                    return {
                        ...detail,
                        qty_sj: qtySjPerItem[itemId] || 0
                    };
                });

                result.push(soJSON);
            }

            return res.status(200).json({ data: result });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async getSalesOrderWithQtySJByID(req, res) {
        try {
            const id = req.query.id;
            if (!id) {
                return res.status(400).json({ error: 'ID tidak boleh kosong' });
            }

            const {
                t_sales_order,
                t_sales_order_d,
                t_surat_jalan,
                t_surat_jalan_d,
                m_customer,
                m_customer_d_address,
                m_unit_bussiness,
                m_item,
                m_gen,
                user,
            } = req.models;

            // Ambil SO beserta detailnya
            const salesOrder = await t_sales_order.findByPk(id, {
                include: [
                    { model: m_unit_bussiness, as: 'm_unit_bussiness', attributes: ['id', 'code', 'name'] },
                    { model: m_customer, as: 'm_customer', attributes: ['id', 'code', 'name'] },
                    { model: m_customer_d_address, as: 'm_customer_d_address', attributes: ['id', 'address'] },
                    { model: m_gen, as: 'soTop', attributes: ['id', 'key1', 'value1'] },
                    { model: m_gen, as: 'soPpn', attributes: ['id', 'key1', 'value1'] },
                    { model: user, as: 'user_default', attributes: ['id', 'name'] },
                    {
                        model: t_sales_order_d,
                        as: 't_sales_order_ds',
                        include: [
                            {
                                model: m_item,
                                as: 'm_item',
                                attributes: ['id', 'code', 'name', 'item_group_id', 'actual_weight'],
                                include: [{ model: m_gen, as: 'itemGroup', attributes: ['id', 'group', 'value1'] }]
                            }
                        ]
                    },
                    { model: user, as: 'tsocreatedBy', attributes: ['id', 'name'] },
                ]
            });

            if (!salesOrder) {
                return res.status(404).json({ error: 'Sales Order tidak ditemukan' });
            }

            // Ambil semua SJ terkait
            const suratJalans = await t_surat_jalan.findAll({
                where: { so_id: salesOrder.id, status: 2 },
                attributes: ['id']
            });
            const sjIds = suratJalans.map(sj => sj.id);

            // Ambil detail SJ dan hitung qty per item
            let qtyByItemId = {};
            if (sjIds.length > 0) {
                const sjDetails = await t_surat_jalan_d.findAll({
                    where: { surat_jalan_id: sjIds },
                    attributes: ['item_id', 'qty_snapshot']
                });

                for (const d of sjDetails) {
                    const qty = Number(d.qty_snapshot || 0);
                    qtyByItemId[d.item_id] = (qtyByItemId[d.item_id] || 0) + qty;
                }
            }

            // Tambahkan qty_sj dan qty_outstanding ke setiap detail
            const soJSON = salesOrder.toJSON();

            // ambil semua closing sekali saja berdasarkan so.id
            const closings = await req.models.t_sales_order_closing.findAll({
                where: { so_id: salesOrder.id },
                include: [
                    {
                        model: req.models.t_sales_order_closing_d,
                        as: 't_sales_order_closing_ds'
                    }
                ]
            });

            // bikin map item_id -> total qty_closing
            const qtyClosingByItemId = {};
            closings.forEach(closing => {
                closing.t_sales_order_closing_ds.forEach(d => {
                    qtyClosingByItemId[d.item_id] = 
                        (qtyClosingByItemId[d.item_id] || 0) + Number(d.qty_closing || 0);
                });
            });

            soJSON.t_sales_order_ds = soJSON.t_sales_order_ds.map(detail => {
                const itemId = detail.item_id ?? (detail.m_item && detail.m_item.id);
                const qty_so_detail = Number(detail.qty_snapshot || 0);
                const qty_sj = qtyByItemId[itemId] || 0;
                const qty_closing = qtyClosingByItemId[itemId] || 0;

                const qty_outstanding = qty_so_detail - qty_sj - qty_closing;

                return {
                    ...detail,
                    qty_sj,
                    qty_closing,
                    qty_outstanding
                };
            });

            return res.json({ data: soJSON });
        } catch (error) {
            console.error('Error in getSalesOrderWithQtySJByID:', error);
            return res.status(500).json({ error: error.message });
        }
    },

    // async getListSOOutstanding(req, res) {
    //     const { id } = req.query;
    //     const { t_sales_order, t_sales_order_d, t_surat_jalan, t_surat_jalan_d, m_unit_bussiness, m_customer, user, m_item } = req.models;

    //     try {
    //         const salesOrders = await t_sales_order.findAll({
    //         where: { id },
    //         include: [
    //             { model: m_unit_bussiness, as: 'm_unit_bussiness', attributes: ['id', 'code', 'name'] },
    //             { model: m_customer, as: 'm_customer', attributes: ['id', 'code', 'name'] },
    //             { model: user, as: 'user_default', attributes: ['id', 'name'] },
    //             {
    //                 model: t_sales_order_d,
    //                 as: 't_sales_order_ds',
    //                 include: [
    //                     {
    //                         model: m_item,
    //                         as: 'm_item',
    //                     }
    //                 ]
    //             },
    //         ]
    //         });

    //         const result = [];

    //         for (const so of salesOrders) {
    //             const suratJalans = await t_surat_jalan.findAll({ where: { so_id: so.id } });
    //             let qty_sj = 0;
    //             for (const sj of suratJalans) {
    //                 const sjDetails = await t_surat_jalan_d.findAll({ where: { surat_jalan_id: sj.id } });
    //                 qty_sj += sjDetails.reduce((sum, d) => sum + (d.qty_snapshot || 0), 0);
    //             }

    //             // const soJSON = ; // lakukan setelah semua perubahan pada detail selesai

    //             result.push({
    //                 ...so.toJSON(),
    //                 qty_sj,
    //             });
    //         }

    //         return res.status(200).json({ data: result, total: result.length });
    //     } catch (err) {
    //         res.status(500).json({ error: err.message });
    //     }
    // },

    // Laporan Sales Order
    async getSalesOrderReport(req, res) {
        try {
            const {
                t_sales_order,
                t_sales_order_d,
                t_reservation,
                t_reservation_d,
                t_reservation_history,
                t_surat_jalan,
                t_surat_jalan_d,
                t_surat_jalan_return,
                t_surat_jalan_return_d,
                t_sales_return,
                t_sales_return_d,
                m_customer,
                m_customer_d_address,
                m_unit_bussiness,
                m_item,
                m_gen,
                user,
                m_sales_area,
                m_sales_area_d_sales,
            } = req.models;

            const {
                start_date,
                end_date,
                status_delivery,
            } = req.query;

            const unit_bussiness_ids = toArray(req.query.unit_bussiness_ids);
            const customer_ids = toArray(req.query.customer_ids);
            const customer_group_ids = toArray(req.query.customer_group_ids);
            const so_ids = toArray(req.query.so_ids);
            const sales_ids = toArray(req.query.sales_ids);
            const sales_area_ids = toArray(req.query.sales_area_ids);
            const item_ids = toArray(req.query.item_ids);
            const item_group_ids = toArray(req.query.item_group_ids);
            const status = toArray(req.query.status);

            const whereClause = {};
            if (unit_bussiness_ids) whereClause.unit_bussiness_id = { [Op.in]: unit_bussiness_ids };
            if (customer_ids) whereClause.customer_id = { [Op.in]: customer_ids };
            if (so_ids) whereClause.id = { [Op.in]: so_ids };
            if (sales_ids) whereClause.sales_id = { [Op.in]: sales_ids };
            if (start_date && end_date) whereClause.date = { [Op.between]: [start_date, end_date] };
            if (status) whereClause.status = { [Op.in]: status };

            const salesOrders = await t_sales_order.findAll({
                where: whereClause,
                include: [
                    { model: m_unit_bussiness, as: 'm_unit_bussiness', attributes: ['id', 'code', 'name'] },
                    { 
                        model: m_customer, 
                        as: 'm_customer', 
                        attributes: ['id', 'code', 'name'],
                        where: customer_group_ids ? { group_id: { [Op.in]: customer_group_ids } } : undefined
                    },
                    { model: m_customer_d_address, as: 'm_customer_d_address', attributes: ['id', 'address'] },
                    { model: m_gen, as: 'soTop', attributes: ['id', 'key1', 'value1'] },
                    { model: m_gen, as: 'soPpn', attributes: ['id', 'key1', 'value1'] },
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
                        model: t_sales_order_d,
                        as: 't_sales_order_ds',
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
                                include: [
                                    {
                                        model: m_gen,
                                        as: 'itemGroup',
                                        attributes: ['id', 'group', 'value1'],
                                    }
                                ]
                            }
                        ]
                    },
                    { model: user, as: 'tsocreatedBy', attributes: ['id', 'name'] },
                ]
            });

            const result = [];

            for (const so of salesOrders) {
                // hitung semua dulu dari objek asli
                const qty_so = so.t_sales_order_ds.reduce((sum, d) => sum + (d.qty_snapshot || 0), 0);
                const amount = so.t_sales_order_ds.reduce((sum, d) => sum + (d.total_amt || 0), 0);

                // const reservation = await t_reservation.findOne({ where: { so_id: so.id } });
                // let qty_reservasi = 0;
                // if (reservation) {
                //     const reservationDs = await t_reservation_d.findAll({ where: { reservation_id: reservation.id } });
                //     qty_reservasi = reservationDs.reduce((sum, d) => sum + (d.stock_booking || 0), 0);
                // }

                const reservation = await t_reservation.findOne({ where: { so_id: so.id } });
                let qty_reservasi = 0;

                if (reservation) {
                    const history = await t_reservation_history.findAll({
                        where: { reservation_id: reservation.id }
                    });

                    const total_booking = history.reduce((sum, h) => sum + (h.qty_booking || 0), 0);
                    const total_release = history.reduce((sum, h) => sum + (h.qty_release || 0), 0);

                    qty_reservasi = total_booking - total_release;
                }

                const suratJalans = await t_surat_jalan.findAll({ where: { so_id: so.id, status: 2 } });
                let qty_sj = 0;
                for (const sj of suratJalans) {
                    const sjDetails = await t_surat_jalan_d.findAll({ where: { surat_jalan_id: sj.id } });
                    qty_sj += sjDetails.reduce((sum, d) => sum + (d.qty_snapshot || 0), 0);
                }

                let qty_sj_return = 0;
                let qty_sales_return = 0;

                for (const sj of suratJalans) {
                    const suratJalanReturns = await t_surat_jalan_return.findAll({ where: { sj_id: sj.id, status: 2 } });
                    for (const sjr of suratJalanReturns) {
                        const sjDetails = await t_surat_jalan_return_d.findAll({ where: { surat_jalan_return_id: sjr.id } });
                        qty_sj_return += sjDetails.reduce((sum, d) => sum + (d.qty_return || 0), 0);
                    }

                    const salesReturns = await t_sales_return.findAll({ where: { sj_id: sj.id, status: 4 } });
                    for (const sr of salesReturns) {
                        const srDetails = await t_sales_return_d.findAll({ where: { sales_return_id: sr.id } });
                        qty_sales_return += srDetails.reduce((sum, d) => sum + (d.qty_return || 0), 0);
                    }
                }

                const qty_return = qty_sj_return + qty_sales_return;
                // const qty_sisa = qty_so - (qty_reservasi + qty_return); << old condition
                const qty_sisa = qty_so - qty_reservasi;
                const trackingStatus = qty_sisa === 0 ? 2 : 1;
                // filter by status_delivery
                if (
                    (status_delivery === 'completed' && trackingStatus !== 2) ||
                    (status_delivery === 'incompleted' && trackingStatus === 2)
                ) {
                    continue; // skip data ini
                }

                // tambahkan weight sebelum toJSON()
                for (const detail of so.t_sales_order_ds) {
                    const actual_weight = detail.m_item?.actual_weight || 0;
                    detail.setDataValue('weight', detail.qty * actual_weight);
                    detail.setDataValue('pph', 0);
                }

                const soJSON = so.toJSON(); // lakukan setelah semua perubahan pada detail selesai

                let pn = "P";
                if (so.soPpn?.value1 === "EXCLUDE") {
                    pn = "NP";
                }
                soJSON.ppn = parseFloat(so.ppn);

                result.push({
                    ...soJSON,
                    pn,
                    qty_so,
                    qty_reservasi,
                    qty_sisa,
                    qty_sj,
                    qty_return,
                    amount,
                    tracking_status: trackingStatus // delivery status
                });
            }

            return res.json({ data: result, total: result.length });
        } catch (error) {
            console.error('Error in getSalesOrderReport:', error);
            return res.status(500).json({ error: error.message });
        }
    },

    // Laporan Sales Order Outstanding
    async getSalesOrderOutstandingReport(req, res) {
        try {
            const {
            t_sales_order,
            t_sales_order_d,
            t_sales_order_closing,
            t_sales_order_closing_d,
            t_surat_jalan,
            t_surat_jalan_d,
            m_customer,
            m_customer_d_address,
            m_unit_bussiness,
            m_item,
            m_gen,
            user,
            m_sales_area,
            m_sales_area_d_sales,
            } = req.models;

            const {
            start_date,
            end_date,
            } = req.query;

            const unit_bussiness_ids = toArray(req.query.unit_bussiness_ids);
            const customer_ids = toArray(req.query.customer_ids);
            const customer_group_ids = toArray(req.query.customer_group_ids);
            const so_ids = toArray(req.query.so_ids);
            const sales_ids = toArray(req.query.sales_ids);
            const sales_area_ids = toArray(req.query.sales_area_ids);
            const item_ids = toArray(req.query.item_ids);
            const item_group_ids = toArray(req.query.item_group_ids);

            const whereClause = {};
            if (unit_bussiness_ids) whereClause.unit_bussiness_id = { [Op.in]: unit_bussiness_ids };
            if (customer_ids) whereClause.customer_id = { [Op.in]: customer_ids };
            if (so_ids) whereClause.id = { [Op.in]: so_ids };
            if (sales_ids) whereClause.sales_id = { [Op.in]: sales_ids };
            if (start_date && end_date) whereClause.date = { [Op.between]: [start_date, end_date] };

            const salesOrders = await t_sales_order.findAll({
            where: whereClause,
            include: [
                { model: m_unit_bussiness, as: 'm_unit_bussiness', attributes: ['id', 'code', 'name'] },
                {
                    model: m_customer, 
                    as: 'm_customer', 
                    attributes: ['id', 'code', 'name'],
                    where: customer_group_ids ? { group_id: { [Op.in]: customer_group_ids } } : undefined
                },
                { model: m_customer_d_address, as: 'm_customer_d_address', attributes: ['id', 'address'] },
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
                { model: user, as: 'tsocreatedBy', attributes: ['id', 'name'] },
                {
                model: t_sales_order_d,
                as: 't_sales_order_ds',
                include: [
                    {
                    model: m_item,
                    as: 'm_item',
                    where: item_ids || item_group_ids ? {
                        ...(item_ids && { id: { [Op.in]: item_ids } }),
                        ...(item_group_ids && { item_group_id: { [Op.in]: item_group_ids } }),
                    } : undefined,
                    required: !!(item_ids || item_group_ids),
                    attributes: ['id', 'code', 'name', 'item_group_id'],
                    include: [
                        {
                        model: m_gen,
                        as: 'itemGroup',
                        attributes: ['id', 'group', 'value1'],
                        }
                    ]
                    }
                ]
                }
            ]
            });

            const result = [];

            for (const so of salesOrders) {
                let amount = 0;
                let qty_so_total = 0;
                let qty_sj_total = 0;
                let qty_os_total = 0;
                let qty_closed_total = 0;

                for (const detail of so.t_sales_order_ds) {
                    const qty_so = detail.qty_snapshot || 0;
                    const price = detail.price || 0;

                    const suratJalans = await t_surat_jalan.findAll({ where: { so_id: so.id } });
                    let qty_sj = 0;

                    for (const sj of suratJalans) {
                        const sjDetails = await t_surat_jalan_d.findAll({
                            where: {
                            surat_jalan_id: sj.id,
                            item_id: detail.item_id,
                            },
                        });
                        qty_sj += sjDetails.reduce((sum, d) => sum + (d.qty_snapshot || 0), 0);
                    }

                    const soClosings = await t_sales_order_closing.findAll({ where: { so_id: so.id } });
                    let qty_closed = 0;

                    for (const soc of soClosings) {
                        const socDetails = await t_sales_order_closing_d.findAll({
                            where: {
                                so_closing_id: soc.id,
                                item_id: detail.item_id,
                            },
                        });
                        qty_closed += socDetails.reduce((sum, d) => sum + (d.qty_closing || 0), 0);
                    }

                    const qty_os = qty_so - (qty_closed + qty_sj);
                    const jumlah = qty_os * price;
                    const total_diskon = qty_os === 0 ? 0 : detail.total_disc;
                    const total_d = jumlah - total_diskon;

                    // Patch field ke detail
                    detail.setDataValue('qty_sj', qty_sj);
                    detail.setDataValue('qty_os', qty_os);
                    detail.setDataValue('harga', price);
                    detail.setDataValue('jumlah', jumlah);
                    detail.setDataValue('total_diskon', total_diskon);
                    detail.setDataValue('total_d', total_d);
                    detail.setDataValue('qty_closed', qty_closed);

                    // amount += total_d;
                    qty_so_total += qty_so;
                    qty_sj_total += qty_sj;
                    qty_os_total += qty_os;
                    qty_closed_total += qty_closed;
                }

                const soJSON = so.toJSON();
                // soJSON.amount = amount;
                soJSON.qty_so = qty_so_total;
                soJSON.qty_sj = qty_sj_total;
                soJSON.qty_os = qty_os_total;
                soJSON.qty_closed = qty_closed_total; // default seperti permintaan
                soJSON.amount = (qty_os_total / qty_so_total) * soJSON.grand_total;

                result.push(soJSON);
            }

            return res.json({ data: result, total: result.length });

        } catch (error) {
            console.error('Error in getSalesOrderOutstandingReport:', error);
            return res.status(500).json({ error: error.message });
        }
    },

    // Laporan Realisasi Penjualan
    async getSalesOrderRealizationReport(req, res) {
        const {
            t_sales_order,
            t_sales_order_d,
            t_sales_order_closing,
            t_sales_order_closing_d,
            t_reservation,
            t_reservation_history,
            t_delivery_plan_d,
            t_delivery_plan,
            t_delivery_plan_d_item,
            t_surat_jalan,
            t_surat_jalan_d,
            t_surat_jalan_return,
            t_surat_jalan_return_d,
            m_unit_bussiness,
            m_customer,
            m_customer_d_address,
            m_item,
            m_gen,
            user,
            m_sales_area_d_sales,
            m_sales_area,
        } = req.models;

        const { start_date, end_date } = req.query;

        const unit_bussiness_ids = toArray(req.query.unit_bussiness_ids);
        const customer_ids       = toArray(req.query.customer_ids);
        const sales_ids          = toArray(req.query.sales_ids);
        const sales_area_ids     = toArray(req.query.sales_area_ids);
        const dp_ids             = toArray(req.query.dp_ids);
        const sj_ids             = toArray(req.query.sj_ids);
        const so_ids             = toArray(req.query.so_ids);
        const item_ids           = toArray(req.query.item_ids);
        const item_group_ids     = toArray(req.query.item_group_ids);
        const delivery_area_ids  = toArray(req.query.delivery_area_ids);
        const status             = toArray(req.query.status);

        try {
            // 0) Ambil Sales Orders + Details
            const whereSO = {};
            if (unit_bussiness_ids) whereSO.unit_bussiness_id = { [Op.in]: unit_bussiness_ids };
            if (customer_ids)       whereSO.customer_id       = { [Op.in]: customer_ids };
            if (so_ids)             whereSO.id                = { [Op.in]: so_ids };
            if (sales_ids)          whereSO.sales_id          = { [Op.in]: sales_ids };
            if (delivery_area_ids)  whereSO.delivery_area_id  = { [Op.in]: delivery_area_ids };
            if (start_date && end_date) whereSO.date = { [Op.between]: [start_date, end_date] };
            if (status)             whereSO.status            = { [Op.in]: status };

            const salesOrders = await t_sales_order.findAll({
            where: whereSO,
            include: [
                { model: m_unit_bussiness, as: 'm_unit_bussiness', attributes: ['id', 'code', 'name'] },
                { model: m_customer, as: 'm_customer', attributes: ['id', 'code', 'name'] },
                { model: m_customer_d_address, as: 'm_customer_d_address' },
                {
                model: user,
                as: 'user_default',
                attributes: ['id', 'name'],
                include: [{
                    model: m_sales_area_d_sales,
                    as: 'm_sales_area_d_sale',
                    attributes: ['id', 'sales_id', 'sales_area_id'],
                    where: sales_area_ids ? { sales_area_id: { [Op.in]: sales_area_ids } } : undefined,
                    include: [{ model: m_sales_area, as: 'm_sales_area', attributes: ['id', 'code'] }]
                }]
                },
                { model: user, as: 'tsocreatedBy', attributes: ['id', 'name'] },
                {
                model: t_sales_order_d,
                as: 't_sales_order_ds',
                include: [{
                    model: m_item,
                    as: 'm_item',
                    where: (item_ids || item_group_ids) ? {
                    ...(item_ids && { id: { [Op.in]: item_ids } }),
                    ...(item_group_ids && { item_group_id: { [Op.in]: item_group_ids } }),
                    } : undefined,
                    required: !!(item_ids || item_group_ids),
                    attributes: ['id', 'code', 'name', 'item_group_id'],
                    include: [{ model: m_gen, as: 'itemGroup' }]
                }]
                }
            ],
            order: [['date', 'ASC']]
            });

            if (!salesOrders.length) {
            return res.json({ data: [], total: 0 });
            }

            const soIds = salesOrders.map(s => s.id);

            const itemIdSet = new Set();
            for (const so of salesOrders) {
            for (const d of so.t_sales_order_ds) itemIdSet.add(d.item_id);
            }
            const itemIdsAll = Array.from(itemIdSet);

            if (!itemIdsAll.length) {
            // tidak ada detail item; kembalikan header apa adanya
            return res.json({
                data: salesOrders.map(so => ({ ...so.get({ plain: true }), delivery_plans: [], details: [] })),
                total: salesOrders.length,
            });
            }

            // [CLOSING] 1) Ambil Sales Order Closing per SO+Item
            const closingDetails = await t_sales_order_closing_d.findAll({
            include: [{
                model: t_sales_order_closing,
                as: 't_sales_order_closing',
                where: { so_id: { [Op.in]: soIds } },
                attributes: ['id', 'so_id']
            }],
            where: { item_id: { [Op.in]: itemIdsAll } }
            });

            // closingMap: `${soId}|${itemId}` -> qtyClosed
            const closingMap = {};
            for (const cd of closingDetails) {
            const soId = cd.t_sales_order_closing.so_id;
            const key = `${soId}|${cd.item_id}`;
            closingMap[key] = (closingMap[key] || 0) + (cd.qty_closing || 0);
            }

            // 1) Reservation per SO+Item
            const resHistories = await t_reservation_history.findAll({
            include: [{
                model: t_reservation,
                as: 't_reservation',
                where: { so_id: { [Op.in]: soIds } },
            }],
            where: { item_id: { [Op.in]: itemIdsAll } },
            });

            // reservationMap: `${soId}|${itemId}` -> net reserved
            const reservationMap = {};
            for (const rh of resHistories) {
            const soId = rh.t_reservation && rh.t_reservation.so_id;
            if (!soId) continue;
            const key = `${soId}|${rh.item_id}`;
            const diff = (rh.qty_booking || 0) - (rh.qty_release || 0);
            reservationMap[key] = (reservationMap[key] || 0) + diff;
            }

            // 2) Delivery Plan Items
            const dpItems = await t_delivery_plan_d_item.findAll({
            include: [{
                model: t_delivery_plan_d,
                as: 't_delivery_plan_d',
                where: { so_id: { [Op.in]: soIds } },
                include: [{
                model: t_delivery_plan,
                as: 't_delivery_plan',
                attributes: ['id', 'code', 'date'],
                where: dp_ids ? { id: { [Op.in]: dp_ids } } : undefined
                }]
            }],
            where: { item_id: { [Op.in]: itemIdsAll } },
            });

            // dpBySO: soId -> Map(dpId -> {dpHeader, items: Map(itemId -> qtyDP), sjList: Map(...)})
            const dpBySO = new Map();
            for (const pi of dpItems) {
            const dpd = pi.t_delivery_plan_d;
            if (!dpd || !dpd.t_delivery_plan) continue;
            const soId = dpd.so_id;
            const dpId = dpd.delivery_plan_id;
            const dpHdr = dpd.t_delivery_plan;
            const qtyDpVal = (pi.qty_dp != null) ? pi.qty_dp : (pi.qty_so || 0);

            if (!dpBySO.has(soId)) dpBySO.set(soId, new Map());
            const dpMap = dpBySO.get(soId);
            if (!dpMap.has(dpId)) {
                dpMap.set(dpId, {
                id: dpId,
                code: dpHdr.code,
                delivery_plan_date: dpHdr.date,
                items: new Map(),
                sjList: new Map(),
                });
            }
            const dpEntry = dpMap.get(dpId);
            dpEntry.items.set(pi.item_id, (dpEntry.items.get(pi.item_id) || 0) + (qtyDpVal || 0));
            }

            // 3) Surat Jalan Detail
            const sjDetails = await t_surat_jalan_d.findAll({
            include: [{
                model: t_surat_jalan,
                as: 't_surat_jalan',
                where: {
                so_id: { [Op.in]: soIds },
                ...(sj_ids ? { id: { [Op.in]: sj_ids } } : {})
                },
            }],
            where: { item_id: { [Op.in]: itemIdsAll } },
            });

            const sjIdToSoId = {};
            for (const sd of sjDetails) {
            const sj = sd.t_surat_jalan;
            if (!sj) continue;
            const sjId = sj.id;
            const soId = sj.so_id;
            const dpId = sj.delivery_plan_id || null;
            sjIdToSoId[sjId] = soId;

            if (!dpBySO.has(soId)) continue;
            const dpMap = dpBySO.get(soId);
            if (!dpMap.has(dpId)) continue;

            const dpEntry = dpMap.get(dpId);

            if (!dpEntry.sjList.has(sjId)) {
                dpEntry.sjList.set(sjId, {
                header: { id: sjId, code: sj.code, sj_date: sj.date },
                totalQtySJ: 0,
                totalQtyReturn: 0,
                items: new Map(),
                });
            }
            const sjEntry = dpEntry.sjList.get(sjId);
            // const qtySJ = (sd.qty != null) ? sd.qty : (sd.qty_snapshot || 0);
            const qtySJ = sd.qty_snapshot || 0;
            sjEntry.totalQtySJ += (qtySJ || 0);

            const it = sjEntry.items.get(sd.item_id) || { qtySJ: 0, qtyReturn: 0 };
            it.qtySJ += (qtySJ || 0);
            sjEntry.items.set(sd.item_id, it);
            }

            // 4) Return SJ
            const sjReturnDetails = await t_surat_jalan_return_d.findAll({
            include: [{
                model: t_surat_jalan_return,
                as: 't_surat_jalan_return',
                attributes: ['id', 'sj_id']
            }],
            where: { item_id: { [Op.in]: itemIdsAll } },
            });

            for (const rd of sjReturnDetails) {
            const ret = rd.t_surat_jalan_return;
            if (!ret) continue;
            const sjId = ret.sj_id;
            const soId = sjIdToSoId[sjId];
            if (!soId || !dpBySO.has(soId)) continue;

            const dpMap = dpBySO.get(soId);
            for (const [, dpEntry] of dpMap) {
                if (!dpEntry.sjList.has(sjId)) continue;
                const sjEntry = dpEntry.sjList.get(sjId);
                sjEntry.totalQtyReturn += (rd.qty_return || 0);

                const it = sjEntry.items.get(rd.item_id) || { qtySJ: 0, qtyReturn: 0 };
                it.qtyReturn += (rd.qty_return || 0);
                sjEntry.items.set(rd.item_id, it);
                break;
            }
            }

            // 5) Build response
            const data = [];

            for (const so of salesOrders) {
            const soId = so.id;

            // DP untuk SO ini (urut tanggal)
            const dpMap = dpBySO.get(soId) || new Map();
            const dpArray = Array.from(dpMap.values()).sort((a, b) => {
                const da = new Date(a.delivery_plan_date), db = new Date(b.delivery_plan_date);
                return da - db;
            });

            // ===== HEADER.delivery_plans (TANPA qty_reservation) =====
            const headerDeliveryPlans = [];
            for (const dpEntry of dpArray) {
            let qtyDpHeader = 0;
            for (const [, q] of dpEntry.items) qtyDpHeader += (q || 0);

            const suratJalans = [];
            for (const [, sjEntry] of dpEntry.sjList) {
                suratJalans.push({
                id: sjEntry.header.id,
                code: sjEntry.header.code,           // <--- NEW
                sj_date: sjEntry.header.sj_date,
                qty_sj: sjEntry.totalQtySJ,
                qty_sj_return: sjEntry.totalQtyReturn,
                });
            }
            suratJalans.sort((a, b) => new Date(a.sj_date) - new Date(b.sj_date));

            headerDeliveryPlans.push({
                id: dpEntry.id,
                code: dpEntry.code,                    // <--- NEW
                delivery_plan_date: dpEntry.delivery_plan_date,
                qty_dp: qtyDpHeader,
                surat_jalans: suratJalans,
            });
            }

            // ===== Detail per item =====
            const detailsOut = [];
            let soQtyReservationTotal = 0;
            let soQtyClosedTotal      = 0;
            let soQtySOTotal          = 0;

            for (const d of so.t_sales_order_ds) {
            const itemId = d.item_id;
            const qtySO = (d.qty_snapshot != null) ? d.qty_snapshot : (d.qty || 0);
            const key = `${soId}|${itemId}`;
            const qtyReservationItem = reservationMap[key] || 0;
            const qtyClosedItem      = closingMap[key] || 0;

            soQtyReservationTotal += qtyReservationItem;
            soQtyClosedTotal      += qtyClosedItem;
            soQtySOTotal          += (qtySO || 0);

            const detailDPs = [];
            for (const dpEntry of dpArray) {
                const qtyDpItem = dpEntry.items.get(itemId) || 0;
                if (!qtyDpItem) continue;

                const sjListPerItem = [];
                for (const [, sjEntry] of dpEntry.sjList) {
                const it = sjEntry.items.get(itemId);
                if (!it) continue;
                sjListPerItem.push({
                    id: sjEntry.header.id,
                    code: sjEntry.header.code,         // <--- NEW
                    sj_date: sjEntry.header.sj_date,   // <--- NEW
                    qty_sj: it.qtySJ || 0,
                    qty_sj_return: it.qtyReturn || 0,
                });
                }

                detailDPs.push({
                id: dpEntry.id,
                code: dpEntry.code,                  // <--- NEW
                delivery_plan_date: dpEntry.delivery_plan_date, // <--- NEW
                qty_dp: qtyDpItem,
                surat_jalans: sjListPerItem,
                });
            }

            const detailPlain = d.get ? d.get({ plain: true }) : d;
            detailsOut.push({
                ...detailPlain,
                qty_so: qtySO,
                qty_reservation: qtyReservationItem,
                qty_closed: qtyClosedItem,
                delivery_plans: detailDPs,
            });
            }

            // HEADER "as-is" + totals di level SO
            const plainSo = so.get({ plain: true });
            const { t_sales_order_ds, ...plainWithoutDetails } = plainSo;

            data.push({
                ...plainWithoutDetails,
                // CHANGED: pindahkan ke level SO (bukan di setiap delivery_plan)
                qty_so: soQtySOTotal,
                qty_reservation: soQtyReservationTotal,
                qty_closed: soQtyClosedTotal,
                delivery_plans: headerDeliveryPlans,
                details: detailsOut,
            });
            }

            return res.json({ data, total: data.length });

        } catch (error) {
            console.error('Error in getSalesOrderRealizationReport:', error);
            return res.status(500).json({ error: error.message });
        }
    }

};
