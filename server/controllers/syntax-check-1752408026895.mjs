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
                // Generate kode per surat jalan (per SO)
                const code = await getCodeStructure(t_surat_jalan, menuId, payload.unit_bussiness_id);

                // Buat header surat jalan
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

                // Siapkan data detail untuk bulkCreate
                const detailItems = (detail.items || []).map(item => ({
                    surat_jalan_id: suratJalan.id,
                    item_id: item.item_id,
                    qty: item.qty,
                    price: item.price,
                    amount: item.qty * item.price,
                    weight: item.weight
                }));

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
            console.error("Error create surat jalan:", err);
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
            return res.status(400).json({ error: 'sj_ids harus berupa array dan tidak boleh kosong.' });
        }

        try {
            // Update semua SJ yang sesuai menjadi status 2 (Posted)
            const [updatedCount] = await t_surat_jalan.update(
                { status: 2 },
                { where: { id: sj_ids } }
            );

            if (updatedCount === 0) {
                return res.status(404).json({ error: 'Tidak ada surat jalan yang ditemukan untuk di-post.' });
            }

            res.status(200).json({
                message: `Berhasil mem-post ${updatedCount} surat jalan.`,
                data: { posted_ids: sj_ids }
            });
        } catch (err) {
            console.error('Error saat posting surat jalan:', err);
            res.status(500).json({ error: err.message });
        }
    }

};
