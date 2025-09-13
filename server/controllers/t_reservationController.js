// Controller for t_reservation
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_reservation
//
// Tambahkan custom function di bawah ini
import { fn, col, literal, Op } from "sequelize";

export const t_reservationController = {
    // Contoh: Upload gambar ke database (kolom image: Buffer/BLOB)
    async uploadImage(req, res) {
        const imageFile = req.files?.find(f => f.mimetype.startsWith('image/'));
        if (!imageFile) return res.status(400).json({ error: 'No image file found' });
        try {
        const inserted = await req.models.t_reservation.create({ image: imageFile.buffer });
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
        const inserted = await req.models.t_reservation.bulkCreate(records);
        res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
        res.status(500).json({ error: err.message });
        }
    },

    async generateCode(req, res) {
        const params = req.query;
        const code = await getCodeStructure(req.models.t_reservation, params.menu_id, params.unit_bussiness_id)
        if (code.status === 'err') {
            res.json(errorResponse(code.error))
        }
        res.json(successResponse(code.data))
    },

    async bookReservation(req, res) {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed.' });
        }

        const { t_reservation, t_reservation_d, t_reservation_history, m_warehouse, m_item_conversion } = req.models;
        const payload = req.body;
        const menuId = '9d47d033-d1e2-4ac3-b85d-5ae56591f4ca'; // id menu reservation
        const user = req.user;
        const sequelize = t_reservation.sequelize;
        const transaction = await sequelize.transaction();

        try {
            const reservation = await t_reservation.findByPk(payload.id);
            if (!reservation) {
                return res.status(404).json({ error: 'Reservation tidak ditemukan' });
            }

            if (!reservation.code) {
                const code = await getCodeStructure(t_reservation, menuId, payload.unit_bussiness_id);
                reservation.code = code.data;
            }

            for (const detail of payload.t_reservation_d) {
                if (detail.stock_booking > detail.so_qty) {
                    return res.status(400).json({
                        error: `Stock booking (${detail.stock_booking}) melebihi so_qty (${detail.so_qty}) untuk item ${detail.item_id}`
                    });
                }
            }

            const warehouse = await m_warehouse.findOne({
                where: { unit_bussiness_id: reservation.unit_bussiness_id }
            });
            if (!warehouse) {
                throw new Error('Gudang tidak ditemukan');
            }

            let reservationStatus = 2; // default full booked

            for (const detail of payload.t_reservation_d) {
                const existing = await t_reservation_d.findOne({
                    where: {
                        reservation_id: reservation.id,
                        item_id: detail.item_id,
                    },
                });

                const status = detail.stock_booking === detail.so_qty ? 2 : 1;
                if (status === 1) reservationStatus = 1;

                // const conversion = await m_item_conversion.findOne({
                //     where: {
                //         item_id: detail.item_id,
                //         item_uom_id: detail.uom_id,
                //     }
                // });

                // if (!conversion || !conversion.value) {
                //     throw new Error('Item conversion not found or invalid');
                // }

                const inventoryQty = detail.stock_booking * detail.uom_value;

                // Cek apakah sudah ada entry, jika ada update, jika tidak insert
                if (existing) {
                    const oldQty = existing.stock_booking;
                    await existing.update({
                        so_qty: detail.so_qty,
                        uom_id: detail.uom_id,
                        uom_unit: detail.uom_unit,
                        uom_value: detail.uom_value,
                        free_stock: detail.free_stock,
                        stock_booking: detail.stock_booking,
                        status: status,
                    }, { transaction });

                    if (oldQty !== detail.stock_booking) {
                        await t_reservation_history.create({
                            reservation_id: reservation.id,
                            item_id: detail.item_id,
                            date: new Date(),
                            qty_booking: detail.stock_booking > oldQty ? detail.stock_booking - oldQty : 0,
                            qty_release: detail.stock_booking < oldQty ? oldQty - detail.stock_booking : 0,
                        }, { transaction });

                        // release stock temp warehouse
                        await inventoryService.releaseStock({
                            reference_id: reservation.id,
                            reference_source: 't_reservation'
                        });

                        // allocate stock to temp warehouse
                        await inventoryService.allocateStock({
                            item_id: detail.item_id,
                            warehouse_id: warehouse.id,
                            quantity: inventoryQty,
                            reference_id: reservation.id,
                            reference_source: 't_reservation'
                        });
                    }
                } else {
                    await t_reservation_d.create({
                        reservation_id: reservation.id,
                        item_id: detail.item_id,
                        so_qty: detail.so_qty,
                        uom_id: detail.uom_id,
                        uom_unit: detail.uom_unit,
                        uom_value: detail.uom_value,
                        free_stock: detail.free_stock,
                        stock_booking: detail.stock_booking,
                        status: status,
                    }, { transaction });

                    await t_reservation_history.create({
                        reservation_id: reservation.id,
                        item_id: detail.item_id,
                        date: new Date(),
                        qty_booking: detail.stock_booking,
                        qty_release: 0,
                    }, { transaction });

                    // allocate stock to temp warehouse
                    await inventoryService.allocateStock({
                        item_id: detail.item_id,
                        warehouse_id: warehouse.id,
                        quantity: inventoryQty,
                        reference_id: reservation.id,
                        reference_source: 't_reservation'
                    });
                }

                // Update qty_snapshot pada t_sales_order_d
                for (const detail of payload.t_reservation_d) {
                    // Hitung total stock_booking untuk item ini pada reservation ini
                    const reservationDetail = await t_reservation_d.findOne({
                        where: {
                            reservation_id: reservation.id,
                            item_id: detail.item_id,
                        },
                        transaction
                    });

                    // Update ke t_sales_order_d
                    await req.models.t_sales_order_d.update(
                        {
                            qty: reservationDetail.stock_booking
                            // qty_snapshot: reservationDetail.stock_booking
                        },
                        {
                            where: {
                                so_id: reservation.so_id,
                                item_id: detail.item_id,
                            },
                            transaction
                        }
                    );
                }
            }

            // Update reservation code dan status
            await reservation.update({
                code: reservation.code,
                status: reservationStatus,
                updated_by: user.id,
                // updated_by: "06da1eab-b88d-4ff2-b264-c792ab386684"
            }, { transaction });

            await transaction.commit();
            res.status(200).json({ message: 'Reservation berhasil disimpan' });
        } catch (err) {
            await transaction.rollback();
            res.status(500).json({ error: err.message });
        }
    },

    async getReservationHistory(req, res) {
        const { t_reservation_history, m_item } = req.models;
        const { reservation_id, item_id } = req.query;

        if (!reservation_id || !item_id) {
            return res.status(400).json({ error: 'reservation_id dan item_id wajib diisi' });
        }

        try {
            const history = await t_reservation_history.findAll({
                attributes: [
                    [fn('DATE', col('date')), 'tanggal'],
                    [fn('SUM', col('qty_booking')), 'qty_booking'],
                    [fn('SUM', col('qty_release')), 'qty_release'],
                ],
                where: {
                    reservation_id,
                    item_id,
                },
                group: [fn('DATE', col('date'))],
                order: [[fn('DATE', col('date')), 'ASC']],
                raw: true,
            });

            const item = await m_item.findByPk(item_id, {
                attributes: ['id', 'code', 'name'],
                raw: true,
            });

            res.status(200).json({
                reservation_id,
                item,
                history,
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async getReservationByID(req, res) {
        if (req.method !== 'GET') {
            return res.status(405).json({ error: 'Method not allowed.' });
        }

        const {
            t_reservation,
            t_reservation_d,
            t_sales_order,
            m_item,
            m_customer,
            m_unit_bussiness,
            m_warehouse,
            m_gen,
            user
        } = req.models;

        const { id } = req.query;

        if (!id) {
            return res.status(400).json({ error: 'id wajib diisi' });
        }

        try {
            const reservation = await t_reservation.findByPk(id, {
                include: [
                    {
                        model: t_reservation_d,
                        as: 't_reservation_ds',
                        include: [
                            {
                                model: m_item,
                                as: 'm_item',
                                include: [
                                    { model: m_gen, as: 'itemType' },
                                    { model: m_gen, as: 'itemDivision' },
                                    { model: m_gen, as: 'itemKind' },
                                    { model: m_gen, as: 'itemGroup' },
                                    { model: m_gen, as: 'itemGenGroup' },
                                    { model: m_gen, as: 'itemUom' },
                                ]
                            },
                            {
                                model: m_gen,
                                as: 'reservationUom',
                                attributes: ['id', 'group', 'key1', 'value1', 'value2', 'value3']
                            }
                        ]
                    },
                    {
                        model: t_sales_order,
                        as: 't_sales_order',
                        attributes: ['id', 'code']
                    },
                    {
                        model: m_customer,
                        as: 'm_customer',
                        attributes: ['id', 'code', 'name']
                    },
                    {
                        model: m_unit_bussiness,
                        as: 'm_unit_bussiness',
                        attributes: ['id', 'code', 'name']
                    },
                    {
                        model: user,
                        as: 'user_default',
                        attributes: ['id', 'name', 'username']
                    }
                ]
            });

            if (!reservation) {
                return res.status(404).json({ error: 'Data tidak ditemukan' });
            }

            const warehouse = await m_warehouse.findOne({
                where: { unit_bussiness_id: reservation.unit_bussiness_id }
            });
            if (!warehouse) {
                throw new Error('Gudang tidak ditemukan');
            }

            await Promise.all(reservation.t_reservation_ds.map(async (detail) => {
                const currentStock = await inventoryService.getCurrentStock(detail.item_id, warehouse.id);
                detail.free_stock = currentStock;
            }));

            return res.status(200).json({
                status: 'success',
                data: reservation
            });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    },

    async getSalesOrderReservationToDeliveryPlan(req, res) {
        try {
            const { search = '', limit = 20, unit_bussiness_id } = req.query;

            if (!unit_bussiness_id) {
                throw new Error("Missing required query.")
            }

            const reservations = await req.models.t_reservation.findAll({
                where: {
                    status: { [Op.in]: [1, 2] },
                },
                limit: parseInt(limit, 10),
                include: [
                    {
                        model: req.models.t_sales_order,
                        as: 't_sales_order',
                        where: {
                            code: { [Op.iLike]: `%${search}%` },
                            unit_bussiness_id
                        },
                        required: true,
                        include: [
                            {
                                model: req.models.t_sales_order_d,
                                as: 't_sales_order_ds',
                                include: [
                                    {
                                        model: req.models.m_item,
                                        as: 'm_item',
                                    }
                                ]
                            },
                            {
                                model: req.models.m_customer,
                                as: 'm_customer',
                                include: [
                                    { model: req.models.m_customer_d_address, as: 'm_customer_d_addresses' },
                                    { model: req.models.m_customer_d_phone, as: 'm_customer_d_phones' },
                                    { model: req.models.m_customer_d_npwp, as: 'm_customer_d_npwps' },
                                    { model: req.models.m_customer_d_account, as: 'm_customer_d_accounts' },
                                    { model: req.models.m_customer_d_restriction, as: 'm_customer_d_restrictions' },
                                ]
                            },
                            {
                                model: req.models.m_gen,
                                as: 'soTop',
                                required: false
                            },
                            {
                                model: req.models.m_gen,
                                as: 'soPpn',
                                required: false
                            }
                        ]
                    },
                    {
                        model: req.models.t_reservation_d,
                        as: 't_reservation_ds',
                        required: true
                    }
                ],
                order: [['date', 'DESC']]
            });

            const response = reservations.map(r => {
                const so = r.t_sales_order || {};
                const soDetails = so.t_sales_order_ds || [];
                const reservationDs = r.t_reservation_ds || [];

                // Map untuk lookup cepat berdasarkan item_id
                const reservationMap = new Map(
                    reservationDs.map(rd => [rd.item_id, rd.stock_booking ?? 0])
                );
                // const reservationMap = new Map(
                //     reservationDs.map(rd => [rd.item_id, {
                //         stock_booking: rd.stock_booking ?? 0,
                //         so_qty: rd.so_qty ?? 0
                //     }])
                // );

                // Filter detail berdasarkan stock_booking > 0
                const filteredDetails = soDetails
                    .map(d => {
                        // const reservationData = reservationMap.get(d.item_id) || { stock_booking: 0, so_qty: 0 };
                        const stockBooking = reservationMap.get(d.item_id) || 0;
                        return {
                            ...d.toJSON(),
                            stock_booking: stockBooking,
                            // stock_booking: reservationData.stock_booking,
                            // so_qty: reservationData.so_qty,
                        };
                    })
                    .filter(d => d.stock_booking > 0);

                const item_qty = filteredDetails.length;

                // Skip jika tidak ada item dengan stock_booking > 0
                if (item_qty === 0) return null;

                const weight = filteredDetails.reduce((acc, detail) => {
                    // const itemWeight = detail.m_item?.marketing_weight || 0;

                    const itemWeight = detail.m_item?.actual_weight || 0;
                    
                    return acc + itemWeight * detail.qty;
                }, 0);

                return {
                    ...so.toJSON(),
                    item_qty,
                    weight,
                    t_sales_order_ds: filteredDetails
                };
            })
            .filter(Boolean); // Hapus hasil `null`

            res.status(200).json({ data: response });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    // Laporan Reservation Order
    async getReservationOrderReport(req, res) {
        try {
            const {
                t_sales_order,
                t_sales_order_d,
                t_reservation,
                t_reservation_d,
                t_reservation_history,
                t_delivery_plan,
                t_delivery_plan_d,
                t_delivery_plan_d_item,
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
            order: [['createdAt', 'DESC']],
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
            ]
            });

            const result = [];

            for (const so of salesOrders) {
                // Ambil semua detail SO
                const soDetails = await t_sales_order_d.findAll({
                    where: { so_id: so.id },
                    include: [{
                    model: m_item,
                    as: 'm_item',
                    where: item_ids || item_group_ids ? {
                        ...(item_ids && { id: { [Op.in]: item_ids } }),
                        ...(item_group_ids && { item_group_id: { [Op.in]: item_group_ids } }),
                    } : undefined,
                    required: !!(item_ids || item_group_ids),
                    include: [{ model: m_gen, as: 'itemGroup' }]
                    }]
                });

                // Hitung total qty_so (untuk summary)
                const qty_so = soDetails.reduce((sum, d) => sum + (d.qty_snapshot || 0), 0);

                // const reservation = await t_reservation.findOne({ where: { so_id: so.id } });
                // let qty_reservasi = 0;
                let reservationDetails = [];

                // Ambil data reservation
                const reservation = await t_reservation.findOne({ where: { so_id: so.id } });

                if (reservation) {
                    reservationDetails = await t_reservation_d.findAll({
                        where: { reservation_id: reservation.id },
                        include: [
                            {
                            model: m_item,
                            as: 'm_item',
                            attributes: ['id', 'code', 'name', 'item_group_id', 'actual_weight'],
                            include: [{
                                model: m_gen,
                                as: 'itemGroup',
                                attributes: ['id', 'group', 'value1'],
                            }]
                            }
                        ]
                    });
                } else {
                    // fallback: generate detail dari SO saja
                    reservationDetails = soDetails.map(d => {
                        const item = d.m_item?.toJSON() || {};
                        return {
                            item_id: d.item_id,
                            qty_so: d.qty_snapshot || 0,
                            qty_reservation: 0,
                            qty_dp: 0,
                            weight: 0,
                            m_item: item,
                        };
                    });
                }

                // Delivery Plan data
                const dpHeaders = await t_delivery_plan_d.findAll({
                    include: [
                        {
                        model: t_delivery_plan,
                        as: 't_delivery_plan',
                        where: { status: 4 }, // hanya ambil delivery_plan dengan status 4
                        },
                    ],
                    where: {
                        so_id: so.id,
                    },
                });
                const dpItemList = [];
                for (const dp of dpHeaders) {
                    const items = await t_delivery_plan_d_item.findAll({ where: { delivery_plan_d_id: dp.id } });
                    dpItemList.push(...items);
                }

                const qty_dp = dpItemList.reduce((sum, i) => sum + (i.qty_dp || 0), 0);
                const weight_total = dpItemList.reduce((sum, i) => sum + (i.weight || 0), 0);

                // Inject qty_so, qty_dp, weight per item ke reservationDetails
                let qty_reservation = 0;
                for (const detail of reservationDetails) {
                    const itemId = detail.item_id;

                    if (!reservation) {
                        continue
                    }

                    const history = await t_reservation_history.findAll({
                        where: {
                            reservation_id: reservation.id,
                            item_id: itemId
                        }
                    });

                    const total_booking = history.reduce((sum, h) => sum + (h.qty_booking || 0), 0);
                    const total_release = history.reduce((sum, h) => sum + (h.qty_release || 0), 0);

                    const qty_reservasi = total_booking - total_release;

                    // qty_so by item_id
                    const soItemQty = soDetails
                    .filter(d => d.item_id === itemId)
                    .reduce((sum, d) => sum + (d.qty_snapshot || 0), 0);

                    // qty_dp and weight by item_id
                    const dpItemData = dpItemList.filter(i => i.item_id === itemId);
                    const itemQtyDP = dpItemData.reduce((sum, d) => sum + (d.qty_dp || 0), 0);
                    const itemWeight = dpItemData.reduce((sum, d) => sum + (d.weight || 0), 0);

                    // Tambahkan ke detail
                    detail.setDataValue('qty_so', soItemQty);
                    detail.setDataValue('qty_reservation', qty_reservasi);
                    detail.setDataValue('qty_dp', itemQtyDP);
                    detail.setDataValue('weight', itemWeight);

                    qty_reservation += qty_reservasi;
                }

                const soJSON = so.toJSON();

                result.push({
                    ...soJSON,
                    qty_so,
                    qty_reservasi: qty_reservation,
                    qty_dp,
                    weight_total,
                    detail: reservationDetails,
                });
            }

            return res.json({ data: result, total: result.length });
        } catch (error) {
            console.error('Error in getReservationOrderReport:', error);
            return res.status(500).json({ error: error.message });
        }
    },

    // Laporan Outstanding Item Belum Reservation
    async getOutstandingItemReservationReport(req, res) {
        try {
            const {
                t_sales_order,
                t_sales_order_d,
                t_reservation,
                t_reservation_d,
                t_reservation_history,
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
            const status = toArray(req.query.status);

            const whereClause = {};
            if (unit_bussiness_ids?.length) {
            whereClause.unit_bussiness_id = { [Op.in]: unit_bussiness_ids };
            }
            if (customer_ids?.length) {
            whereClause.customer_id = { [Op.in]: customer_ids };
            }
            if (so_ids?.length) {
            whereClause.id = { [Op.in]: so_ids };
            }
            if (sales_ids?.length) {
            whereClause.sales_id = { [Op.in]: sales_ids };
            }
            if (status?.length) {
            whereClause.status = { [Op.in]: status };
            }
            if (start_date && end_date) {
            whereClause.date = { [Op.between]: [start_date, end_date] };
            }

            // const salesOrders = await t_sales_order.findAll({
            //     where: whereClause,
            //     include: [
            //         { model: m_unit_bussiness, as: 'm_unit_bussiness', attributes: ['id', 'code', 'name'] },
            //         {
            //             model: m_customer, 
            //             as: 'm_customer', 
            //             attributes: ['id', 'code', 'name'],
            //             where: customer_group_ids ? { group_id: { [Op.in]: customer_group_ids } } : undefined
            //         },
            //         { model: m_customer_d_address, as: 'm_customer_d_address', attributes: ['id', 'address'] },
            //         {
            //             model: user,
            //             as: 'user_default',
            //             attributes: ['id', 'name'],
            //             include: [
            //                 {
            //                 model: m_sales_area_d_sales,
            //                 as: 'm_sales_area_d_sale',
            //                 attributes: ['id', 'sales_id', 'sales_area_id'],
            //                 where: sales_area_ids
            //                     ? { sales_area_id: { [Op.in]: sales_area_ids } }
            //                     : undefined,
            //                 include: [
            //                     {
            //                     model: m_sales_area,
            //                     as: 'm_sales_area',
            //                     attributes: ['id', 'code'],
            //                     }
            //                 ]
            //                 }
            //             ]
            //         },
            //         { model: user, as: 'tsocreatedBy', attributes: ['id', 'name'] },
            //     ],
            //     distinct: true
            // });

            // const result = [];

            // for (const so of salesOrders) {
            // const soDetails = await t_sales_order_d.findAll({
            //     where: { so_id: so.id },
            //     include: [{
            //         model: m_item,
            //         as: 'm_item',
            //         where: item_ids?.length || item_group_ids?.length ? {
            //         ...(item_ids?.length && { id: { [Op.in]: item_ids } }),
            //         ...(item_group_ids?.length && { item_group_id: { [Op.in]: item_group_ids } }),
            //         } : undefined,
            //         required: !!(item_ids?.length || item_group_ids?.length),
            //         include: [{ model: m_gen, as: 'itemGroup' }]
            //     }]
            // });

            // const qty_so = soDetails.reduce((sum, d) => sum + (d.qty_snapshot || 0), 0);

            // const reservation = await t_reservation.findOne({
            //     where: { so_id: so.id },
            //     include: [
            //     {
            //         model: t_reservation_d,
            //         as: 't_reservation_ds',
            //         include: [
            //             {
            //                 model: m_item,
            //                 as: 'm_item',
            //                 include: [{ model: m_gen, as: 'itemGroup' }]
            //             }
            //         ]
            //     },
            //     ],
            // });

            // let qty_reserve = 0;

            // if (reservation) {
            //     const history = await t_reservation_history.findAll({
            //         where: { reservation_id: reservation.id }
            //     });

            //     const total_booking = history.reduce((sum, h) => sum + (h.qty_booking || 0), 0);
            //     const total_release = history.reduce((sum, h) => sum + (h.qty_release || 0), 0);

            //     qty_reserve = total_booking - total_release;
            // }

            // const balance = qty_so - qty_reserve;

            // result.push({
            //     ...so.toJSON(),
            //     qty_so,
            //     qty_reserve,
            //     balance,
            //     reservation, // untuk kebutuhan frontend
            // });
            // }

            const soDetails = await t_sales_order_d.findAll({
                distinct: true,
                include: [
                    {
                    model: t_sales_order,
                    as: 't_sales_order',
                    where: whereClause,
                    include: [
                        { model: m_unit_bussiness, as: 'm_unit_bussiness', attributes: ['id', 'code', 'name'] },
                        {
                            model: m_customer,
                            as: 'm_customer',
                            attributes: ['id', 'code', 'name'],
                            where: customer_group_ids?.length ? { group_id: { [Op.in]: customer_group_ids } } : undefined,
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
                                    // distinct: true,
                                    attributes: ['id', 'sales_id', 'sales_area_id'],
                                    where: sales_area_ids?.length ? { sales_area_id: { [Op.in]: sales_area_ids } } : undefined,
                                    include: [
                                        {
                                            model: m_sales_area,
                                            as: 'm_sales_area',
                                        },
                                    ],
                                },
                            ],
                        },
                        { model: user, as: 'tsocreatedBy', attributes: ['id', 'name'] },
                    ],
                    },
                    {
                        model: m_item,
                        as: 'm_item',
                        // required: false,
                        where: item_ids?.length || item_group_ids?.length ? {
                            ...(item_ids?.length && { id: { [Op.in]: item_ids } }),
                            ...(item_group_ids?.length && { item_group_id: { [Op.in]: item_group_ids } }),
                        } : undefined,
                        required: !!(item_ids?.length || item_group_ids?.length),
                        include: [{ model: m_gen, as: 'itemGroup' }, { model: m_gen, as: 'itemUom' }],
                    },
                ],
                });

                const result = [];

                for (const d of soDetails) {
                const so = d.t_sales_order;

                // cari reservation untuk so.id & item.id
                const reservation = await t_reservation.findOne({
                    where: { so_id: so.id },
                    include: [
                    {
                        model: t_reservation_d,
                        as: 't_reservation_ds',
                        where: { item_id: d.item_id }, // filter sesuai item detail
                        required: false,
                    },
                    ],
                });

                let qty_reserve = 0;
                if (reservation) {
                    const history = await t_reservation_history.findAll({
                    where: { reservation_id: reservation.id, item_id: d.item_id },
                    });
                    const total_booking = history.reduce((s, h) => s + (h.qty_booking || 0), 0);
                    const total_release = history.reduce((s, h) => s + (h.qty_release || 0), 0);
                    qty_reserve = total_booking - total_release;
                }

                result.push({
                    so_id: so.id,
                    so_code: so.code,
                    so_date: so.date,
                    notes: so.notes,
                    tsocreatedBy: so.tsocreatedBy,
                    customer: so.m_customer,
                    unit_bussiness: so.m_unit_bussiness,
                    sales: so.user_default,
                    item_id: d.item_id,
                    item: d.m_item,
                    qty_so: d.qty_snapshot || 0,
                    qty_reserve,
                    uom_id: d.uom_id,
                    uom_unit: d.uom_unit,
                    uom_value: d.uom_value,
                    balance: (d.qty_snapshot || 0) - qty_reserve,
                    reservation,
                });
            }

            return res.json({ data: result, total: result.length });
        } catch (error) {
            console.error('Error in getOutstandingItemReservationReport:', error);
            return res.status(500).json({ error: error.message });
        }
    }

};
