// Controller for m_interface_d
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.m_interface_d
//
// Tambahkan custom function di bawah ini
import m_interface from '../models/m_interface.js'
import m_interface_d from '../models/m_interface_d.js'
import m_unit_bussiness from '../models/m_unit_bussiness.js'
import m_gen from '../models/m_gen.js'
import m_coa from '../models/m_coa.js'
import { literal, Op, fn, col } from "sequelize";

export const m_interface_dController = {
    // Contoh: Upload gambar ke database (kolom image: Buffer/BLOB)
    async uploadImage(req, res) {
        const imageFile = req.files?.find(f => f.mimetype.startsWith('image/'));
        if (!imageFile) return res.status(400).json({ error: 'No image file found' });
        try {
        const inserted = await req.models.m_interface_d.create({ image: imageFile.buffer });
        res.json({ message: 'Image uploaded', data: inserted });
        } catch (err) {
        res.status(500).json({ error: err.message });
        }
    },

    async customKasBankInterface(req, res) {
        const { m_interface, m_interface_d, m_unit_bussiness, m_gen, m_coa } = req.models;

        try {
            const whereConditions = {};

            if (req.query.filter_var) {
                whereConditions['$interfaceVariable.value1$'] = req.query.filter_var;
            } else if (req.query.filter_vars) {
                const vars = req.query.filter_vars.split(',');
                whereConditions['$interfaceVariable.value1$'] = { [Op.in]: vars };
            } else {
                whereConditions['$interfaceVariable.value1$'] = { [Op.in]: ['var_Cash', 'var_BANK'] };
            }

            const rows = await m_interface.findAll({
                attributes: [
                    'id',
                    'unit_bussiness_id',
                    'variable_id',
                    'status',
                    'notes',
                    'createdAt',
                    'updatedAt',
                ],
                include: [
                    {
                        model: m_unit_bussiness,
                        attributes: ['name'],
                    },
                    {
                        model: m_gen,
                        as: 'interfaceVariable',
                        attributes: ['value1'],
                    },
                    {
                        model: m_interface_d,
                        as: 'm_interface_ds',
                        required: false,
                        where: { is_active: true },
                        attributes: [
                            'id',
                            'interface_id',
                            'coa_id',
                            'is_active',
                        ],
                        include: [
                            {
                                model: m_coa,
                                attributes: [
                                    'id',
                                    'name',
                                    'is_debit',
                                    'status',
                                    'division_id',
                                    'code',
                                    'description',
                                    'notes',
                                ],
                            },
                        ],
                    },
                ],
                where: whereConditions,
                order: [[col('interfaceVariable.value1'), 'ASC']],
            });

            const result = rows.map(row => ({
                id: row.id,
                unit_bussiness_name: row.m_unit_bussiness?.name || null,
                variable_name: row.interfaceVariable?.value1 || null,
                status: row.status,
                notes: row.notes,
                m_interface_ds: row.m_interface_ds.map(d => ({
                    id: d.id,
                    interface_id: d.interface_id,
                    coa_id: d.coa_id,
                    is_active: d.is_active,
                    m_coa: d.m_coa
                        ? {
                            id: d.m_coa.id,
                            name: d.m_coa.name,
                            is_debit: d.m_coa.is_debit,
                            status: d.m_coa.status,
                            division_id: d.m_coa.division_id,
                            code: d.m_coa.code,
                            description: d.m_coa.description,
                            notes: d.m_coa.notes,
                        }
                        : null,
                })),
            }));

            return res.json({
                status: 'success',
                data: result,
            });
        } catch (err) {
            return res.status(500).json({
                status: 'error',
                message: err.message || 'Internal server error',
            });
        }
    },

    // Contoh: Import Excel ke database
    async importExcel(req, res) {
        if (!req.excelData) return res.status(400).json({ error: 'No Excel data' });
        const [header, ...rows] = req.excelData;
        const records = rows.map(row => Object.fromEntries(header.map((h, i) => [h, row[i]])));
        try {
        const inserted = await req.models.m_interface_d.bulkCreate(records);
        res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
        res.status(500).json({ error: err.message });
        }
    },

    // Contoh: Custom function
    async customFunction(req, res) {
        res.json({ message: 'Custom function untuk m_interface_d', body: req.body, query: req.query });
    }
};
