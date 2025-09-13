// Controller for t_sales_order_closing
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_sales_order_closing
//
// Tambahkan custom function di bawah ini
import { fn, col, literal, Op } from "sequelize";

export const t_sales_order_closingController = {
    // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
    async uploadImage(req, res) {
        const fileFields = Object.keys(req.models.t_sales_order_closing.rawAttributes).filter(
        key => req.models.t_sales_order_closing.rawAttributes[key].type && req.models.t_sales_order_closing.rawAttributes[key].type.key === 'STRING'
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
        const inserted = await req.models.t_sales_order_closing.create(data);
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
        const inserted = await req.models.t_sales_order_closing.bulkCreate(records);
        res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
        res.status(500).json({ error: err.message });
        }
    },

    async upsertSalesOrderClosing(req, res) {
        const payload = req.body;
        const { id } = req.query;
        const {
            t_sales_order_closing,
            t_sales_order_closing_d,
            t_sales_order,
            t_sales_order_d,
            t_reservation,
            t_reservation_d,
            t_reservation_history,
            m_warehouse
        } = req.models;
        const user = req.user;
        const transaction = await t_sales_order_closing.sequelize.transaction();

        try {
            // Validasi SO
            const salesOrder = await t_sales_order.findOne({
                where: { id: payload.so_id },
                transaction
            });
            if (!salesOrder) {
                throw new Error("Sales Order tidak ditemukan");
            }

            let soClosing = null;

            // === CREATE ===
            if (!id) {
                soClosing = await t_sales_order_closing.create({
                    so_id: payload.so_id,
                    unit_bussiness_id: payload.unit_bussiness_id,
                    status: payload.status,
                    reason_id: payload.reason_id,
                    notes: payload.notes || null,
                    unit_bussiness: payload.unit_bussiness,
                    customer_name: payload.customer_name,
                    customer_id: salesOrder.customer_id,
                    created_by: user.id,
                }, { transaction });

            // === UPDATE ===
            } else {
                soClosing = await t_sales_order_closing.findOne({
                    where: { id: id },
                    transaction
                });

                if (!soClosing) {
                    throw new Error("Data Sales Order Closing tidak ditemukan");
                }

                await soClosing.update({
                    unit_bussiness_id: payload.unit_bussiness_id,
                    status: payload.status,
                    reason_id: payload.reason_id,
                    notes: payload.notes || null,
                    unit_bussiness: payload.unit_bussiness,
                    customer_name: payload.customer_name,
                    customer_id: salesOrder.customer_id,
                    updated_by: user.id,
                }, { transaction });
            }

            // Validasi Detail
            if (!payload.t_sales_order_closing_d || !Array.isArray(payload.t_sales_order_closing_d)) {
                throw new Error("Data detail Sales Order Closing tidak valid");
            }

            for (const detail of payload.t_sales_order_closing_d) {
                if (!detail.item_id) {
                    throw new Error("item_id tidak boleh kosong di detail");
                }

                // Validasi logis
                if (detail.qty_closing > detail.qty_os) {
                    throw new Error(`qty_closing melebihi qty_os untuk item ${detail.item_id}`);
                }

                if (!detail.id) {
                    // CREATE detail
                    await t_sales_order_closing_d.create({
                        so_closing_id: soClosing.id,
                        item_id: detail.item_id,
                        qty_so: detail.qty_so,
                        qty_sj: detail.qty_sj,
                        qty_os: detail.qty_os,
                        qty_closing: detail.qty_closing,
                        uom_unit: detail.uom_unit || null,
                        notes: detail.notes || null
                    }, { transaction });
                } else {
                    // UPDATE detail
                    const existingDetail = await t_sales_order_closing_d.findOne({
                        where: {
                            id: detail.id,
                            so_closing_id: soClosing.id
                        },
                        transaction
                    });

                    if (!existingDetail) {
                        throw new Error(`Detail closing dengan id ${detail.id} tidak ditemukan`);
                    }

                    await existingDetail.update({
                        qty_so: detail.qty_so,
                        qty_sj: detail.qty_sj,
                        qty_os: detail.qty_os,
                        qty_closing: detail.qty_closing,
                        uom_unit: detail.uom_unit || null,
                        notes: detail.notes || null
                    }, { transaction });
                }

                // Update qty SO jika status = 2
                if (payload.status === 2 && detail.qty_closing > 0) {
                    const warehouse = await m_warehouse.findOne({
                        where: { unit_bussiness_id: payload.unit_bussiness_id }
                    });
                    if (!warehouse) {
                        throw new Error('Gudang tidak ditemukan');
                    }

                    // lock row supaya aman dari race condition
                    const orderDetail = await t_sales_order_d.findOne({
                        where: {
                            so_id: payload.so_id,
                            item_id: detail.item_id
                        },
                        transaction,
                        lock: transaction.LOCK.UPDATE
                    });

                    if (!orderDetail) {
                        throw new Error('Sales order detail tidak ditemukan');
                    }

                    if (orderDetail.qty < detail.qty_closing) {
                        throw new Error('Qty SO tidak mencukupi (akan minus)');
                    }

                    // lakukan update
                    await orderDetail.update(
                        {
                            qty: orderDetail.qty - detail.qty_closing,
                            updated_by: user.id
                        },
                        { transaction }
                    );

                    // lanjutkan proses reservation, history, inventory
                    const reservations = await t_reservation.findAll({ where: { so_id: payload.so_id }, transaction });
                    for (const res of reservations) {
                        const { Sequelize } = t_reservation_d.sequelize;
                        await t_reservation_d.update(
                            {
                                so_qty: Sequelize.literal(`so_qty - ${detail.qty_closing}`),
                                updated_by: user.id
                            },
                            {
                                where: {
                                    reservation_id: res.id,
                                    item_id: detail.item_id
                                },
                                transaction
                            }
                        );

                        // Disable karena tidak dibutuhkan dan menjadi isu di laporan karena nambah history yang gk perlu
                        // await t_reservation_history.create({
                        //     reservation_id: res.id,
                        //     item_id: detail.item_id,
                        //     date: new Date(),
                        //     qty_booking: 0,
                        //     qty_release: detail.qty_closing,
                        // }, { transaction });

                        await inventoryService.releaseStock({
                            reference_id: res.id,
                            reference_source: 't_reservation'
                        });

                        await inventoryService.allocateStock({
                            item_id: detail.item_id,
                            warehouse_id: warehouse.id,
                            quantity: detail.qty_closing,
                            reference_id: res.id,
                            reference_source: 't_reservation'
                        });
                    }
                }
            }

            await transaction.commit();
            return res.status(200).json({
                message: "Upsert Sales Order Closing berhasil",
                data: soClosing
            });

        } catch (error) {
            await transaction.rollback();
            console.error(error);
            return res.status(500).json({
                message: "Terjadi kesalahan saat upsert Sales Order Closing",
                error: error.message
            });
        }
    },

    // Laporan SO Closing
    // async getSalesOrderClosingReport(req, res) {
    //     try {
    //         const {
    //             t_sales_order,
    //             t_sales_order_d,
    //             t_sales_order_closing,
    //             t_sales_order_closing_d,
    //             t_reservation,
    //             t_reservation_d,
    //             t_reservation_history,
    //             m_customer,
    //             m_customer_d_address,
    //             m_unit_bussiness,
    //             m_item,
    //             m_gen,
    //             user,
    //             m_sales_area,
    //             m_sales_area_d_sales,
    //         } = req.models;

    //         const {
    //             start_date,
    //             end_date,
    //         } = req.query;

    //         const unit_bussiness_ids = toArray(req.query.unit_bussiness_ids);
    //         const customer_ids = toArray(req.query.customer_ids);
    //         const customer_group_ids = toArray(req.query.customer_group_ids);
    //         const so_ids = toArray(req.query.so_ids);
    //         const sales_ids = toArray(req.query.sales_ids);
    //         const sales_area_ids = toArray(req.query.sales_area_ids);
    //         const item_ids = toArray(req.query.item_ids);
    //         const item_group_ids = toArray(req.query.item_group_ids);
    //         const status = toArray(req.query.status);

    //         const whereClause = {};
    //         if (unit_bussiness_ids) whereClause.unit_bussiness_id = { [Op.in]: unit_bussiness_ids };
    //         if (customer_ids) whereClause.customer_id = { [Op.in]: customer_ids };
    //         if (so_ids) whereClause.id = { [Op.in]: so_ids };
    //         if (sales_ids) whereClause.sales_id = { [Op.in]: sales_ids };
    //         if (start_date && end_date) whereClause.date = { [Op.between]: [start_date, end_date] };
    //         if (status) whereClause.status = { [Op.in]: status };

    //         const salesOrders = await t_sales_order.findAll({
    //             where: whereClause,
    //             include: [
    //                 { model: m_unit_bussiness, as: 'm_unit_bussiness', attributes: ['id', 'code', 'name'] },
    //                 { 
    //                     model: m_customer, 
    //                     as: 'm_customer', 
    //                     attributes: ['id', 'code', 'name'],
    //                     where: customer_group_ids ? { group_id: { [Op.in]: customer_group_ids } } : undefined
    //                 },
    //                 { model: m_customer_d_address, as: 'm_customer_d_address', attributes: ['id', 'address'] },
    //                 { model: m_gen, as: 'soTop', attributes: ['id', 'key1', 'value1'] },
    //                 { model: m_gen, as: 'soPpn', attributes: ['id', 'key1', 'value1'] },
    //                 {
    //                     model: user,
    //                     as: 'user_default',
    //                     attributes: ['id', 'name'],
    //                     include: [
    //                         {
    //                         model: m_sales_area_d_sales,
    //                         as: 'm_sales_area_d_sale',
    //                         attributes: ['id', 'sales_id', 'sales_area_id'],
    //                         where: sales_area_ids
    //                             ? { sales_area_id: { [Op.in]: sales_area_ids } }
    //                             : undefined,
    //                         include: [
    //                             {
    //                             model: m_sales_area,
    //                             as: 'm_sales_area',
    //                             attributes: ['id', 'code'],
    //                             }
    //                         ]
    //                         }
    //                     ]
    //                 },
    //                 {
    //                     model: t_sales_order_d,
    //                     as: 't_sales_order_ds',
    //                     include: [
    //                         {
    //                             model: m_item,
    //                             as: 'm_item',
    //                             where: item_ids || item_group_ids ? {
    //                                 ...(item_ids && { id: { [Op.in]: item_ids } }),
    //                                 ...(item_group_ids && { item_group_id: { [Op.in]: item_group_ids } }),
    //                             } : undefined,
    //                             required: !!(item_ids || item_group_ids),
    //                             attributes: ['id', 'code', 'name', 'item_group_id', 'actual_weight'],
    //                             include: [
    //                                 {
    //                                     model: m_gen,
    //                                     as: 'itemGroup',
    //                                     attributes: ['id', 'group', 'value1'],
    //                                 }
    //                             ]
    //                         }
    //                     ]
    //                 },
    //                 { model: user, as: 'tsocreatedBy', attributes: ['id', 'name'] },
    //             ]
    //         });

    //         const result = [];

    //         for (const so of salesOrders) {
    //             const soJSON = so.toJSON();

    //             let header_qty_so = 0;
    //             let header_qty_reservation = 0;
    //             let header_qty_closed = 0;

    //             // Loop per detail item
    //             for (const detail of soJSON.t_sales_order_ds) {
    //                 const itemId = detail.item_id;

    //                 // --- Hitung qty reservation per item ---
    //                 let qty_reservation = 0;
    //                 const reservation = await t_reservation.findOne({ where: { so_id: so.id } });

    //                 if (reservation) {
    //                     const history = await t_reservation_history.findAll({
    //                         where: {
    //                             reservation_id: reservation.id,
    //                             item_id: itemId
    //                         }
    //                     });

    //                     const total_booking = history.reduce((sum, h) => sum + (h.qty_booking || 0), 0);
    //                     const total_release = history.reduce((sum, h) => sum + (h.qty_release || 0), 0);

    //                     qty_reservation = total_booking - total_release;
    //                 }

    //                 // --- Hitung qty closed per item ---
    //                 let qty_closed = 0;

    //                 const soClosings = await t_sales_order_closing.findAll({
    //                     where: { so_id: so.id, status: 2 },
    //                     include: [{ model: m_gen, as: 'tsocReason' }]
    //                 });

    //                 if (soClosings.length) {
    //                     for (const soc of soClosings) {
    //                         const socDetails = await t_sales_order_closing_d.findAll({
    //                             where: {
    //                                 so_closing_id: soc.id,
    //                                 item_id: itemId
    //                             }
    //                         });
    //                         qty_closed += socDetails.reduce((sum, d) => sum + (d.qty_closing || 0), 0);
    //                     }
    //                 }

    //                 // --- Hitung total per item ---
    //                 const total = ((detail.total_amt || 0) / detail.qty_snapshot) * qty_closed;

    //                 // Simpan hasilnya di detail
    //                 detail.qty_reservation = qty_reservation;
    //                 detail.qty_closed = qty_closed;
    //                 detail.total = total;

    //                 // Akumulasi untuk header
    //                 header_qty_so += detail.qty_snapshot;
    //                 header_qty_reservation += qty_reservation;
    //                 header_qty_closed += qty_closed;
    //             }

    //             // Simpan qty total di header SO
    //             soJSON.qty_so = header_qty_so;
    //             soJSON.qty_reservation = header_qty_reservation;
    //             soJSON.qty_closed = header_qty_closed;
    //             soJSON.reason_closing = "-";

    //             result.push(soJSON);
    //         }

    //         return res.json({ data: result, total: result.length });
    //     } catch (error) {
    //         console.error('Error in getSalesOrderReport:', error);
    //         return res.status(500).json({ error: error.message });
    //     }
    // }

    async getSalesOrderClosingReport(req, res) {
        try {
            const {
            t_sales_order,
            t_sales_order_d,
            t_sales_order_closing,
            t_sales_order_closing_d,
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

            const { start_date, end_date } = req.query;

            const unit_bussiness_ids = toArray(req.query.unit_bussiness_ids);
            const customer_ids       = toArray(req.query.customer_ids);
            const customer_group_ids = toArray(req.query.customer_group_ids);
            const so_ids             = toArray(req.query.so_ids);
            const sales_ids          = toArray(req.query.sales_ids);
            const sales_area_ids     = toArray(req.query.sales_area_ids);
            const item_ids           = toArray(req.query.item_ids);
            const item_group_ids     = toArray(req.query.item_group_ids);
            const status             = toArray(req.query.status); // status closing (default 2 - approved)

            // --- Filter utama untuk SO (periode, company, customer, sales, dst.) ---
            const soWhere = {};
            if (unit_bussiness_ids?.length) soWhere.unit_bussiness_id = { [Op.in]: unit_bussiness_ids };
            if (customer_ids?.length)       soWhere.customer_id       = { [Op.in]: customer_ids };
            if (so_ids?.length)             soWhere.id               = { [Op.in]: so_ids };
            if (sales_ids?.length)          soWhere.sales_id         = { [Op.in]: sales_ids };
            if (start_date && end_date)     soWhere.date             = { [Op.between]: [start_date, end_date] };

            // Ambil SO sesuai filter (beserta detail & relasi yang dibutuhkan untuk tampilan)
            const salesOrders = await t_sales_order.findAll({
            where: soWhere,
            include: [
                { model: m_unit_bussiness, as: 'm_unit_bussiness', attributes: ['id','code','name'] },
                {
                model: m_customer,
                as: 'm_customer',
                attributes: ['id','code','name','group_id'],
                where: customer_group_ids?.length ? { group_id: { [Op.in]: customer_group_ids } } : undefined
                },
                { model: m_customer_d_address, as: 'm_customer_d_address', attributes: ['id','address'] },
                { model: m_gen, as: 'soTop', attributes: ['id','key1','value1'] },
                { model: m_gen, as: 'soPpn', attributes: ['id','key1','value1'] },
                {
                model: user,
                as: 'user_default',
                attributes: ['id','name'],
                include: [{
                    model: m_sales_area_d_sales,
                    as: 'm_sales_area_d_sale',
                    attributes: ['id','sales_id','sales_area_id'],
                    where: sales_area_ids?.length ? { sales_area_id: { [Op.in]: sales_area_ids } } : undefined,
                    include: [{ model: m_sales_area, as: 'm_sales_area', attributes: ['id','code'] }]
                }]
                },
                {
                model: t_sales_order_d,
                as: 't_sales_order_ds',
                include: [{
                    model: m_item,
                    as: 'm_item',
                    where: (item_ids?.length || item_group_ids?.length)
                    ? {
                        ...(item_ids?.length       && { id: { [Op.in]: item_ids } }),
                        ...(item_group_ids?.length && { item_group_id: { [Op.in]: item_group_ids } }),
                        }
                    : undefined,
                    required: !!(item_ids?.length || item_group_ids?.length),
                    attributes: ['id','code','name','item_group_id','actual_weight'],
                    include: [{ model: m_gen, as: 'itemGroup', attributes: ['id','group','value1'] }]
                }]
                },
                { model: user, as: 'tsocreatedBy', attributes: ['id','name'] }, // dipakai di kolom "Dibuat oleh" (seperti contohmu)
            ]
            });

            if (!salesOrders.length) {
            return res.json({ data: [], total: 0 });
            }

            // --- Siapkan data bantu secara massal untuk hindari N+1 ---

            // SO IDs
            const soIdList = salesOrders.map(so => so.id);

            // Closing per SO (default status 2 kalau tidak dikirim)
            const closingStatusList = status?.length ? status : [2];
            const closings = await t_sales_order_closing.findAll({
            where: { so_id: { [Op.in]: soIdList }, status: { [Op.in]: closingStatusList } },
            include: [{ model: m_gen, as: 'tsocReason', attributes: ['id','value1'] }],
            order: [['id','ASC']]
            });

            if (!closings.length) {
            // Tidak ada closing untuk SO-SO yang terpilih
            return res.json({ data: [], total: 0 });
            }

            // Group closing by so_id
            const closingsBySo = new Map();
            for (const c of closings) {
            const arr = closingsBySo.get(c.so_id) || [];
            arr.push(c);
            closingsBySo.set(c.so_id, arr);
            }

            // Closing detail untuk semua closing sekaligus
            const closingIds = closings.map(c => c.id);
            const closingDetails = await t_sales_order_closing_d.findAll({
            where: { so_closing_id: { [Op.in]: closingIds } },
            attributes: ['so_closing_id','item_id','qty_closing']
            });

            // Map: closingId -> Map(itemId -> qty_closing)
            const closedQtyByClosingId = new Map();
            for (const cd of closingDetails) {
            const map = closedQtyByClosingId.get(cd.so_closing_id) || new Map();
            map.set(cd.item_id, (map.get(cd.item_id) || 0) + (cd.qty_closing || 0));
            closedQtyByClosingId.set(cd.so_closing_id, map);
            }

            // Reservation per SO (lalu history untuk qty per item)
            const reservations = await t_reservation.findAll({
            where: { so_id: { [Op.in]: soIdList } },
            attributes: ['id','so_id']
            });

            const reservationBySo = new Map();
            for (const r of reservations) reservationBySo.set(r.so_id, r.id);

            const reservationIds = reservations.map(r => r.id);
            let histories = [];
            if (reservationIds.length) {
            histories = await t_reservation_history.findAll({
                where: { reservation_id: { [Op.in]: reservationIds } },
                attributes: ['reservation_id','item_id','qty_booking','qty_release']
            });
            }

            // Map: so_id -> Map(item_id -> net qty reservation)
            const reservedQtyBySoAndItem = new Map();
            for (const h of histories) {
            // temukan so_id dari reservation_id
            const soId = [...reservationBySo.entries()].find(([, rid]) => rid === h.reservation_id)?.[0];
            if (!soId) continue;
            const inner = reservedQtyBySoAndItem.get(soId) || new Map();
            const net = (inner.get(h.item_id) || 0) + (h.qty_booking || 0) - (h.qty_release || 0);
            inner.set(h.item_id, net);
            reservedQtyBySoAndItem.set(soId, inner);
            }

            // --- Bangun hasil: SATU BARIS PER CLOSING ---
            const result = [];

            for (const so of salesOrders) {
            const soJSON = so.toJSON();
            const thisClosings = closingsBySo.get(so.id) || [];
            if (!thisClosings.length) continue; // skip SO tanpa closing

            // Cache: qty reservation per item untuk SO ini
            const reserveMap = reservedQtyBySoAndItem.get(so.id) || new Map();

            // Peta detail SO: item_id -> detail (untuk ambil qty_snapshot & total_amt)
            const soDetailByItem = new Map();
            for (const d of soJSON.t_sales_order_ds) {
                soDetailByItem.set(d.item_id, d);
            }

            for (const soc of thisClosings) {
                let header_qty_so = 0;
                let header_qty_reservation = 0;
                let header_qty_closed = 0;

                const closedMap = closedQtyByClosingId.get(soc.id) || new Map();

                // Siapkan detail baru (biar tidak mengubah object asli)
                const newDetails = [];

                for (const detail of soJSON.t_sales_order_ds) {
                const itemId = detail.item_id;

                const qty_so = detail.qty_snapshot || 0;
                const qty_reservation = reserveMap.get(itemId) || 0;
                const qty_closed = closedMap.get(itemId) || 0;

                const unitPrice = qty_so ? ((detail.total_amt || 0) / qty_so) : 0;
                const total = unitPrice * qty_closed;

                // Akumulasi header
                header_qty_so += qty_so;
                header_qty_reservation += qty_reservation;
                header_qty_closed += qty_closed;

                // Dorong detail baris untuk closing ini
                newDetails.push({
                    ...detail,
                    qty_reservation,
                    qty_closed,
                    total, // nilai total untuk qty_closed (seperti contohmu)
                });
                }

                // Satu baris hasil = satu closing
                const row = {
                ...soJSON,
                // Override nilai yang spesifik per closing:
                qty_so: header_qty_so,
                qty_reservation: header_qty_reservation,
                qty_closed: header_qty_closed,
                reason_closing: soc?.tsocReason?.value1 || '-',
                // kalau perlu identitas closing:
                so_closing_id: soc.id,
                t_sales_order_ds: newDetails,
                };

                result.push(row);
            }
            }

            return res.json({ data: result, total: result.length });
        } catch (error) {
            console.error('Error in getSalesOrderClosingReport:', error);
            return res.status(500).json({ error: error.message });
        }
    }

};
