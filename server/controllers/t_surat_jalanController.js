// Controller for t_surat_jalan
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_surat_jalan
//
// Tambahkan custom function di bawah ini
import { fn, col, literal, Op } from "sequelize";

export const t_surat_jalanController = {
    // Contoh: Upload gambar ke database (kolom image: Buffer/BLOB)
    async uploadImage(req, res) {
        const imageFile = req.files?.find(f => f.mimetype.startsWith('image/'));
        if (!imageFile) return res.status(400).json({ error: 'No image file found' });
        try {
        const inserted = await req.models.t_surat_jalan.create({ image: imageFile.buffer });
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
        const inserted = await req.models.t_surat_jalan.bulkCreate(records);
        res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
        res.status(500).json({ error: err.message });
        }
    },

    async generateCode(req, res) {
        const params = req.query;
        const code = await getCodeStructure(req.models.t_surat_jalan, params.menu_id, params.unit_bussiness_id)
        if (code.status === 'err') {
            res.json(errorResponse(code.error))
        }
        res.json(successResponse(code.data))
    },

    async getSuratJalanByDeliveryPlanId(req, res) {
        if (req.method !== 'GET') {
            return res.status(405).json({ error: 'Method not allowed.' });
        }

        const { id } = req.query; // delivery_plan_id
        const {
            t_delivery_plan,
            t_surat_jalan,
            t_surat_jalan_d,
            t_sales_order,
            m_unit_bussiness,
            m_customer,
            m_vehicle,
            m_gen, // untuk expedition_type / top
            m_delivery_area,
            m_item
        } = req.models;

        try {
            const deliveryPlan = await t_delivery_plan.findByPk(id, {
                include: [
                    { model: m_vehicle, as: 'm_vehicle' },
                    { model: m_gen, as: 'tdpExpeditionType' }, // from delivery_plan.expedition_type_id
                    { model: m_delivery_area, as: 'm_delivery_area' },
                    { model: m_unit_bussiness, as: 'm_unit_bussiness' }
                ]
            });

            if (!deliveryPlan) {
                return res.status(404).json({ error: 'Delivery Plan tidak ditemukan' });
            }

            const suratJalanList = await t_surat_jalan.findAll({
                where: { delivery_plan_id: id },
                include: [
                    {
                        model: t_sales_order,
                        as: 't_sales_order',
                        attributes: ['id', 'code']
                    },
                    {
                        model: m_customer,
                        as: 'm_customer'
                    },
                    {
                        model: m_gen,
                        as: 'sjTop',
                        attributes: ['id', 'group', 'value1', 'value2', 'value3']
                    },
                    {
                        model: m_unit_bussiness,
                        as: 'm_unit_bussiness',
                        attributes: ['id', 'code', 'name']
                    },
                    {
                        model: t_surat_jalan_d,
                        as: 't_surat_jalan_ds',
                        include: [
                            {
                            model: m_item,
                            as: 'm_item'
                            }
                        ]
                    }
                ],
                order: [['createdAt', 'ASC']]
            });

            const response = {
                ...deliveryPlan.toJSON(),
                detail_surat_jalans: suratJalanList.map(sj => ({
                    id: sj.id,
                    code: sj.code,
                    date: sj.date,
                    status: sj.status,
                    unit_bussiness_id: sj.unit_bussiness_id,
                    print_count: sj.print_count,
                    customer_id: sj.customer_id,
                    top_id: sj.top_id,
                    ship_to: sj.ship_to,
                    npwp: sj.npwp,
                    so_id: sj.so_id,
                    createdAt: sj.createdAt,
                    updatedAt: sj.updatedAt,
                    m_unit_bussiness: sj.m_unit_bussiness,
                    m_customer: sj.m_customer,
                    sjTop: sj.sjTop,
                    t_sales_order: sj.t_sales_order,
                    t_surat_jalan_ds: sj.t_surat_jalan_ds
                }))
            };

            res.status(200).json(response);
        } catch (err) {
            console.error("Error getSuratJalanByDeliveryPlanId:", err);
            res.status(500).json({ error: err.message });
        }
    },

    async createSuratJalan(req, res) {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed.' });
        }

        const payload = req.body;
        const {
            t_surat_jalan,
            t_surat_jalan_d,
            t_delivery_plan
        } = req.models;

        const sequelize = t_surat_jalan.sequelize;
        const t = await sequelize.transaction();
        const menuId = 'b5d79799-51d1-4089-bc2e-71916b00200f';

        try {
            const createdSJ = [];

            for (const detail of payload.t_surat_jalan_d || []) {
                const code = await getCodeStructure(t_surat_jalan, menuId, payload.unit_bussiness_id);

                const suratJalan = await t_surat_jalan.create({
                    delivery_plan_id: payload.delivery_plan_id,
                    unit_bussiness_id: payload.unit_bussiness_id,
                    date: payload.date,
                    status: payload.status,
                    code: code.data,
                    customer_id: detail.customer_id,
                    top_id: detail.top_id,
                    ship_to: detail.ship_to,
                    npwp: detail.npwp,
                    so_id: detail.so_id
                }, { transaction: t });

                const detailItems = [];

                for (const item of detail.items || []) {
                    const itemExist = await req.models.m_item.findByPk(item.item_id, { transaction: t });
                    if (!itemExist) {
                        throw new Error(`Item tidak ditemukan`);
                    }

                    detailItems.push({
                        surat_jalan_id: suratJalan.id,
                        item_id: item.item_id,
                        qty: item.qty,
                        price: item.price,
                        amount: item.qty * item.price,
                        weight: item.weight
                    });
                }

                if (detailItems.length > 0) {
                    await t_surat_jalan_d.bulkCreate(detailItems, { transaction: t });
                }

                createdSJ.push({
                    id: suratJalan.id,
                    code: suratJalan.code,
                    so_id: detail.so_id
                });
            }

            // Update delivery plan hanya sekali setelah loop
            await t_delivery_plan.update(
                { sj_used: true },
                {
                    where: { id: payload.delivery_plan_id },
                    transaction: t
                }
            );

            await t.commit();

            res.status(201).json({
                message: "Berhasil simpan data surat jalan",
                data: createdSJ
            });
        } catch (err) {
            await t.rollback();
            res.status(500).json({ error: err.message });
        }
    },

    async postSuratJalan(req, res) {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed.' });
        }

        const { sj_ids } = req.body;
        const { t_surat_jalan } = req.models;

        if (!Array.isArray(sj_ids) || sj_ids.length === 0) {
            return res.status(400).json({ error: 'sj_ids harus berupa array dan tidak boleh kosong' });
        }

        const user = req.user;
        const sequelize = t_surat_jalan.sequelize;
        const t = await sequelize.transaction();

        try {

            const foundSJ = await t_surat_jalan.findAll({
                where: { id: sj_ids },
                transaction: t
            });

            if (foundSJ.length !== sj_ids.length) {
                await t.rollback();
                return res.status(404).json({ error: 'Surat jalan tidak ditemukan' });
            }

            // Ambil hanya yang status-nya belum dipost
            const idsToUpdate = foundSJ
                .filter(sj => sj.status !== 2)
                .map(sj => sj.id);

            if (idsToUpdate.length === 0) {
                await t.rollback();
                return res.status(400).json({ error: 'Semua surat jalan sudah dipost' });
            }

            await t_surat_jalan.update(
                { status: 2, updated_by: user.id }, // posted
                {
                    where: { id: idsToUpdate },
                    transaction: t
                }
            );

            await t.commit();

            res.status(200).json({
                message: `Berhasil mem-post ${idsToUpdate.length} surat jalan`,
                data: { posted_ids: idsToUpdate }
            });

        } catch (err) {
            await t.rollback();
            res.status(500).json({ error: err.message });
        }
    },

    async createSuratJalanv2(req, res) {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed.' });
        }

        const payload = req.body;
        const {
            m_warehouse,
            t_surat_jalan,
            t_surat_jalan_d,
            t_delivery_plan,
            m_item,
            // m_item_conversion
        } = req.models;

        const user = req.user;
        const sequelize = t_surat_jalan.sequelize;
        const t = await sequelize.transaction();
        const menuId = 'b5d79799-51d1-4089-bc2e-71916b00200f';

        try {
            const dp = await t_delivery_plan.findByPk(payload.delivery_plan_id, { transaction: t });
            if (!dp) {
                throw new Error(`Delivery plan tidak ditemukan`);
            }

            const createdSJ = [];

            const prefixCode = await getCodeStructure(t_surat_jalan, menuId, payload.unit_bussiness_id);
            const baseCode = prefixCode.data.replace(/\d{4}$/, '');
            let startIndex = await t_surat_jalan.count({
                where: { code: { [Op.like]: `${baseCode}%` } },
                transaction: t
            });

            let warehouse = null;
            if (payload.status === 2) {
                warehouse = await m_warehouse.findOne({
                    where: { unit_bussiness_id: payload.unit_bussiness_id },
                    transaction: t
                });
                if (!warehouse) {
                    throw new Error('Gudang tidak ditemukan');
                }
            }

            for (const detail of payload.t_surat_jalan_d || []) {
                startIndex++;
                const runningNumber = String(startIndex).padStart(4, '0');
                const finalCode = `${baseCode}${runningNumber}`;

                // Create Surat Jalan (header)
                const suratJalan = await t_surat_jalan.create({
                    delivery_plan_id: payload.delivery_plan_id,
                    unit_bussiness_id: payload.unit_bussiness_id,
                    date: payload.date,
                    status: payload.status,
                    code: finalCode,
                    customer_id: detail.customer_id,
                    top_id: detail.top_id,
                    ship_to: detail.ship_to,
                    npwp: detail.npwp,
                    so_id: detail.so_id,
                    delivery_area: payload.delivery_area,
                    unit_bussiness: payload.unit_bussiness,
                    vehicle: payload.vehicle,
                    nopol: payload.nopol,
                    expedition_type: payload.expedition_type,
                    created_by: user.id
                }, { transaction: t });

                // Kumpulan detail item untuk bulk insert
                const detailItems = [];
                let totalAmount = 0;

                for (const item of detail.items || []) {
                    const itemExist = await m_item.findByPk(item.item_id, { transaction: t });
                    if (!itemExist) {
                        throw new Error(`Item dengan ID ${item.item_id} tidak ditemukan`);
                    }

                    const amount = item.qty * item.price;

                    detailItems.push({
                        surat_jalan_id: suratJalan.id,
                        item_id: item.item_id,
                        qty: item.qty,
                        qty_snapshot: item.qty,
                        price: item.price,
                        amount,
                        weight: item.weight,
                        uom_id: item.uom_id,
                        uom_unit: item.uom_unit,
                        uom_value: item.uom_value,
                    });

                    if (payload.status === 2) {
                        const inventoryQty = item.qty * (item.uom_value ?? 1);
                        const resultCOGS = await inventoryService.getCOGS(item.item_id, warehouse.id);

                        // Insert ke inventory ledger
                        const invLedger = await inventoryService.insertStock({
                            item_id: item.item_id,
                            warehouse_id: warehouse.id,
                            quantity: inventoryQty,
                            transactionTypeName: "SALES_ISSUE",
                            unitCost: resultCOGS,
                            reference_id: suratJalan.id,
                            reference_source: 't_surat_jalan',
                            batchNumber: dp.code,
                            transaction: t,
                        });

                        totalAmount += item.price * inventoryQty;
                        // totalAmount += invLedger.cost * invLedger.quantity;
                    }
                }

                if (detailItems.length > 0) {
                    await t_surat_jalan_d.bulkCreate(detailItems, { transaction: t });
                }

                // Buat jurnal hanya kalau status = 2
                if (payload.status === 2) {
                    await accountingService.createJournal(
                        {
                            unit_bussiness_id: suratJalan.unit_bussiness_id,
                            reference_id: suratJalan.id,
                            reference_type: "SURAT_JALAN",
                            reference_no: suratJalan.code,
                            date: suratJalan.date,
                            entity_id: suratJalan.customer_id,
                            entity_type: "m_customer",
                            created_by: user.id,
                            details: [
                                {
                                    variable: "var_HPP",
                                    debit: totalAmount,
                                    credit: 0,
                                    notes: "Transaksi Surat Jalan",
                                },
                                {
                                    variable: "var_Persediaan",
                                    debit: 0,
                                    credit: totalAmount,
                                    notes: "Transaksi Surat Jalan",
                                },
                            ],
                        },
                        { transaction: t }
                    );
                }

                createdSJ.push({
                    id: suratJalan.id,
                    code: suratJalan.code,
                    so_id: detail.so_id
                });
            }

            await t_delivery_plan.update(
                { sj_used: true, updated_by: user.id },
                {
                    where: { id: payload.delivery_plan_id },
                    transaction: t
                }
            );

            await t.commit();

            res.status(201).json({
                message: "Berhasil simpan data surat jalan",
                data: createdSJ
            });
        } catch (err) {
            await t.rollback();
            res.status(500).json({ error: err.message });
        }
    },

    async getSuratJalanById(req, res) {
        const { id } = req.query;

        const {
            t_surat_jalan,
            t_surat_jalan_d,
            t_surat_jalan_return,
            t_surat_jalan_return_d,
            m_unit_bussiness,
            m_customer,
            t_delivery_plan
        } = req.models;

        try {
            const suratJalan = await t_surat_jalan.findOne({
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
                        model: t_surat_jalan_d,
                        as: 't_surat_jalan_ds',
                        include: [
                            {
                                model: req.models.m_item,
                                as: 'm_item'
                            }
                        ]
                    },
                    {
                        model: t_delivery_plan,
                        as: 't_delivery_plan'
                    }
                ]
            });

            if (!suratJalan) {
                return res.status(404).json({ status: 'error', message: 'Surat jalan tidak ditemukan' });
            }

            // Cek apakah ada surat jalan return dengan status Posted
            const sjReturn = await t_surat_jalan_return.findOne({
                where: {
                    sj_id: suratJalan.id,
                    status: 2,
                }
            });

            // Jika ada, ambil semua detail return dan mapping by item_id
            if (sjReturn) {
                const sjReturnDetails = await t_surat_jalan_return_d.findAll({
                    where: {
                        surat_jalan_return_id: sjReturn.id
                    }
                });

                // Buat map item_id => qty_return
                const returnMap = {};
                for (const ret of sjReturnDetails) {
                    returnMap[ret.item_id] = ret.qty_return;
                }

                // Tambahkan qty_return ke setiap detail surat jalan
                for (const detail of suratJalan.t_surat_jalan_ds) {
                    detail.dataValues.qty_return = returnMap[detail.item_id] || 0;
                }
            } else {
                // Jika tidak ada return, set qty_return = 0
                for (const detail of suratJalan.t_surat_jalan_ds) {
                    detail.dataValues.qty_return = 0;
                }
            }

            return res.status(200).json({
                status: 'success',
                data: suratJalan
            });

        } catch (error) {
            return res.status(500).json({ status: 'error', message: 'Gagal mengambil data surat jalan' });
        }
    },

    async printSJ(req, res) {
        const { id } = req.query;
        if (!id) {
            return res.status(400).json({ status: 'error', message: 'ID wajib diisi!' });
        }

        const {
            t_surat_jalan,
            t_surat_jalan_d,
            t_surat_jalan_return,
            t_surat_jalan_return_d,
            m_unit_bussiness,
            m_customer,
            t_delivery_plan,
            t_delivery_plan_d,
            t_sales_order,
            m_item,
        } = req.models;

        try {
            const suratJalan = await t_surat_jalan.findOne({
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
                        model: t_surat_jalan_d,
                        as: 't_surat_jalan_ds',
                        include: [
                            {
                                model: m_item,
                                as: 'm_item'
                            }
                        ]
                    },
                    {
                        model: t_delivery_plan,
                        as: 't_delivery_plan',
                        include: [
                            {
                                model: t_delivery_plan_d,
                                as: 't_delivery_plan_ds'
                            }
                        ]
                    },
                    {
                        model: t_sales_order,
                        as: 't_sales_order'
                    }
                ]
            });

            if (!suratJalan) {
                return res.status(404).json({ status: 'error', message: 'Surat jalan tidak ditemukan' });
            }

            // Cek apakah ada surat jalan return dengan status Posted
            const sjReturn = await t_surat_jalan_return.findOne({
                where: {
                    sj_id: suratJalan.id,
                    status: 2,
                }
            });

            let returnMap = {};
            if (sjReturn) {
                const sjReturnDetails = await t_surat_jalan_return_d.findAll({
                    where: {
                        surat_jalan_return_id: sjReturn.id
                    }
                });
                for (const ret of sjReturnDetails) {
                    returnMap[ret.item_id] = ret.qty_return;
                }
            }

            // Tambahkan qty_return ke setiap detail surat jalan
            for (const detail of suratJalan.t_surat_jalan_ds) {
                detail.dataValues.qty_return = returnMap[detail.item_id] || 0;
            }

            // Ambil ship_to_name dan ship_to_address dari t_delivery_plan_d
            let shipToName = null;
            let shipToAddress = null;
            if (suratJalan.t_delivery_plan?.t_delivery_plan_ds?.length) {
                const firstPlanD = suratJalan.t_delivery_plan.t_delivery_plan_ds[0];
                shipToName = firstPlanD.ship_to_name;
                shipToAddress = firstPlanD.ship_to_address;
            }
            
            // Buat response sesuai kebutuhan
            const response = {
                ship_to_name: shipToName,
                ship_to_address: shipToAddress,
                notes: suratJalan.notes,
                delivery_date: suratJalan.date,
                delivery_number: suratJalan.code,
                div_plan_number: suratJalan.t_delivery_plan?.code || null,
                no_po_customer: suratJalan.t_sales_order?.no_po_customer || null,
                so_code: suratJalan.t_sales_order?.code || null,
                so_po: suratJalan.t_sales_order?.no_po_customer || null,
                delivery_code: [
                    suratJalan.t_delivery_plan?.driver || "DRIVER",
                    suratJalan.t_delivery_plan?.nopol || 0,
                    suratJalan.t_delivery_plan?.weight || 0
                ].filter(Boolean).join(" / "),
                t_surat_jalan_ds: suratJalan.t_surat_jalan_ds,
                bil_to: shipToName,
                so_notes: '-'
            };

            return res.status(200).json({
                status: 'success',
                data: response
            });

        } catch (error) {
            console.error(error);
            return res.status(500).json({ status: 'error', message: 'Gagal mengambil data surat jalan' });
        }
    },

    async incrementPrintCount(req, res) {
        const { id } = req.query;

        const { t_surat_jalan } = req.models;

        try {
            // Cari surat jalan dulu
            const suratJalan = await t_surat_jalan.findOne({ where: { id } });

            if (!suratJalan) {
                return res.status(404).json({ status: 'error', message: 'Surat jalan tidak ditemukan' });
            }

            // Increment print_count
            suratJalan.print_count = (suratJalan.print_count || 0) + 1;

            // Simpan perubahan
            await suratJalan.save();

            return res.status(200).json({
                status: 'success',
                message: 'Print count berhasil diupdate',
            });

        } catch (error) {
            console.error(error);
            return res.status(500).json({ status: 'error', message: 'Gagal mengupdate print count' });
        }
    }

};
