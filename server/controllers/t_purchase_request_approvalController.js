// Controller for t_purchase_request_approval
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_purchase_request_approval
//
// Tambahkan custom function di bawah ini

import { Op } from "sequelize";

const PR_APPROVAL_STATUS = {
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

export const t_purchase_request_approvalController = {
    // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
    async uploadImage(req, res) {
        const fileFields = Object.keys(req.models.t_purchase_request_approval.rawAttributes).filter(
            key => req.models.t_purchase_request_approval.rawAttributes[key].type && req.models.t_purchase_request_approval.rawAttributes[key].type.key === 'STRING'
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
            const inserted = await req.models.t_purchase_request_approval.create(data);
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
            const inserted = await req.models.t_purchase_request_approval.bulkCreate(records);
            res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    // cek jika user punya akses untuk mengajukan PR
    async checkCanSubmit(req, res) {
        const { auth_user_id, menu_id, unit_bussiness_id } = req.body;
        const { m_approval, m_approval_d } = req.models;
        const sequelize = m_approval.sequelize;

        if (!auth_user_id || !menu_id) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // 1. Cari approval yg cocok dengan menu & nominal
        const approval = await m_approval.findOne({
            where: {
                menu_id,
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
                message: 'Approval setting not found for this transaction.'
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
                    approval_id: approval.id,
                    can_submit: false,
                    message: 'User does not have access to submit PR. Only specific users can submit.'
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
                message: 'No users can approve this PR. Please check your approval configuration.'
            });
        }

        res.json({
            can_submit: true,
            approval_id: approval.id
        });
    },

    async requestApproval(req, res) {
        const { purchase_request_id, menu_id, unit_bussiness_id, auth_user_id } = req.body;
        const { t_purchase_request, m_approval, m_approval_d, t_purchase_request_approval } = req.models;
        const sequelize = m_approval.sequelize;

        if (!purchase_request_id || !menu_id || !auth_user_id) {
            return res.status(400).json({ message: 'purchase_request_id, menu_id, and auth_user_id is required' });
        }

        const t = await sequelize.transaction();

        try {
            // 1. Ambil PR
            const pr = await t_purchase_request.findByPk(purchase_request_id);
            if (!pr) return res.status(404).json({ message: 'PR not found' });

            if (![PR_APPROVAL_STATUS.DRAFT, PR_APPROVAL_STATUS.REVISED].includes(pr.status)) {
                return res.status(400).json({ message: 'Unable to request approval. PR has been processed' });
            }

            if (pr.status === PR_APPROVAL_STATUS.REVISED) {
                await t_purchase_request_approval.update(
                    { is_active: false },
                    {
                        where: {
                            purchase_request_id: purchase_request_id,
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

            if (!approvers.length) return res.status(400).json({ message: 'No approvers found for this PR' });

            // 4. Simpan ke t_purchase_request_approval
            const approvalRecords = approvers.map(appr => ({
                purchase_request_id: pr.id,
                approval_id: approval.id,
                approval_d_id: appr.id,
                user_id: appr.user_id,
                level: appr.level,
                full_approval: appr.full_approval,
                status: APPROVAL_STATUS.PENDING,
                is_active: true,
            }));

            await t_purchase_request_approval.bulkCreate(approvalRecords, { transaction: t });

            // 5. Update PR status dan current level (optional)
            await pr.update({
                status: PR_APPROVAL_STATUS.IN_APPROVAL,
                current_approval_level: 1, // kalau kamu pakai tracking level
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
        const { purchase_request_id, status, notes, auth_user_id } = req.body;
        const { t_purchase_request, t_purchase_request_approval } = req.models;
        const sequelize = t_purchase_request.sequelize;

        const validStatus = ['APPROVED', 'REJECTED', 'REVISED'];

        if (!purchase_request_id || !auth_user_id || !validStatus.includes(status)) {
            return res.status(400).json({ message: 'Invalid input' });
        }

        const t = await sequelize.transaction();


        try {
            // 1. Ambil PR
            const pr = await t_purchase_request.findByPk(purchase_request_id);
            if (!pr || pr.status !== PR_APPROVAL_STATUS.IN_APPROVAL) {
                await t.rollback();
                return res.status(400).json({ message: 'PR not found or not in approval process' });
            }

            // 2. Cari approval aktif untuk user dan level saat ini
            const approvalRecord = await t_purchase_request_approval.findOne({
                where: {
                    purchase_request_id,
                    user_id: auth_user_id,
                    level: pr.current_approval_level,
                    status: APPROVAL_STATUS.PENDING,
                    is_active: true,
                }
            });

            if (!approvalRecord) {
                await t.rollback();
                return res.status(403).json({ message: 'You are not authorized to approve this PR at the current level.' });
            }

            // 3. Update approval record
            await approvalRecord.update({
                status,
                notes,
                approved_at: new Date()
            }, { transaction: t });

            // 4. Kalau status bukan APPROVED → langsung ubah status PR
            if (status !== PR_APPROVAL_STATUS.APPROVED) {
                let revisedCount = pr.revised_count || 0;
                if (status === PR_APPROVAL_STATUS.REVISED) {
                    revisedCount++;
                    await pr.update({ status, revised_count: revisedCount, revision_reason: notes }, { transaction: t });
                } else {
                    await pr.update({ status, reject_reason: notes }, { transaction: t });
                }
                await t.commit()
                return res.json({ message: `PR successfully ${status.toLowerCase()}` });
            } else {
                // Jika statusnya Approved, tambah nilai approved_count
                let approvedCount = pr.approved_count || 0;
                approvedCount++;
                await pr.update({ approved_count: approvedCount }, { transaction: t })

            }

            // 5. Cek apakah semua approver di level ini sudah approve (full_approval = true)
            const sameLevelPending = await t_purchase_request_approval.count({
                where: {
                    purchase_request_id,
                    level: pr.current_approval_level,
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
            const nextLevel = pr.current_approval_level + 1;
            const nextApprovers = await t_purchase_request_approval.count({
                where: {
                    purchase_request_id,
                    level: nextLevel,
                    is_active: true
                }
            });

            if (nextApprovers > 0) {
                // Lanjut ke level berikutnya
                await pr.update({ current_approval_level: nextLevel }, { transaction: t });
                await t.commit()
                return res.json({ message: 'PR successfully approved, proceed to the next level' });
            } else {
                // Tidak ada level berikut → PR selesai
                await pr.update({ status: PR_APPROVAL_STATUS.APPROVED }, { transaction: t });
                await t.commit()
                return res.json({ message: 'PR successfully approved in final' });
            }
        } catch (err) {
            await t.rollback();
            res.status(500).json({ error: err.message })
        }
    }
};
