// Controller for user_detail
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.user_detail
//
// Tambahkan custom function di bawah ini
import { fn, col, literal, Op } from "sequelize";

import { user as user_default } from '../models/index.js';

export const user_detailController = {
    // Contoh: Upload gambar ke database (kolom image: Buffer/BLOB)
    async uploadImage(req, res) {
        const imageFile = req.files?.find(f => f.mimetype.startsWith('image/'));
        if (!imageFile) return res.status(400).json({ error: 'No image file found' });
        try {
            const inserted = await req.models.user_detail.create({ image: imageFile.buffer });
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
            const inserted = await req.models.user_detail.bulkCreate(records);
            res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    // Contoh: Custom function
    async customFunction(req, res) {
        res.json({ message: 'Custom function untuk user_detail', body: req.body, query: req.query });
    },

    async updateUser(req, res) {
        const m_user_detail = req.models.user_detail;
        const sequelize = await m_user_detail.sequelize;

        let transaction;
        try {
            transaction = await sequelize.transaction();

            const { id } = req.body;

            if (!id) {
                return res.status(400).json({ nessage: "Invalid input" });
            }
            const {
                nik,
                name,
                username,
                password,
                desc,
                f_user_type,
                status,
                user_detail = [],
            } = req.body;

            const existingUser = await user_default.findByPk(id);
            if (!existingUser) {
                return res.status(404).json({ message: 'User not found' });
            }

            const updatedData = {
                nik,
                name,
                username,
                desc,
                f_user_type,
                status,
            };

            if (password && password.trim() !== '') {
                const bcrypt = await import('bcrypt');
                const saltRounds = 10;
                const hashedPassword = await bcrypt.default.hash(password, saltRounds);
                updatedData.password = hashedPassword;
            }

            await existingUser.update(updatedData, { transaction });

            await m_user_detail.destroy({
                where: { f_user_default: id },
                transaction,
            });

            for (const detail of user_detail) {
                await m_user_detail.create(
                    {
                        ...detail,
                        f_user_default: id,
                    },
                    { transaction }
                );
            }

            await transaction.commit();
            transaction = null;

            const result = await user_default.findByPk(id);
            res.status(201).json({
                status: 'success',
                data: result,
                message: 'Updated successfully'
            });
        } catch (error) {
            if (transaction) await transaction.rollback();
            res.status(500).json({ status: 'error', message: error.message });
        }
    },

    async getUserCompanies(req, res) {
        const { user_id, responsibility_id, search } = req.query;

        try {
            const userDetails = await req.models.user_detail.findAll({
                where: {
                    f_user_default: user_id,
                    f_responsibility: responsibility_id
                },
                include: [
                    {
                        model: req.models.m_responsibility,
                        as: 'm_responsibility',
                        attributes: ['f_comp'],
                        include: [
                            {
                                model: req.models.m_unit_bussiness,
                                as: 'm_unit_bussiness',
                                attributes: ['id', 'name'],
                                ...(search
                                    ? { where: { name: { [Op.iLike]: `%${search}%` } } }
                                    : {})
                            }
                        ]
                    }
                ]
            });

            if (!userDetails || userDetails.length === 0) {
                return res.status(404).json({ status: 'not_found', message: 'User detail not found' });
            }

            const result = [];

            for (const detail of userDetails) {
                const responsibility = detail.m_responsibility;

                if (!responsibility || !responsibility.f_comp) {
                    // Ambil semua unit bisnis jika f_comp null
                    const allUnits = await req.models.m_unit_bussiness.findAll({
                        attributes: ['id', 'name'],
                        ...(search
                            ? { where: { name: { [Op.iLike]: `%${search}%` } } }
                            : {})
                    });

                    result.push(...allUnits.map(unit => ({
                        id: unit.id,
                        name: unit.name
                    })));
                } else {
                    // Ambil unit bisnis dari responsibility
                    const unit = responsibility.m_unit_bussiness;
                    if (unit) {
                        result.push({
                            id: unit.id,
                            name: unit.name
                        });
                    }
                }
            }

            // Hapus duplikat berdasarkan ID
            const uniqueResult = Array.from(new Map(result.map(item => [item.id, item])).values());

            return res.json({ status: 'success', data: uniqueResult });
        } catch (err) {
            return res.status(500).json({ status: 'error', message: err.message });
        }
    }

};
