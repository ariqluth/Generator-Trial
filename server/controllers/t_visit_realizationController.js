// Controller for t_visit_realization
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_visit_realization
//
// Tambahkan custom function di bawah ini

import { fn, col, literal, Op } from "sequelize";

export const t_visit_realizationController = {
    // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
    async uploadImage(req, res) {
        const fileFields = Object.keys(req.models.t_visit_realization.rawAttributes).filter(
        key => req.models.t_visit_realization.rawAttributes[key].type && req.models.t_visit_realization.rawAttributes[key].type.key === 'STRING'
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
        const inserted = await req.models.t_visit_realization.create(data);
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
        const inserted = await req.models.t_visit_realization.bulkCreate(records);
        res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
        res.status(500).json({ error: err.message });
        }
    },

    async getListVisitRealization(req, res) {
        const { unit_bussiness_id, sales_id, start_date, end_date, limit = 10, page = 1 } = req.query;
        const { t_visit_realization, t_sales_order, m_unit_bussiness, m_customer, user } = req.models;

        try {
            const whereClause = {};
            if (unit_bussiness_id) whereClause.unit_bussiness_id = unit_bussiness_id;
            if (sales_id) whereClause.sales_id = sales_id;
            if (start_date && end_date) {
                whereClause[Op.or] = [
                    { visit_date: { [Op.between]: [start_date, end_date] } },
                    { plan_date: { [Op.between]: [start_date, end_date] } }
                ];
            }

            const offset = (parseInt(page) - 1) * parseInt(limit);

            const result = await t_visit_realization.findAndCountAll({
                where: whereClause,
                include: [
                    {
                        model: m_unit_bussiness,
                        as: 'm_unit_bussiness',
                        attributes: ['id', 'name']
                    },
                    {
                        model: m_customer,
                        as: 'm_customer',
                        attributes: ['id', 'name']
                    },
                    {
                        model: t_sales_order,
                        as: 't_sales_order',
                        attributes: ['id', 'code']
                    },
                    {
                        model: user,
                        as: 'user_default',
                        attributes: ['id', 'name']
                    },
                    {
                        model: user,
                        as: 'tvrCreatedBy',
                        attributes: ['id', 'name']
                    },
                    {
                        model: user,
                        as: 'tvrUpdatedBy',
                        attributes: ['id', 'name']
                    },
                ],
                order: [['visit_date', 'DESC']],
                limit: parseInt(limit),
                offset
            });

            res.status(200).json({
                message: 'Berhasil',
                data: result.rows,
                total: result.count,
                page: parseInt(page),
                totalPages: Math.ceil(result.count / limit),
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async createVisitRealization(req, res) {
        if (req.method !== "POST") {
            return res.status(400).json({ message: "Method not allowed." });
        }

        const payload = req.body;

        const { t_visit_realization } = req.models;
        const user = req.user;

        try {
            // Hitung duration
            let duration = null;

            if (payload.start_at && payload.end_at) {
                const startTime = new Date(`1970-01-01T${payload.start_at}Z`);
                const endTime = new Date(`1970-01-01T${payload.end_at}Z`);
                const diffMs = endTime - startTime;

                if (diffMs < 0) {
                    return res.status(400).json({ message: "end_at tidak boleh lebih awal dari start_at" });
                }

                const totalSeconds = Math.floor(diffMs / 1000);
                const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
                const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
                const seconds = String(totalSeconds % 60).padStart(2, "0");
                duration = `${hours}:${minutes}:${seconds}`;
            }

            // Insert ke DB
            const newVisit = await t_visit_realization.create({
                unit_bussiness_id: payload.unit_bussiness_id,
                customer_id: payload.customer_id,
                plan_date: payload.plan_date || null,
                visit_date: payload.visit_date || null,
                start_at: payload.start_at || null,
                end_at: payload.end_at || null,
                duration,
                ref_no: payload.ref_no,
                status: payload.status,
                unit_bussiness: payload.unit_bussiness,
                customer_name: payload.customer_name,
                notes: payload.notes,
                created_by: user.id
            });

            return res.status(201).json({
                message: "Visit Realization berhasil dibuat",
                data: newVisit
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({
                message: "Terjadi kesalahan saat membuat Visit Realization",
                error: error.message
            });
        }
    },

    async updateVisitRealization(req, res) {
        if (req.method !== "PUT") {
            return res.status(400).json({ message: "Method not allowed." });
        }

        const payload = req.body;
        const { id } = req.query; // Ambil ID dari query param

        const { t_visit_realization } = req.models;
        const user = req.user;

        try {
            if (!id) {
                return res.status(400).json({ message: "Id wajib diisi" });
            }

            // Cari data existing
            const existingVisit = await t_visit_realization.findByPk(id);
            if (!existingVisit) {
                return res.status(404).json({ message: "Visit Realization tidak ditemukan" });
            }

            // Hitung duration
            const startTime = new Date(`1970-01-01T${payload.start_at}Z`);
            const endTime = new Date(`1970-01-01T${payload.end_at}Z`);
            const diffMs = endTime - startTime;

            if (diffMs < 0) {
                return res.status(400).json({ message: "end_at tidak boleh lebih awal dari start_at" });
            }

            const totalSeconds = Math.floor(diffMs / 1000);
            const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
            const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
            const seconds = String(totalSeconds % 60).padStart(2, "0");
            const duration = `${hours}:${minutes}:${seconds}`;

            // Update data
            await existingVisit.update({
                unit_bussiness_id: payload.unit_bussiness_id,
                customer_id: payload.customer_id,
                plan_date: payload.plan_date,
                visit_date: payload.visit_date,
                start_at: payload.start_at,
                end_at: payload.end_at,
                duration,
                ref_no: payload.ref_no,
                status: payload.status,
                unit_bussiness: payload.unit_bussiness,
                customer_name: payload.customer_name,
                notes: payload.notes,
                updated_by: user.id
            });

            return res.status(200).json({
                message: "Visit Realization berhasil diupdate",
                data: existingVisit
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({
                message: "Terjadi kesalahan saat mengupdate Visit Realization",
                error: error.message
            });
        }
    },

    // Laporan Kunjungan Sales
    async getVisitRealizationReport(req, res) {
        try {
            const {
                t_visit_realization,
                t_sales_order,
                t_sales_invoice,
                m_unit_bussiness,
                m_customer,
                user,
                m_sales_area,
                m_sales_area_d_sales
            } = req.models;

            const {
                start_date,
                end_date,
            } = req.query;

            const unit_bussiness_ids = toArray(req.query.unit_bussiness_ids);
            const customer_ids = toArray(req.query.customer_ids);
            const sales_ids = toArray(req.query.sales_ids);
            const sales_area_ids = toArray(req.query.sales_area_ids);
            const status = toArray(req.query.status);

            const whereClause = {};
            if (unit_bussiness_ids?.length) {
            whereClause.unit_bussiness_id = { [Op.in]: unit_bussiness_ids };
            }
            if (customer_ids?.length) {
            whereClause.customer_id = { [Op.in]: customer_ids };
            }
            if (sales_ids?.length) {
            whereClause.sales_id = { [Op.in]: sales_ids };
            }
            if (status?.length) {
            whereClause.status = { [Op.in]: status };
            }
            if (start_date && end_date) {
            whereClause.visit_date = { [Op.between]: [start_date, end_date] };
            }

            // ambil data visit
            const visits = await t_visit_realization.findAll({
                where: whereClause,
                include: [
                    { model: m_unit_bussiness, as: 'm_unit_bussiness', attributes: ['id', 'code', 'name'] },
                    { model: m_customer, as: 'm_customer', attributes: ['id', 'code', 'name'] },
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
                ]
            });

            const grouped = {};

            for (const visit of visits) {
                const salesId = visit.sales_id;
                if (!grouped[salesId]) {
                    grouped[salesId] = {
                    unit_bussiness: visit.m_unit_bussiness,
                    sales: visit.user_default,
                    total_visit: 0,
                    total_so: 0,
                    total_si: 0,
                    grand_total: 0,
                    details: []
                    };
                }

                grouped[salesId].total_visit += 1;

                let soCount = 0;
                let soGrandTotal = 0;
                let invoices = [];

                if (visit.so_id) {
                    const salesOrders = await t_sales_order.findAll({
                    where: { id: visit.so_id },
                    include: [{ model: m_customer, as: 'm_customer', attributes: ['id', 'code', 'name'] }]
                    });

                    soCount = salesOrders.length;
                    soGrandTotal = salesOrders.reduce((sum, so) => sum + (so.grand_total || 0), 0);

                    invoices = await t_sales_invoice.findAll({
                    where: { so_id: { [Op.in]: salesOrders.map(s => s.id) } }
                    });
                }

                grouped[salesId].total_so += soCount;
                grouped[salesId].grand_total += soGrandTotal;
                grouped[salesId].total_si += invoices.length;

                grouped[salesId].details.push({
                    ...visit.toJSON(),
                    customer: visit.m_customer,
                    total_so: soCount,
                    grand_total: soGrandTotal
                });
            }

            const result = Object.values(grouped);

            return res.json({
                data: result,
                total: result.length
            });

        } catch (error) {
            console.error('Error in getVisitRealizationReport:', error);
            return res.status(500).json({ error: error.message });
        }
    }

};
