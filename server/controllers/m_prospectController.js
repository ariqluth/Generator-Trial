// Controller for m_prospect
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.m_prospect
//
// Tambahkan custom function di bawah ini
import { fn, col, literal, Op } from "sequelize";

export const m_prospectController = {
    // Contoh: Upload gambar ke database (kolom image: Buffer/BLOB)
    async uploadImage(req, res) {
        const imageFile = req.files?.find(f => f.mimetype.startsWith('image/'));
        if (!imageFile) return res.status(400).json({ error: 'No image file found' });
        try {
        const inserted = await req.models.m_prospect.create({ image: imageFile.buffer });
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
        const inserted = await req.models.m_prospect.bulkCreate(records);
        res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
        res.status(500).json({ error: err.message });
        }
    },

    async generateCode(req, res) {
        const params = req.query;
        const code = await getCodeStructure(req.models.m_prospect, params.menu_id, params.unit_bussiness_id)
        if (code.status === 'err') {
            res.json(errorResponse(code.error))
        }
        res.json(successResponse(code.data))
    },

    async customIndex(req, res) {
        const { m_gen, m_sales_area, m_unit_bussiness, m_prospect, m_prospect_approval, m_approval, m_approval_d, user } = req.models;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const menu_id = '70c82851-c1f8-4130-8def-9d1e84fb26e7';

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
            m_sales_area && {
                model: m_sales_area,
                as: 'm_sales_area',
                attributes: ['id', 'code', 'description']
            },
            user && {
                model: user,
                as: 'user_default',
                attributes: ['id', 'name']
            },
            m_unit_bussiness && {
                model: m_unit_bussiness,
                as: 'm_unit_bussiness',
                attributes: ['id', 'name']
            },
            m_prospect_approval && {
                model: m_prospect_approval,
                as: 'm_prospect_approvals'
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
                    model: m_prospect_approval,
                    as: 'm_prospect_approvals',
                    attributes: [],
                    required: true,
                    where: {
                        user_id: req.query.auth_user_id
                    }
                });
            }
        }

        where = await parseWhereQueryParam(req.query.where);

        const { count, rows } = await m_prospect.findAndCountAll({
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
    }
};
