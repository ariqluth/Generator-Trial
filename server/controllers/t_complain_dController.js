// Controller for t_complain
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_complain
//
// Tambahkan custom function di bawah ini

export const t_complainController = {
    // Contoh: Upload gambar ke database (kolom image: Buffer/BLOB)
    async uploadImage(req, res) {
        const imageFile = req.files?.find(f => f.mimetype.startsWith('image/'));
        if (!imageFile) return res.status(400).json({ error: 'No image file found' });
        try {
        const inserted = await req.models.t_complain.create({ image: imageFile.buffer });
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
        const inserted = await req.models.t_complain.bulkCreate(records);
        res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
        res.status(500).json({ error: err.message });
        }
    },

    async generateCode(req, res) {
        const params = req.query;
        const code = await getCodeStructure(req.models.t_complain, params.menu_id, params.unit_bussiness_id)
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
            t_complain,
            t_complain_approval
        } = req.models;

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        // const menu_id = '12dc5251-6aa7-4107-ae86-b94bd43cafa7';

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
            {
                model: m_customer,
                as: 'm_customer',
                attributes: ['id', 'code', 'name']
            },
            {
                model: m_unit_bussiness,
                as: 'm_unit_bussiness',
                attributes: ['id', 'name']
            },
            {
                model: t_sales_invoice,
                as: 't_sales_invoice',
                required: false,
                attributes: ['id', 'code']
            },
            {
                model: t_surat_jalan,
                as: 't_surat_jalan',
                required: false,
                attributes: ['id', 'code']
            },
            {
                model: t_complain_approval,
                as: 't_complain_approvals'
            }
        ];

        // Custom filter: filter_column_{alias}.{field}
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

        // Handle dynamic where
        where = await parseWhereQueryParam(req.query.where);

        const { count, rows } = await t_complain.findAndCountAll({
            include,
            where,
            order,
            limit,
            offset
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

    async getComplainById(req, res) {
        const id = req.query.id;
        const {
            t_complain,
            t_complain_d,
            t_complain_d_images,
            t_surat_jalan,
            t_sales_invoice,
            m_unit_bussiness,
            m_customer,
            user,
            m_item,
            m_gen
        } = req.models;

        if (!id) {
            return res.status(400).json({ message: "Missing ID." });
        }

        try {
            console.log("ID (typeof):", typeof id, id);
            const complain = await t_complain.findAll({
                // where: { id },
                // include: [
                    // m_unit_bussiness && {
                    //     model: m_unit_bussiness,
                    //     as: 'm_unit_bussiness'
                    // },
                    // m_customer && {
                    //     model: m_customer,
                    //     as: 'm_customer'
                    // },
                    // user && {
                    //     model: user,
                    //     as: 'user_default'
                    // },
                    // m_gen && {
                    //     model: m_gen,
                    //     as: 'complainType'
                    // },
                    // t_complain_d && {
                    //     model: t_complain_d,
                    //     as: 't_complain_ds',
                    //     include: [
                    //         t_complain_d_images && {
                    //             model: t_complain_d_images,
                    //             as: 't_complain_d_images'
                    //         },
                    //         m_gen && {
                    //             model: m_gen,
                    //             as: 'complainReason'
                    //         },
                    //         m_item && {
                    //             model: m_item,
                    //             as: 'm_item'
                    //         }
                    //     ].filter(Boolean) // <-- penting juga untuk nested include
                    // },
                    // t_surat_jalan && {
                    //     model: t_surat_jalan,
                    //     as: 't_surat_jalan',
                    //     required: false
                    // },
                    // t_sales_invoice && {
                    //     model: t_sales_invoice,
                    //     as: 't_sales_invoice',
                    //     required: false
                    // }
                // ].filter(Boolean) // <-- SOLUSI: filter include utama
            });

            if (!complain) {
                return res.status(404).json({ status: "error", message: "Complain tidak ditemukan" });
            }

            const data = complain.toJSON();

            // Flatten sales & complainType name if available
            data.sales = data.sales?.name || null;
            data.complain_type = data.complainType?.value1 || null;

            // Ensure compatibility if ref_type = si
            // if (data.ref_type === 'si') {
            //     delete data.t_surat_jalan;
            // } else {
            //     delete data.t_sales_invoice;
            // }

            return res.status(200).json({
                status: "success",
                data
            });

        } catch (error) {
            console.error("Error getComplainById:", error.message);
            return res.status(500).json({ status: "error", message: "Terjadi kesalahan saat mengambil data complain" });
        }
    },

    async createComplain(req, res) {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed.' });
        }

        const payload = req.body;
        const {
            t_complain,
            t_complain_d,
            t_complain_d_images
        } = req.models;

        const sequelize = t_complain.sequelize;
        const t = await sequelize.transaction();
        const menuId = '12dc5251-6aa7-4107-ae86-b94bd43cafa7';

        try {
            // Generate code complain jika diperlukan
            const code = await getCodeStructure(t_complain, menuId, payload.unit_bussiness_id);

            const complain = await t_complain.create({
                code: code.data,
                unit_bussiness_id: payload.unit_bussiness_id,
                customer_id: payload.customer_id,
                si_id: payload.si_id,
                sj_id: payload.sj_id,
                status: payload.status,
                date: payload.date,
                ref_type: payload.ref_type,
                unit_bussiness: payload.unit_bussiness,
                customer: payload.customer,
                sales: payload.sales,
                reason: payload.reason || null,
                complain_type_id: payload.complain_type_id,
                complain_type: payload.complain_type,
                sales_id: payload.sales_id
            }, { transaction: t });

            for (const detail of payload.t_complain_d || []) {
                if (detail.qty_si < detail.qty_return) {
                    await t.rollback();

                    const label = complain.ref_type === 'si' ? 'Sales Invoice' : 'Surat Jalan';
                    const msg = `Qty ${label} tidak boleh kurang dari Qty return`;

                    return res.status(400).json({ error: msg });
                }

                const complainD = await t_complain_d.create({
                    complain_id: complain.id,
                    item_id: detail.item_id,
                    item_name: detail.item_name,
                    qty_si: detail.qty_si,
                    qty_return: detail.qty_return,
                    uom_unit: detail.uom_unit,
                    reason_id: detail.reason_id
                }, { transaction: t });

                for (const image of detail.t_complain_d_images || []) {
                    await t_complain_d_images.create({
                        complain_d_id: complainD.id,
                        image_url: image.image_url
                    }, { transaction: t });
                }
            }

            // Commit jika semua berhasil
            await t.commit();

            res.status(201).json({
                message: 'Berhasil membuat data complain',
                data: { id: complain.id }
            });
        } catch (err) {
            // hindari rollback ganda
            if (!t.finished) {
                await t.rollback();
            }
            console.error('Error create complain:', err);
            res.status(500).json({ error: err.message });
        }
    },

    async updateComplain(req, res) {
        if (req.method !== 'PUT') {
            return res.status(405).json({ error: 'Method not allowed.' });
        }

        const { id } = req.query.id;
        const payload = req.body;
        const {
            t_complain,
            t_complain_d,
            t_complain_d_images
        } = req.models;

        const sequelize = t_complain.sequelize;
        const t = await sequelize.transaction();

        try {
            const existing = await t_complain.findByPk(id);
            if (!existing) {
                return res.status(404).json({ error: 'Complain tidak ditemukan' });
            }

            await t_complain.update({
                unit_bussiness_id: payload.unit_bussiness_id,
                customer_id: payload.customer_id,
                ref_id: payload.ref_id,
                status: payload.status,
                date: payload.date,
                notes: payload.notes,
                ref_type: payload.ref_type,
                unit_bussiness: payload.unit_bussiness,
                customer: payload.customer,
                sales: payload.sales,
                reason: payload.reason || null,
                complain_type_id: payload.complain_type_id,
                complain_type: payload.complain_type,
                sales_id: payload.sales_id
            }, { where: { id }, transaction: t });

            // Hapus detail dan images lama
            await t_complain_d_images.destroy({
                where: { complain_d_id: { [Op.in]: sequelize.literal(`(SELECT id FROM t_complain_ds WHERE complain_id = '${id}')`) } },
                transaction: t
            });

            await t_complain_d.destroy({
                where: { complain_id: id },
                transaction: t
            });

            // Tambahkan ulang detail dan gambar
            for (const detail of payload.t_complain_d || []) {
                if (detail.qty_si < detail.qty_return) {
                    await t.rollback();
                    const label = payload.ref_type === 'si' ? 'Sales Invoice' : 'Surat Jalan';
                    const msg = `Qty ${label} tidak boleh kurang dari Qty return`;
                    return res.status(400).json({ error: msg });
                }

                const complainD = await t_complain_d.create({
                    complain_id: id,
                    item_id: detail.item_id,
                    item_name: detail.item_name,
                    qty_si: detail.qty_si,
                    qty_return: detail.qty_return,
                    uom_unit: detail.uom_unit,
                    reason_id: detail.reason_id
                }, { transaction: t });

                for (const image of detail.t_complain_d_images || []) {
                    await t_complain_d_images.create({
                        complain_d_id: complainD.id,
                        image_url: image.image_url
                    }, { transaction: t });
                }
            }

            await t.commit();
            res.status(200).json({ message: 'Berhasil update complain', data: { id } });

        } catch (err) {
            if (!t.finished) await t.rollback();
            console.error('Error update complain:', err);
            res.status(500).json({ error: err.message });
        }
    }

};
