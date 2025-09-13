// Controller for t_complain_approval
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_complain_approval
//
// Tambahkan custom function di bawah ini

import { Op } from "sequelize";

const COMPLAIN_APPROVAL_STATUS = {
    DRAFT: 1,
    IN_APPROVAL: 2,
    APPROVED: 4,
    REJECTED: 9,
    // CLOSED: 'CLOSED',
}

const APPROVAL_STATUS = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
}

export const t_complain_approvalController = {
    // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
    async uploadImage(req, res) {
        const fileFields = Object.keys(req.models.t_complain_approval.rawAttributes).filter(
        key => req.models.t_complain_approval.rawAttributes[key].type && req.models.t_complain_approval.rawAttributes[key].type.key === 'STRING'
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
        const inserted = await req.models.t_complain_approval.create(data);
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
        const inserted = await req.models.t_complain_approval.bulkCreate(records);
        res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
        res.status(500).json({ error: err.message });
        }
    },

    async requestApproval(req, res) {
        const { complain_id } = req.body;
        const user = req.user;
        const { 
            t_complain, 
            m_approval, 
            m_approval_d, 
            t_complain_approval 
        } = req.models;

        const menu_id = '12dc5251-6aa7-4107-ae86-b94bd43cafa7';
        const sequelize = m_approval.sequelize;

        if (!complain_id) {
            return res.status(400).json({ message: 'Missing complain_id' });
        }

        const t = await sequelize.transaction();

        try {
            const complain = await t_complain.findByPk(complain_id);

            if (!complain) {
                return res.status(404).json({ message: 'Complain not found' });
            }

            if (![COMPLAIN_APPROVAL_STATUS.DRAFT].includes(complain.status)) {
                return res.status(400).json({ message: 'Complain has been processed' });
            }

            const approval = await m_approval.findOne({
                where: {
                    menu_id,
                    unit_bussiness_id: complain.unit_bussiness_id,
                    min_trx: { [Op.lte]: complain.total || 0 },
                    max_trx: { [Op.gte]: complain.total || 0 }
                },
                order: [['createdAt', 'ASC']]
            });

            if (!approval) {
                await t.rollback();
                return res.status(400).json({ message: 'No approval configuration found for this complain' });
            }

            const approvers = await m_approval_d.findAll({
                where: {
                    approval_id: approval.id,
                    type: 'menyetujui'
                },
                order: [['level', 'ASC']]
            });

            if (!approvers.length) {
                await t.rollback();
                return res.status(400).json({ message: 'No approvers found. Please check approval config.' });
            }

            const approvalRecords = approvers.map(appr => ({
                complain_id: complain.id,
                approval_id: approval.id,
                approval_d_id: appr.id,
                user_id: appr.user_id,
                level: appr.level,
                full_approval: appr.full_approval,
                status: APPROVAL_STATUS.PENDING
            }));

            await t_complain_approval.bulkCreate(approvalRecords, { transaction: t });

            await complain.update({
                status: COMPLAIN_APPROVAL_STATUS.IN_APPROVAL,
                current_approval_level: 1,
                approval_count: approvers.length,
                request_approval_at: new Date(),
                request_approval_by: user.id,
                updated_by: user.id,
            }, { transaction: t });

            await t.commit();

            return res.json({ message: 'Approval request sent successfully' });

        } catch (err) {
            await t.rollback();
            console.error("Error in requestApproval:", err);
            res.status(500).json({ error: err.message });
        }
    },

    // Api untuk approver
    async approvalAction(req, res) {
        const { complain_id, status, notes } = req.body;
        const { t_complain, t_complain_approval } = req.models;
        const user = req.user;
        const sequelize = t_complain.sequelize;

        const validStatus = ['APPROVED', 'REJECTED', 'REVISED'];
        if (!complain_id || !validStatus.includes(status)) {
            return res.status(400).json({ message: 'Invalid input' });
        }

        const t = await sequelize.transaction(); // Awal transaksi

        try {
            const po = await t_complain.findByPk(complain_id, { transaction: t });
            if (!po || po.status !== COMPLAIN_APPROVAL_STATUS.IN_APPROVAL) {
                await t.rollback();
                return res.status(400).json({ message: 'DP not found or not in approval process' });
            }

            const approvalRecord = await t_complain_approval.findOne({
                where: {
                    complain_id: complain_id,
                    user_id: user.id,
                    level: po.current_approval_level,
                    status: APPROVAL_STATUS.PENDING
                },
                transaction: t
            });

            if (!approvalRecord) {
                await t.rollback();
                return res.status(403).json({ message: 'You are not authorized to approve this complain at the current level.' });
            }

            await approvalRecord.update({
                status,
                notes,
                approved_at: new Date()
            }, { transaction: t });

            // Jika bukan APPROVED, update status dan commit transaksi
            if (COMPLAIN_APPROVAL_STATUS[status] !== COMPLAIN_APPROVAL_STATUS.APPROVED) {
                await po.update({ status: COMPLAIN_APPROVAL_STATUS[status] }, { transaction: t });
                await t.commit();
                return res.json({ message: `Complain successfully ${status.toLowerCase()}` });
            }

            // Cek apakah semua approver di level ini sudah approve
            const sameLevelPending = await t_complain_approval.count({
                where: {
                    complain_id: complain_id,
                    level: po.current_approval_level,
                    status: APPROVAL_STATUS.PENDING,
                    full_approval: true,
                    user_id: { [Op.ne]: user.id }
                },
                transaction: t
            });

            if (sameLevelPending > 0) {
                await t.commit();
                return res.json({ message: 'Your approval has been received, waiting for other approvers' });
            }

            const nextLevel = po.current_approval_level + 1;
            const nextApprovers = await t_complain_approval.count({
                where: {
                    complain_id: complain_id,
                    level: nextLevel
                },
                transaction: t
            });

            if (nextApprovers > 0) {
                await po.update({ current_approval_level: nextLevel }, { transaction: t });
                await t.commit();
                return res.json({ message: 'Complain successfully approved, proceed to the next level' });
            } else {
                await po.update({ status: COMPLAIN_APPROVAL_STATUS.APPROVED }, { transaction: t });
                await t.commit();
                return res.json({ message: 'Complain successfully approved in final' });
            }

        } catch (err) {
            await t.rollback(); // rollback jika error
            return res.status(500).json({ error: err.message });
        }
    }
};
