// Controller for t_jadwal_pembayaran_approval
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_jadwal_pembayaran_approval
//
// Tambahkan custom function di bawah ini

import { Op } from "sequelize";

const TJP_APPROVAL_STATUS = {
    DRAFT: 'DRAFT',
    IN_APPROVAL: 'IN_APPROVAL',
    APPROVED: 'APPROVED',
    REVISED: 'REVISED',
    REJECTED: 'REJECTED',
    CLOSED: 'CLOSED',
}

const APPROVAL_STATUS = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REVISED: 'REVISED',
    REJECTED: 'REJECTED',
}

export const t_jadwal_pembayaran_approvalController = {
    // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
    async uploadImage(req, res) {
        const fileFields = Object.keys(req.models.t_jadwal_pembayaran_approval.rawAttributes).filter(
        key => req.models.t_jadwal_pembayaran_approval.rawAttributes[key].type && req.models.t_jadwal_pembayaran_approval.rawAttributes[key].type.key === 'STRING'
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
        const inserted = await req.models.t_jadwal_pembayaran_approval.create(data);
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
        const inserted = await req.models.t_jadwal_pembayaran_approval.bulkCreate(records);
        res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
        res.status(500).json({ error: err.message });
        }
    },

    // cek jika user punya akses untuk mengajukan Jadwal Pembayaran
    async checkCanSubmit(req, res) {
        const { auth_user_id, menu_id, grand_total, unit_bussiness_id } = req.body;
        const { m_approval, m_approval_d } = req.models;
        const sequelize = m_approval.sequelize;

        if (!auth_user_id || !menu_id || grand_total == null) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // 1. Cari approval yg cocok dengan menu & nominal
        const approval = await m_approval.findOne({
            where: {
                menu_id,
                min_trx: { [Op.lte]: grand_total },
                max_trx: { [Op.gte]: grand_total },
                ...(unit_bussiness_id ? { unit_bussiness_id } : {}),
            },
            include: {
                model: m_approval_d,
                as: 'm_approval_ds',
                where: {
                    user_id: auth_user_id,
                    type: 'mengajukan'
                },
                required: false
            }
        });


        if (!approval) {
            return res.status(400).json({
                can_submit: false,
                message: 'Approval setting not found for this transaction.',
            });
        }

        // cek apakah user termasuk pengaju?
        const isCurrentUserSubmitter = approval.m_approval_ds && approval.m_approval_ds.length > 0;


        if (!isCurrentUserSubmitter) {
            // cek apakah ada user lain yg menjadi pengaju
            const otherSubmitter = await m_approval_d.findOne({
                where: {
                    approval_id: approval.id,
                    user_id: { [Op.ne]: auth_user_id },
                    type: 'mengajukan'
                },
                include: [
                    {
                        model: m_approval,
                        required: true, // hanya ambil jika ada relasi
                    },
                ],
            });


            if (otherSubmitter) {
                return res.status(400).json({
                    can_submit: false,
                    message: 'User does not have access to submit tjp. Only specific users can submit.',
                    approval: approval.id,
                });
            }
        }

        // 2. Cek apakah ada user yg menyetujui untuk approval ini
        const approvers = await m_approval_d.findAll({
            where: {
                approval_id: approval.id,
                type: 'menyetujui'
            }
        });

        if (!approvers || approvers.length === 0) {
            return res.status(400).json({
                can_submit: false,
                message: 'No users can approve this TJP. Please check your approval configuration.'
            });
        }

        res.json({
            can_submit: true,
            approval_id: approval.id
        });
    },

    // Api untuk request approval
    async requestApproval(req, res) {
        const { t_jadwal_pembayaran_id, menu_id, unit_bussiness_id, auth_user_id } = req.body;
        const { t_jadwal_pembayaran, m_approval, m_approval_d, t_jadwal_pembayaran_approval } = req.models;
        const sequelize = m_approval.sequelize;

        if (!t_jadwal_pembayaran_id || !menu_id || !auth_user_id) {
            return res.status(400).json({ message: 't_jadwal_pembayaran_id, menu_id, and auth_user_id is required' });
        }

        const t = await sequelize.transaction();

        try {
            // 1. Ambil TJP
            const tjp = await t_jadwal_pembayaran.findByPk(t_jadwal_pembayaran_id);
            if (!tjp) return res.status(404).json({ message: 'Jadwal Pembayaran not found' });

            if (![TJP_APPROVAL_STATUS.DRAFT, TJP_APPROVAL_STATUS.REVISED].includes(tjp.status)) {
                return res.status(400).json({ message: 'Unable to request approval. TJP has been processed' });
            }

            if (tjp.status === TJP_APPROVAL_STATUS.REVISED) {
                await t_jadwal_pembayaran_approval.update(
                    { is_active: false },
                    {
                        where: {
                            t_jadwal_pembayaran_id: t_jadwal_pembayaran_id,
                            is_active: true
                        },
                        transaction: t
                    }
                );
            }


            // 2. Cari approval rule yg cocok
            const approval = await m_approval.findOne({
                where: {
                    menu_id: menu_id,
                    min_trx: { [Op.lte]: tjp.total_payment },
                    max_trx: { [Op.gte]: tjp.total_payment },
                    ...(unit_bussiness_id ? { unit_bussiness_id } : {}),
                }
            });

            if (!approval) return res.status(400).json({ message: 'Approval rule not found' });

            // 3. Cari semua approver berdasarkan approval_id
            const approvers = await m_approval_d.findAll({
                where: {
                    approval_id: approval.id,
                    type: 'menyetujui'
                },
                order: [['level', 'ASC']]
            });

            if (!approvers.length) return res.status(400).json({ message: 'No approvers found for this TJP' });

            // 4. Simpan ke t_jadwal_pembayaran_approval
            const approvalRecords = approvers.map(appr => ({
                t_jadwal_pembayaran_id: tjp.id,
                approval_id: approval.id,
                approval_d_id: appr.id,
                user_id: appr.user_id,
                level: appr.level,
                full_approval: appr.full_approval,
                status: APPROVAL_STATUS.PENDING,
                is_active: true
            }));

            await t_jadwal_pembayaran_approval.bulkCreate(approvalRecords, { transaction: t });

            // 5. Update TJP status dan current level (optional)
            await tjp.update({
                status: TJP_APPROVAL_STATUS.IN_APPROVAL,
                current_approval_level: 1,
                approval_count: approvers.length,
                approved_count: 0,
                revision_reason: null,
                reject_reason: null,
                submitted_by: auth_user_id,
                submitted_at: new Date()
            }, { transaction: t });

            await t.commit()

            return res.json({ message: 'Approval request sent successfully' });
        } catch (err) {
            await t.rollback();
            res.status(500).json({ error: err.message })
        }
    },

    // Api untuk approver
    async approvalAction(req, res) {
        const { t_jadwal_pembayaran_id, status, notes, auth_user_id } = req.body;
        const { t_jadwal_pembayaran, t_jadwal_pembayaran_approval } = req.models;
        const sequelize = t_jadwal_pembayaran.sequelize;

        const validStatus = ['APPROVED', 'REJECTED', 'REVISED'];

        if (!t_jadwal_pembayaran_id || !auth_user_id || !validStatus.includes(status)) {
            return res.status(400).json({ message: 'Invalid input' });
        }

        const t = await sequelize.transaction();


        try {
            // 1. Ambil TJP
            const tjp = await t_jadwal_pembayaran.findByPk(t_jadwal_pembayaran_id);
            if (!tjp || tjp.status !== TJP_APPROVAL_STATUS.IN_APPROVAL) {
                await t.rollback();
                return res.status(400).json({ message: 'TJP not found or not in approval process' });
            }

            // 2. Cari approval aktif untuk user dan level saat ini
            const approvalRecord = await t_jadwal_pembayaran_approval.findOne({
                where: {
                    t_jadwal_pembayaran_id,
                    user_id: auth_user_id,
                    level: tjp.current_approval_level,
                    status: APPROVAL_STATUS.PENDING,
                    is_active: true,
                }
            });
            
            // const approvalRecord = await t_jadwal_pembayaran_approval.findAll({
            //     where: {
            //         t_jadwal_pembayaran_id,
            //         user_id: auth_user_id,
            //         level: tjp.current_approval_level,
            //         status: APPROVAL_STATUS.PENDING,
            //         is_active: true,
            //     }
            // });

            if (!approvalRecord) {
                await t.rollback();
                return res.status(403).json({ message: 'You are not authorized to approve this TJP at the current level.' });
            }

            // 3. Update approval record
            await approvalRecord.update({
                status,
                notes,
                approved_at: new Date()
            }, { transaction: t });

            // 4. Kalau status bukan APPROVED → langsung ubah status TJP
            if (status !== TJP_APPROVAL_STATUS.APPROVED) {
                let revisedCount = tjp.revised_count || 0;
                if (status === TJP_APPROVAL_STATUS.REVISED) {
                    revisedCount++;
                    await tjp.update({ status, revised_count: revisedCount, revision_reason: notes }, { transaction: t });
                } else {
                    await tjp.update({ status, reject_reason: notes }, { transaction: t });
                }
                await t.commit()
                return res.json({ message: `TJP successfully ${status.toLowerCase()}` });
            } else {
                // Jika statusnya Approved, tambah nilai approved_count
                let approvedCount = tjp.approved_count || 0;
                approvedCount++;
                await tjp.update({ approved_count: approvedCount }, { transaction: t })

            }

            // 5. Cek apakah semua approver di level ini sudah approve (full_approval = true)
            const sameLevelPending = await t_jadwal_pembayaran_approval.count({
                where: {
                    t_jadwal_pembayaran_id,
                    level: tjp.current_approval_level,
                    status: APPROVAL_STATUS.PENDING,
                    full_approval: true,
                    is_active: true,
                    user_id: { [Op.ne]: auth_user_id }
                }
            });

            if (sameLevelPending > 0) {
                await t.commit()
                return res.json({ message: 'Your approval has been received, waiting for other approvers' });
            }

            // 6. Cari next level approval
            const nextLevel = tjp.current_approval_level + 1;
            const nextApprovers = await t_jadwal_pembayaran_approval.count({
                where: {
                    t_jadwal_pembayaran_id,
                    level: nextLevel,
                    is_active: true
                }
            });

            if (nextApprovers > 0) {
                // Lanjut ke level berikutnya
                await tjp.update({ current_approval_level: nextLevel }, { transaction: t });
                await t.commit()
                return res.json({ message: 'TJP successfully approved, proceed to the next level' });
            } else {
                // Tidak ada level berikut → TJP selesai
                await tjp.update({ status: TJP_APPROVAL_STATUS.APPROVED }, { transaction: t });
                await t.commit()
                return res.json({ message: 'TJP successfully approved in final' });
            }
        } catch (err) {
            await t.rollback();
            res.status(500).json({ error: err.message })
        }
    },

    // Contoh: Custom function
    async customFunction(req, res) {
        res.json({ message: 'Custom function untuk t_jadwal_pembayaran_approval', body: req.body, query: req.query });
    }
};
