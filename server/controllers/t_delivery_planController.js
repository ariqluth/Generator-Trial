// Controller for t_delivery_plan
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_delivery_plan
//
// Tambahkan custom function di bawah ini
import { fn, col, literal, Op } from "sequelize";

export const t_delivery_planController = {
    // Contoh: Upload gambar ke database (kolom image: Buffer/BLOB)
    async uploadImage(req, res) {
        const imageFile = req.files?.find(f => f.mimetype.startsWith('image/'));
        if (!imageFile) return res.status(400).json({ error: 'No image file found' });
        try {
            const inserted = await req.models.t_delivery_plan.create({ image: imageFile.buffer });
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
            const inserted = await req.models.t_delivery_plan.bulkCreate(records);
            res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async generateCode(req, res) {
        const params = req.query;
        const code = await getCodeStructure(req.models.t_delivery_plan, params.menu_id, params.unit_bussiness_id);
        if (code.status === 'err') {
            res.json(errorResponse(code.error))
        }
        res.json(successResponse(code.data))
    },

    async customIndex(req, res) {
        const { m_gen, m_delivery_area, m_vehicle, m_unit_bussiness, t_delivery_plan, t_delivery_plan_approval, m_approval, m_approval_d } = req.models;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const menu_id = 'bd51df02-dcaa-49ed-b415-b8dbf26d17ab';

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
            m_delivery_area && {
                model: m_delivery_area,
                as: 'm_delivery_area',
                attributes: ['id', 'code', 'description']
            },
            m_vehicle && {
                model: m_vehicle,
                as: 'm_vehicle',
                attributes: ['id', 'code', 'name', 'nopol']
            },
            m_unit_bussiness && {
                model: m_unit_bussiness,
                as: 'm_unit_bussiness',
                attributes: ['id', 'name']
            },
            m_gen && {
                model: m_gen,
                as: 'tdpExpeditionType',
                attributes: ['id', 'group', 'key1', 'value1', 'value2', 'value3']
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
                    model: t_delivery_plan_approval,
                    as: 't_delivery_plan_approvals',
                    attributes: [],
                    required: true,
                    where: {
                        user_id: req.query.auth_user_id
                    }
                });
            }
        }

        where = await parseWhereQueryParam(req.query.where);

        const { count, rows } = await t_delivery_plan.findAndCountAll({
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

    async createDeliveryPlan(req, res) {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed.' });
        }

        const payload = req.body;
        const {
            t_delivery_plan,
            t_delivery_plan_d,
            t_delivery_plan_d_item,
            m_item,
            t_sales_order,
        } = req.models;
        const user = req.user;

        const sequelize = t_delivery_plan.sequelize;
        const menuId = 'bd51df02-dcaa-49ed-b415-b8dbf26d17ab';
        const t = await sequelize.transaction();

        try {
            const code = await getCodeStructure(t_delivery_plan, menuId, payload.unit_bussiness_id);

            let totalAmount = 0;
            let totalWeight = 0;

            const planDList = []; // akan diisi untuk create t_delivery_plan_d
            const planDItemMap = {}; // key = index dari planDList, value = array of item

            // Proses semua t_delivery_plan_d
            for (const [index, dpd] of (payload.t_delivery_plan_d || []).entries()) {
                const items = dpd.t_delivery_plan_d_item || [];

                let detailTotalAmount = 0;
                let detailTotalWeight = 0;

                const itemDetails = [];

                for (const item of items) {
                    const itemData = await m_item.findByPk(item.item_id, { transaction: t });
                    if (!itemData) throw new Error(`Item tidak ditemukan`);

                    const amount = item.qty_dp * item.price;
                    const weight = item.weight || 0;

                    detailTotalAmount += amount;
                    detailTotalWeight += weight;

                    itemDetails.push({
                        item_id: item.item_id,
                        qty_so: item.qty_so,
                        qty_dp: item.qty_dp,
                        uom_id: item.uom_id,
                        uom_unit: item.uom_unit,
                        uom_value: item.uom_value,
                        price: item.price,
                        weight: item.weight,
                        amount: amount,
                        item_name: item.item_name,
                        alias: item.alias,
                        qty_so_snapshot: item.qty_so_snapshot
                    });
                }

                // Validasi sales order
                const orderExist = await t_sales_order.findByPk(dpd.so_id, { transaction: t });
                if (!orderExist) throw new Error(`Sales order tidak ditemukan`);

                planDList.push({
                    delivery_plan_id: null, // diisi setelah header disimpan
                    so_id: dpd.so_id,
                    customer_id: dpd.customer_id,
                    customer_name: dpd.customer_name,
                    ship_to_name: dpd.ship_to_name,
                    ship_to_address: dpd.ship_to_address,
                    npwp: dpd.npwp,
                    total_amount: detailTotalAmount,
                    total_weight: detailTotalWeight,
                    item_qty: itemDetails.length,
                });

                planDItemMap[index] = itemDetails;

                totalAmount += detailTotalAmount;
                totalWeight += detailTotalWeight;
            }

            // Simpan ke t_delivery_plan
            const deliveryPlan = await t_delivery_plan.create({
                unit_bussiness_id: payload.unit_bussiness_id,
                code: code.data,
                delivery_area_id: payload.delivery_area_id,
                expedition_type_id: payload.expedition_type_id,
                expedition_id: payload.expedition_id,
                vehicle_id: payload.vehicle_id,
                driver: payload.driver,
                nopol: payload.nopol,
                date: payload.date,
                notes: payload.notes,
                total: totalAmount,
                weight: totalWeight,
                created_by: user.id,
                // created_by: "06da1eab-b88d-4ff2-b264-c792ab386684",
            }, { transaction: t });

            // Simpan semua t_delivery_plan_d dan mapping ID-nya
            for (const [index, dpd] of planDList.entries()) {
                dpd.delivery_plan_id = deliveryPlan.id;

                const deliveryPlanD = await t_delivery_plan_d.create(dpd, { transaction: t });

                // Simpan t_delivery_plan_d_item untuk dpd ini
                const itemList = (planDItemMap[index] || []).map(item => ({
                    ...item,
                    delivery_plan_d_id: deliveryPlanD.id
                }));

                if (itemList.length > 0) {
                    await t_delivery_plan_d_item.bulkCreate(itemList, { transaction: t });
                }
            }

            await t.commit();
            res.status(201).json({ message: "Delivery plan berhasil disimpan", data: deliveryPlan });

        } catch (err) {
            await t.rollback();
            res.status(500).json({ error: err.message });
        }
    },

    async updateDeliveryPlan(req, res) {
        if (req.method !== 'PUT') {
            return res.status(405).json({ error: 'Method not allowed.' });
        }

        const { id } = req.query;
        if (!id) {
            return res.status(400).json({ error: 'ID tidak ditemukan' });
        }
        const user = req.user;

        // const id = req.query.id;
        const payload = req.body;
        const {
            t_delivery_plan,
            t_delivery_plan_d,
            t_delivery_plan_d_item,
            m_item,
            t_sales_order,
        } = req.models;

        const sequelize = t_delivery_plan.sequelize;
        const t = await sequelize.transaction();

        try {
            // Cari delivery plan header
            const deliveryPlan = await t_delivery_plan.findByPk(id, { transaction: t });
            if (!deliveryPlan) {
                await t.rollback();
                return res.status(404).json({ error: 'Delivery plan tidak ditemukan' });
            }

            let totalAmount = 0;
            let totalWeight = 0;

            const planDList = [];
            const planDItemMap = {};

            // Proses dan validasi data detail baru
            for (const [index, dpd] of (payload.t_delivery_plan_d || []).entries()) {
                const items = dpd.t_delivery_plan_d_item || [];

                let detailTotalAmount = 0;
                let detailTotalWeight = 0;

                const itemDetails = [];

                for (const item of items) {
                    const itemData = await m_item.findByPk(item.item_id, { transaction: t });
                    if (!itemData) throw new Error(`Item tidak ditemukan`);

                    const amount = item.qty_dp * item.price;
                    const weight = item.weight || 0;

                    detailTotalAmount += amount;
                    detailTotalWeight += weight;

                    itemDetails.push({
                        item_id: item.item_id,
                        qty_so: item.qty_so,
                        qty_dp: item.qty_dp,
                        uom_id: item.uom_id,
                        uom_unit: item.uom_unit,
                        uom_value: item.uom_value,
                        price: item.price,
                        weight: item.weight,
                        amount: amount,
                        item_name: item.item_name,
                        alias: item.alias,
                        // qty_so_snapshot: item.qty_so_snapshot
                    });
                }

                // Validasi sales order
                const orderExist = await t_sales_order.findByPk(dpd.so_id, { transaction: t });
                if (!orderExist) throw new Error(`Sales order tidak ditemukan`);

                planDList.push({
                    delivery_plan_id: deliveryPlan.id,
                    so_id: dpd.so_id,
                    customer_id: dpd.customer_id,
                    customer_name: dpd.customer_name,
                    ship_to_name: dpd.ship_to_name,
                    ship_to_address: dpd.ship_to_address,
                    npwp: dpd.npwp,
                    total_amount: detailTotalAmount,
                    total_weight: detailTotalWeight,
                    item_qty: itemDetails.length
                });

                planDItemMap[index] = itemDetails;

                totalAmount += detailTotalAmount;
                totalWeight += detailTotalWeight;
            }

            // Update header
            await deliveryPlan.update({
                unit_bussiness_id: payload.unit_bussiness_id,
                delivery_area_id: payload.delivery_area_id,
                expedition_type_id: payload.expedition_type_id,
                expedition_id: payload.expedition_id,
                vehicle_id: payload.vehicle_id,
                driver: payload.driver,
                date: payload.date,
                notes: payload.notes,
                total: totalAmount,
                weight: totalWeight,
                updated_by: user.id,
                // updated_by: "06da1eab-b88d-4ff2-b264-c792ab386684",
            }, { transaction: t });

            // Hapus semua detail & detail item lama
            const oldDetails = await t_delivery_plan_d.findAll({
                where: { delivery_plan_id: deliveryPlan.id },
                transaction: t
            });

            const oldDetailIds = oldDetails.map(d => d.id);
            if (oldDetailIds.length > 0) {
                await t_delivery_plan_d_item.destroy({
                    where: { delivery_plan_d_id: oldDetailIds },
                    transaction: t
                });

                await t_delivery_plan_d.destroy({
                    where: { id: oldDetailIds },
                    transaction: t
                });
            }

            const stillExist = await t_delivery_plan_d.findOne({
                where: { delivery_plan_id: deliveryPlan.id },
                transaction: t
            });

            if (stillExist) {
                await t.rollback();
                return res.status(400).json({ error: 'Gagal melakukan update data.' });
            }

            // Simpan ulang detail baru
            for (const [index, dpd] of planDList.entries()) {
                const deliveryPlanD = await t_delivery_plan_d.create(dpd, { transaction: t });

                const itemList = (planDItemMap[index] || []).map(item => ({
                    ...item,
                    delivery_plan_d_id: deliveryPlanD.id
                }));

                if (itemList.length > 0) {
                    await t_delivery_plan_d_item.bulkCreate(itemList, { transaction: t });
                }
            }

            await t.commit();
            res.status(200).json({ message: "Delivery plan berhasil diperbarui", data: deliveryPlan });

        } catch (err) {
            await t.rollback();
            res.status(500).json({ error: err.message });
        }
    }

};
