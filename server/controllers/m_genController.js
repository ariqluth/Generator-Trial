// Controller for m_gen
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.m_gen
//
// Tambahkan custom function di bawah ini

import { Op } from 'sequelize';

export const m_genController = {
    // Contoh: Upload gambar ke database (kolom image: Buffer/BLOB)
    async uploadImage(req, res) {
        const imageFile = req.files?.find(f => f.mimetype.startsWith('image/'));
        if (!imageFile) return res.status(400).json({ error: 'No image file found' });
        try {
            const inserted = await req.models.m_gen.create({ image: imageFile.buffer });
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
            const inserted = await req.models.m_gen.bulkCreate(records);
            res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async cityWithDistricts(req, res) {
        const models = req.models;
        const { city_name, district_name } = req.query;

        const districtWhere = { group: 'm_district' };
        if (district_name) {
            districtWhere.value1 = { [Op.iLike]: `%${district_name}%` };
        }

        const districts = await models.m_gen.findAll({
            where: districtWhere,
            attributes: ['id', 'value1', 'key1']
        });

        const groupedDistricts = districts.reduce((acc, dist) => {
            if (!acc[dist.key1]) acc[dist.key1] = [];
            acc[dist.key1].push({
                id: dist.id,
                name: dist.value1
            });
            return acc;
        }, {});

        const cityIds = Object.keys(groupedDistricts);
        if (cityIds.length === 0) return res.json(successResponse([]));

        const cityWhere = {
            group: 'm_city',
            id: { [Op.in]: cityIds }
        };
        if (city_name) {
            cityWhere.value1 = { [Op.iLike]: `%${city_name}%` };
        }

        const cities = await models.m_gen.findAll({
            where: cityWhere,
            attributes: ['id', 'value1'],
            order: [['value1', 'ASC']]
        });

        const result = cities.map(city => ({
            id: city.id,
            name: city.value1,
            districts: groupedDistricts[city.id]
        }));

        res.json(successResponse(result));
    }
};
