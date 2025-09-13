// Controller for t_inventory_s_adjustment_approval
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_inventory_s_adjustment_approval
//
// Tambahkan custom function di bawah ini

import { Op } from 'sequelize';

// Status constants
const TRX_APPROVAL_STATUS = {
    DRAFT: 'DRAFT',
    REVISED: 'REVISED',
    IN_APPROVAL: 'IN_APPROVAL',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED'
};

const APPROVAL_STATUS = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    REVISED: 'REVISED'
};


export const t_inventory_s_adjustment_approvalController = {
    // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
    async uploadImage(req, res) {
        const fileFields = Object.keys(req.models.t_inventory_s_adjustment_approval.rawAttributes).filter(
            key => req.models.t_inventory_s_adjustment_approval.rawAttributes[key].type && req.models.t_inventory_s_adjustment_approval.rawAttributes[key].type.key === 'STRING'
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
            const inserted = await req.models.t_inventory_s_adjustment_approval.create(data);
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
            const inserted = await req.models.t_inventory_s_adjustment_approval.bulkCreate(records);
            res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    // Contoh: Custom function
    async customFunction(req, res) {
        res.json({ message: 'Custom function untuk t_inventory_s_adjustment_approval', body: req.body, query: req.query });
    },

    // Cek jika user punya akses untuk mengajukan
    async checkCanSubmit(req, res) {
        const { auth_user_id, menu_id, unit_bussiness_id } = req.body;
        const { m_approval, m_approval_d } = req.models;

        if (!auth_user_id || !menu_id) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // 1. Cari approval yg cocok dengan menu & unit business
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
                message: 'Approval setting not found for this transaction.',
            });
        }

        // Cek apakah user termasuk pengaju?
        const isCurrentUserSubmitter = approval.m_approval_ds && approval.m_approval_ds.length > 0;

        if (!isCurrentUserSubmitter) {
            // Cek apakah ada user lain yg menjadi pengaju
            const otherSubmitter = await m_approval_d.findOne({
                where: {
                    approval_id: approval.id,
                    user_id: { [Op.ne]: auth_user_id },
                    type: 'mengajukan'
                }
            });

            if (otherSubmitter) {
                return res.status(400).json({
                    can_submit: false,
                    message: 'User does not have access to submit stock adjustment. Only specific users can submit.',
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
                message: 'No users can approve this stock adjustment. Please check your approval configuration.'
            });
        }

        res.json({
            can_submit: true,
            approval_id: approval.id
        });
    },

    async requestApproval(req, res) {
        const { stock_adjustment_id, menu_id, unit_bussiness_id } = req.body;
        const { t_inventory_s_adjustment, m_approval, m_approval_d, t_inventory_s_adjustment_approval } = req.models;
        const sequelize = m_approval.sequelize;

        if (!stock_adjustment_id) {
            return res.status(400).json({ message: 'stock_adjustment_id is required' });
        }

        const t = await sequelize.transaction();

        try {
            // 1. Ambil data transaksi
            const transaksi = await t_inventory_s_adjustment.findByPk(stock_adjustment_id);
            if (!transaksi) return res.status(404).json({ message: 'Stock adjustment not found' });

            if (![TRX_APPROVAL_STATUS.DRAFT, TRX_APPROVAL_STATUS.REVISED].includes(transaksi.status)) {
                return res.status(400).json({ message: 'Unable to request approval. Stock adjustment has been processed' });
            }

            if (transaksi.status === TRX_APPROVAL_STATUS.REVISED) {
                await t_inventory_s_adjustment_approval.update(
                    { is_active: false },
                    {
                        where: {
                            stock_adjustment_id: stock_adjustment_id,
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

            if (!approvers.length) return res.status(400).json({ message: 'No approvers found for this stock adjustment' });

            // 4. Simpan ke t_inventory_s_adjustment_approval
            const approvalRecords = approvers.map(appr => ({
                stock_adjustment_id: transaksi.id,
                approval_id: approval.id,
                approval_d_id: appr.id,
                user_id: appr.user_id,
                level: appr.level,
                full_approval: appr.full_approval,
                status: APPROVAL_STATUS.PENDING
            }));

            await t_inventory_s_adjustment_approval.bulkCreate(approvalRecords, { transaction: t });

            // 5. Update status dan current level
            await transaksi.update({
                status: TRX_APPROVAL_STATUS.IN_APPROVAL,
                current_approval_level: 1,
                approval_count: approvers.length
            }, { transaction: t });

            await t.commit();

            return res.json({ message: 'Approval request sent successfully' });
        } catch (err) {
            await t.rollback();
            res.status(500).json({ error: err.message });
        }
    },
    async approvalAction(req, res) {
        const { stock_adjustment_id, status, notes, auth_user_id } = req.body;
        const { t_inventory_s_adjustment, t_inventory_s_adjustment_approval } = req.models;
        const sequelize = t_inventory_s_adjustment.sequelize;

        const validStatus = ['APPROVED', 'REJECTED', 'REVISED'];

        if (!stock_adjustment_id || !auth_user_id || !validStatus.includes(status)) {
            return res.status(400).json({ message: 'Invalid input' });
        }

        const t = await sequelize.transaction();

        try {
            // 1. Ambil data transaksi
            const transaksi = await t_inventory_s_adjustment.findByPk(stock_adjustment_id);
            if (!transaksi || transaksi.status !== TRX_APPROVAL_STATUS.IN_APPROVAL) {
                return res.status(400).json({ message: 'Stock adjustment not found or not in approval process' });
            }

            // 2. Cari approval aktif untuk user dan level saat ini
            const approvalRecord = await t_inventory_s_adjustment_approval.findOne({
                where: {
                    stock_adjustment_id,
                    user_id: auth_user_id,
                    level: transaksi.current_approval_level,
                    status: APPROVAL_STATUS.PENDING,
                    is_active: true,
                }
            });

            if (!approvalRecord) {
                return res.status(403).json({ message: 'You are not authorized to approve this stock adjustment at the current level.' });
            }

            // 3. Update approval record
            await approvalRecord.update({
                status,
                notes,
                approved_at: new Date()
            }, { transaction: t });

            // 4. Kalau status bukan APPROVED → langsung ubah status stock adjustment
            if (status !== TRX_APPROVAL_STATUS.APPROVED) {
                let revisedCount = transaksi.revised_count || 0;
                if (status === TRX_APPROVAL_STATUS.REVISED) {
                    revisedCount++;
                }
                await transaksi.update({ status, revised_count: revisedCount }, { transaction: t });
                await t.commit();
                return res.json({ message: `Stock adjustment successfully ${status.toLowerCase()}` });
            } else {
                // Jika statusnya Approved, tambah nilai approved_count
                let approvedCount = transaksi.approved_count || 0;
                approvedCount++;
                await transaksi.update({ approved_count: approvedCount }, { transaction: t });
            }

            // 5. Cek apakah semua approver di level ini sudah approve (full_approval = true)
            const sameLevelPending = await t_inventory_s_adjustment_approval.count({
                where: {
                    stock_adjustment_id,
                    level: transaksi.current_approval_level,
                    status: APPROVAL_STATUS.PENDING,
                    full_approval: true,
                    is_active: true,
                    user_id: { [Op.ne]: auth_user_id }
                }
            });

            if (sameLevelPending > 0) {
                await t.commit();
                return res.json({ message: 'Your approval has been received, waiting for other approvers' });
            }

            // 6. Cari next level approval
            const nextLevel = transaksi.current_approval_level + 1;
            const nextApprovers = await t_inventory_s_adjustment_approval.count({
                where: {
                    stock_adjustment_id,
                    level: nextLevel,
                    is_active: true
                }
            });

            if (nextApprovers > 0) {
                // Lanjut ke level berikutnya
                await transaksi.update({ current_approval_level: nextLevel }, { transaction: t });
                await t.commit();
                return res.json({ message: 'Stock adjustment successfully approved, proceed to the next level' });
            } else {
                // Tidak ada level berikut → stock adjustment selesai
                await transaksi.update({ status: TRX_APPROVAL_STATUS.APPROVED }, { transaction: t });
                await t.commit();
                return res.json({ message: 'Stock adjustment successfully approved in final' });
            }
        } catch (err) {
            await t.rollback();
            res.status(500).json({ error: err.message });
        }
    },
    // Get approval history
    async getApprovalHistory(req, res) {
        const { stock_adjustment_id } = req.params;
        const { t_inventory_s_adjustment_approval, m_approval_d, user_default } = req.models;

        try {
            const approvals = await t_inventory_s_adjustment_approval.findAll({
                where: { 
                    stock_adjustment_id,
                    is_active: true 
                },
                include: [
                    {
                        model: m_approval_d,
                        as: 'approval_detail'
                    },
                    {
                        model: user_default,
                        as: 'approver',
                        attributes: ['id', 'name', 'email']
                    }
                ],
                order: [['level', 'ASC'], ['created_at', 'ASC']]
            });

            const groupedByLevel = approvals.reduce((acc, approval) => {
                const level = approval.level;
                if (!acc[level]) {
                    acc[level] = [];
                }
                acc[level].push({
                    id: approval.id,
                    approver: approval.approver,
                    status: approval.status,
                    notes: approval.notes,
                    approved_at: approval.approved_at,
                    created_at: approval.created_at,
                    full_approval: approval.full_approval
                });
                return acc;
            }, {});

            return res.json({
                success: true,
                data: {
                    stock_adjustment_id,
                    approval_history: groupedByLevel,
                    total_levels: Object.keys(groupedByLevel).length
                }
            });

        } catch (error) {
            console.error('Error in getApprovalHistory:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    },

    // Get pending approvals for user
    async getPendingApprovals(req, res) {
        const { user_id } = req.query;
        const { t_inventory_s_adjustment_approval, t_inventory_s_adjustment, m_warehouse, m_unit_bussiness } = req.models;

        if (!user_id) {
            return res.status(400).json({
                success: false,
                message: 'Missing required parameter: user_id'
            });
        }

        try {
            const pendingApprovals = await t_inventory_s_adjustment_approval.findAll({
                where: {
                    user_id: user_id,
                    status: APPROVAL_STATUS.PENDING,
                    is_active: true
                },
                include: [
                    {
                        model: t_inventory_s_adjustment,
                        as: 'stockAdjustment',
                        attributes: ['id', 'code', 'date', 'notes', 'status'],
                        include: [
                            {
                                model: m_warehouse,
                                as: 'warehouse',
                                attributes: ['id', 'name']
                            },
                            {
                                model: m_unit_bussiness,
                                as: 'company',
                                attributes: ['id', 'name']
                            }
                        ]
                    }
                ],
                order: [['created_at', 'DESC']]
            });

            return res.json({
                success: true,
                data: {
                    pending_approvals: pendingApprovals,
                    count: pendingApprovals.length
                }
            });

        } catch (error) {
            console.error('Error getting pending approvals:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    },

    // Get approval status for specific adjustment
    async getApprovalStatus(req, res) {
        const { stock_adjustment_id } = req.params;
        const { t_inventory_s_adjustment, t_inventory_s_adjustment_approval, m_warehouse, m_unit_bussiness, user_default } = req.models;

        try {
            const stockAdjustment = await t_inventory_s_adjustment.findByPk(stock_adjustment_id, {
                include: [
                    {
                        model: m_warehouse,
                        as: 'warehouse',
                        attributes: ['id', 'name']
                    },
                    {
                        model: m_unit_bussiness,
                        as: 'company',
                        attributes: ['id', 'name']
                    }
                ]
            });

            if (!stockAdjustment) {
                return res.status(404).json({
                    success: false,
                    message: 'Stock adjustment not found'
                });
            }

            const approvals = await t_inventory_s_adjustment_approval.findAll({
                where: { 
                    stock_adjustment_id,
                    is_active: true 
                },
                include: [{
                    model: user_default,
                    as: 'approver',
                    attributes: ['id', 'name', 'email']
                }],
                order: [['level', 'ASC'], ['created_at', 'ASC']]
            });

            const groupedByLevel = approvals.reduce((acc, approval) => {
                const level = approval.level;
                if (!acc[level]) {
                    acc[level] = {
                        level,
                        approvals: [],
                        status: 'PENDING'
                    };
                }
                acc[level].approvals.push({
                    id: approval.id,
                    approver: approval.approver,
                    status: approval.status,
                    notes: approval.notes,
                    approved_at: approval.approved_at,
                    created_at: approval.created_at,
                    full_approval: approval.full_approval
                });

                // Determine level status
                const levelApprovals = acc[level].approvals;
                const approvedCount = levelApprovals.filter(a => a.status === 'APPROVED').length;
                const rejectedCount = levelApprovals.filter(a => a.status === 'REJECTED').length;
                const revisedCount = levelApprovals.filter(a => a.status === 'REVISED').length;
                const fullApprovalCount = levelApprovals.filter(a => a.full_approval === true).length;

                if (rejectedCount > 0) {
                    acc[level].status = 'REJECTED';
                } else if (revisedCount > 0) {
                    acc[level].status = 'REVISED';
                } else if (approvedCount === fullApprovalCount && fullApprovalCount > 0) {
                    acc[level].status = 'APPROVED';
                } else if (approvedCount > 0) {
                    acc[level].status = 'PARTIAL';
                } else {
                    acc[level].status = 'PENDING';
                }

                return acc;
            }, {});

            return res.json({
                success: true,
                data: {
                    stock_adjustment: stockAdjustment,
                    approval_levels: groupedByLevel,
                    overall_status: stockAdjustment.status,
                    current_level: stockAdjustment.current_approval_level
                }
            });

        } catch (error) {
            console.error('Error getting approval status:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

};
