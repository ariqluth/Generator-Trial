// Controller for t_purchase_order_revision
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_purchase_order_revision
//
// Tambahkan custom function di bawah ini

import { Op } from "sequelize";

export const t_purchase_order_revisionController = {
    // Contoh: Upload gambar ke database (kolom image: Buffer/BLOB)
    async uploadImage(req, res) {
        const imageFile = req.files?.find(f => f.mimetype.startsWith('image/'));
        if (!imageFile) return res.status(400).json({ error: 'No image file found' });
        try {
            const inserted = await req.models.t_purchase_order_revision.create({ image: imageFile.buffer });
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
            const inserted = await req.models.t_purchase_order_revision.bulkCreate(records);
            res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async generateCode(req, res) {
        const params = req.query;
        const code = await getCodeStructure(req.models.t_purchase_order_revision, params.menu_id, params.unit_bussiness_id)
        if (code.status === 'err') {
            res.json(errorResponse(code.error))
        }
        res.json(successResponse(code.data))
    },

    async customIndex(req, res) {
        const { t_purchase_order, t_purchase_order_revision, t_purchase_order_revision_approval, m_approval, m_approval_d } = req.models;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.paginate) || 10;
        const offset = (page - 1) * limit;

        let searchConditions = buildSearchQuery(req.query.search || null, req.query.searchfield || null);

        const where = {};

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
                model: t_purchase_order,
                as: 'poRevisiPurchaseOrder',
            },
        ];


        if (req.query.auth_user_id && req.query.menu_id) {
            // Cek role user
            const checkAprrovalRole = await m_approval_d.findOne({
                where: {
                    user_id: req.query.auth_user_id,
                    type: 'menyetujui'
                },
                include: [{
                    model: m_approval,
                    where: {
                        menu_id: req.query.menu_id
                    },
                    attributes: []
                }]
            });
            if (checkAprrovalRole) {
                include.push({
                    model: t_purchase_order_revision_approval,
                    as: 'prvApprovals',
                    attributes: ['id', 'user_id', 'status', 'full_approval'],
                    required: true,
                    where: {
                        user_id: req.query.auth_user_id,
                        is_active: true,
                    }
                });
            }
        }

        if (req.query.unit_bussiness_id) {
            where.unit_bussiness_id = {
                [Op.eq]: req.query.unit_bussiness_id
            };
        }
        if (req.query.status) {
            where.status = {
                [Op.eq]: req.query.status
            };
        }

        const { count, rows } = await t_purchase_order_revision.findAndCountAll({
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
};
