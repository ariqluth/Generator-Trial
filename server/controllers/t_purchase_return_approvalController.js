// Controller for t_purchase_return_approval
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_purchase_return_approval
//
// Tambahkan custom function di bawah ini


import { Op } from "sequelize";

const TRX_APPROVAL_STATUS = {
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

export const t_purchase_return_approvalController = {
    // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
    async uploadImage(req, res) {
        const fileFields = Object.keys(req.models.t_purchase_return_approval.rawAttributes).filter(
            key => req.models.t_purchase_return_approval.rawAttributes[key].type && req.models.t_purchase_return_approval.rawAttributes[key].type.key === 'STRING'
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
            const inserted = await req.models.t_purchase_return_approval.create(data);
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
            const inserted = await req.models.t_purchase_return_approval.bulkCreate(records);
            res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    // cek jika user punya akses untuk mengajukan
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
                    message: 'User does not have access to submit purchase return. Only specific users can submit.',
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
                message: 'No users can approve this purchase return. Please check your approval configuration.'
            });
        }

        res.json({
            can_submit: true,
            approval_id: approval.id
        });
    },

    async requestApproval(req, res) {
        const { purchase_return_id, menu_id, unit_bussiness_id, auth_user_id } = req.body;
        const { t_purchase_return, m_approval, m_approval_d, t_purchase_return_approval } = req.models;
        const sequelize = m_approval.sequelize;

        if (!purchase_return_id || !menu_id || !auth_user_id) {
            return res.status(400).json({ message: 'purchase_return_id, menu_id, and auth_user_id is required' });
        }

        const t = await sequelize.transaction();

        try {
            // 1. Ambil Data transaksi
            const transaksi = await t_purchase_return.findByPk(purchase_return_id);
            if (!transaksi) {
                await t.rollback();
                return res.status(404).json({ message: 'Purchase return not found' });
            }

            if (![TRX_APPROVAL_STATUS.DRAFT, TRX_APPROVAL_STATUS.REVISED].includes(transaksi.status)) {
                await t.rollback();
                return res.status(400).json({ message: 'Unable to request approval. Purchase return has been processed', transaksi });
            }

            if (transaksi.status === TRX_APPROVAL_STATUS.REVISED) {
                await t_purchase_return_approval.update(
                    { is_active: false },
                    {
                        where: {
                            purchase_return_id: purchase_return_id,
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
                    min_trx: { [Op.lte]: transaksi.total },
                    max_trx: { [Op.gte]: transaksi.total },
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

            if (!approvers.length) return res.status(400).json({ message: 'No approvers found for this Purchase return' });

            // 4. Simpan ke t_purchase_return_approval
            const approvalRecords = approvers.map(appr => ({
                purchase_return_id: transaksi.id,
                approval_id: approval.id,
                approval_d_id: appr.id,
                user_id: appr.user_id,
                level: appr.level,
                full_approval: appr.full_approval,
                status: APPROVAL_STATUS.PENDING,
                is_active: true,
            }));

            await t_purchase_return_approval.bulkCreate(approvalRecords, { transaction: t });

            // 5. Update PO status dan current level (optional)
            await transaksi.update({
                status: TRX_APPROVAL_STATUS.IN_APPROVAL,
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
        const { purchase_return_id, status, notes, auth_user_id } = req.body;
        const { t_purchase_return, t_purchase_return_approval } = req.models;
        const sequelize = t_purchase_return.sequelize;

        const validStatus = ['APPROVED', 'REJECTED', 'REVISED'];

        if (!purchase_return_id || !auth_user_id || !validStatus.includes(status)) {
            return res.status(400).json({ message: 'Invalid input' });
        }

        const t = await sequelize.transaction();


        try {
            // 1. Ambil data transaksi
            const transaksi = await t_purchase_return.findByPk(purchase_return_id);
            if (!transaksi || transaksi.status !== TRX_APPROVAL_STATUS.IN_APPROVAL) {
                return res.status(400).json({ message: 'Purchase return not found or not in approval process' });
            }

            // 2. Cari approval aktif untuk user dan level saat ini
            const approvalRecord = await t_purchase_return_approval.findOne({
                where: {
                    purchase_return_id,
                    user_id: auth_user_id,
                    level: transaksi.current_approval_level,
                    status: APPROVAL_STATUS.PENDING,
                    is_active: true,
                }
            });

            if (!approvalRecord) {
                return res.status(403).json({ message: 'You are not authorized to approve this purchase return at the current level.' });
            }

            // 3. Update approval record
            await approvalRecord.update({
                status,
                notes,
                approved_at: new Date()
            }, { transaction: t });

            // 4. Kalau status bukan APPROVED → langsung ubah status PO
            if (status !== TRX_APPROVAL_STATUS.APPROVED) {
                let revisedCount = transaksi.revised_count || 0;
                if (status === TRX_APPROVAL_STATUS.REVISED) {
                    revisedCount++;
                    await transaksi.update({ status, revised_count: revisedCount, revision_reason: notes }, { transaction: t });
                } else {
                    await transaksi.update({ status, reject_reason: notes }, { transaction: t });
                }
                await t.commit()
                return res.json({ message: `Purchase return successfully ${status.toLowerCase()}` });
            } else {
                // Jika statusnya Approved, tambah nilai approved_count
                let approvedCount = transaksi.approved_count || 0;
                approvedCount++;
                await transaksi.update({ approved_count: approvedCount }, { transaction: t })

            }

            // 5. Cek apakah semua approver di level ini sudah approve (full_approval = true)
            const sameLevelPending = await t_purchase_return_approval.count({
                where: {
                    purchase_return_id,
                    level: transaksi.current_approval_level,
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
            const nextLevel = transaksi.current_approval_level + 1;
            const nextApprovers = await t_purchase_return_approval.count({
                where: {
                    purchase_return_id,
                    level: nextLevel,
                    is_active: true
                }
            });

            if (nextApprovers > 0) {
                // Lanjut ke level berikutnya
                await transaksi.update({ current_approval_level: nextLevel }, { transaction: t });
                await t.commit()
                return res.json({ message: 'Purchase return successfully approved, proceed to the next level' });
            } else {
                // Tidak ada level berikut → PO selesai
                await transaksi.update({ status: TRX_APPROVAL_STATUS.APPROVED }, { transaction: t });
                await t.commit()
                return res.json({ message: 'Purchase return successfully approved in final' });
            }
        } catch (err) {
            await t.rollback();
            res.status(500).json({ error: err.message })
        }
    }

};
