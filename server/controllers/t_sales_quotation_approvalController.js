// Controller for t_sales_quotation_approval
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_sales_quotation_approval
//
// Tambahkan custom function di bawah ini

import { Op } from "sequelize";

const PO_APPROVAL_STATUS = {
    DRAFT: 1,
    IN_APPROVAL: 2,
    REVISED: 3,
    APPROVED: 4,
    REJECTED: 9,
    // CLOSED: 'CLOSED',
}

const APPROVAL_STATUS = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REVISED: 'REVISED',
    REJECTED: 'REJECTED',
}

export const t_sales_quotation_approvalController = {
    // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
    async uploadImage(req, res) {
        const fileFields = Object.keys(req.models.t_sales_quotation_approval.rawAttributes).filter(
        key => req.models.t_sales_quotation_approval.rawAttributes[key].type && req.models.t_sales_quotation_approval.rawAttributes[key].type.key === 'STRING'
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
        const inserted = await req.models.t_sales_quotation_approval.create(data);
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
        const inserted = await req.models.t_sales_quotation_approval.bulkCreate(records);
        res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
        res.status(500).json({ error: err.message });
        }
    },

    // async requestApproval(req, res) {
    //     const { sales_quotation_id, menu_id } = req.body;
    //     const { t_sales_quotation, m_approval, m_approval_d, t_sales_quotation_approval } = req.models;
    //     const sequelize = m_approval.sequelize;

    //     if (!sales_quotation_id) {
    //         return res.status(400).json({ message: 'sales_quotation_id is required' });
    //     }

    //     const t = await sequelize.transaction();

    //     try {
    //         // 1. Ambil PO
    //         const po = await t_sales_quotation.findByPk(sales_quotation_id);
    //         if (!po) return res.status(404).json({ message: 'SQ not found' });
    //         if (po.status !== PO_APPROVAL_STATUS.DRAFT) return res.status(400).json({ message: 'SQ has been processed' });

    //         // 2. Cari approval rule yg cocok
    //         const approval = await m_approval.findOne({
    //             where: {
    //                 menu_id: menu_id,
    //                 min_trx: { [Op.lte]: po.total },
    //                 max_trx: { [Op.gte]: po.total }
    //             }
    //         });

    //         if (!approval) return res.status(400).json({ message: 'Approval rule not found' });

    //         // 3. Cari semua approver berdasarkan approval_id
    //         const approvers = await m_approval_d.findAll({
    //             where: {
    //                 approval_id: approval.id,
    //                 type: 'menyetujui'
    //             },
    //             order: [['level', 'ASC']]
    //         });

    //         if (!approvers.length) return res.status(400).json({ message: 'No approvers found for this SQ' });

    //         // 4. Simpan ke t_sales_quotation_approval
    //         const approvalRecords = approvers.map(appr => ({
    //             sq_id: po.id,
    //             approval_id: approval.id,
    //             approval_d_id: appr.id,
    //             user_id: appr.user_id,
    //             level: appr.level,
    //             full_approval: appr.full_approval,
    //             status: APPROVAL_STATUS.PENDING
    //         }));

    //         await t_sales_quotation_approval.bulkCreate(approvalRecords, { transaction: t });

    //         // 5. Update PO status dan current level (optional)
    //         await po.update({
    //             status: PO_APPROVAL_STATUS.IN_APPROVAL,
    //             current_approval_level: 1 // kalau kamu pakai tracking level
    //         }, { transaction: t });

    //         await t.commit()

    //         return res.json({ message: 'Approval request sent successfully' });
    //     } catch (err) {
    //         await t.rollback();
    //         res.status(500).json({ error: err.message })
    //     }
    // },

    // cek jika user punya akses untuk mengajukan SQ
    async checkCanSubmit(req, res) {
        const { grand_total, unit_bussiness_id } = req.body;
        const { m_approval, m_approval_d } = req.models;
        const user = req.user;
        const menu_id = 'a15b76ba-daa3-4dec-8af0-03ec2d04ab71';

        if ( grand_total == null) {
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
                    user_id: user.id,
                    type: 'mengajukan'
                },
                required: true
            },
            order: [['createdAt', 'ASC']]
        });

        if (!approval) {
            return res.status(400).json({
                can_submit: false,
                message: 'User does not have access to submit SQ.'
            });
        }

        // cek apakah user termasuk pengaju?
        const isCurrentUserSubmitter = approval.m_approval_ds && approval.m_approval_ds.length > 0;
        if (!isCurrentUserSubmitter) {
            // cek apakah ada user lain yg menjadi pengaju
            const otherSubmitter = await m_approval_d.findOne({
                where: {
                    approval_id: approval.id,
                    user_id: { [Op.ne]: user.id },
                    type: 'mengajukan'
                }
            });


            if (otherSubmitter) {
                return res.status(400).json({
                    can_submit: false,
                    message: 'User does not have access to submit SQ. Only specific users can submit.'
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
                message: 'No users can approve this SQ. Please check your approval configuration.'
            });
        }

        res.json({
            can_submit: true,
            approval_id: approval.id
        });
    },

    async requestApproval(req, res) {
        const { sales_quotation_id } = req.body;
        const { 
            t_sales_quotation, 
            m_approval, 
            m_approval_d, 
            t_sales_quotation_approval 
        } = req.models;
        const user = req.user;
        const sequelize = m_approval.sequelize;
        const menu_id = 'a15b76ba-daa3-4dec-8af0-03ec2d04ab71';

        if (!sales_quotation_id) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const t = await sequelize.transaction();

        try {
            // 1. Ambil Sales Quotation
            const po = await t_sales_quotation.findByPk(sales_quotation_id);
            if (!po) return res.status(404).json({ message: 'SQ not found' });
            if (po.status !== PO_APPROVAL_STATUS.DRAFT && po.status !== PO_APPROVAL_STATUS.REVISED) {
                return res.status(400).json({ message: 'SQ has been processed' });
            }

            // 2. Cari approval rule yg cocok
            const approval = await m_approval.findOne({
                where: {
                    menu_id,
                    min_trx: { [Op.lte]: po.total },
                    max_trx: { [Op.gte]: po.total },
                    unit_bussiness_id: po.unit_bussiness_id,
                },
                include: {
                    model: m_approval_d,
                    as: 'm_approval_ds',
                    where: {
                        user_id: user.id,
                        type: 'mengajukan'
                    },
                    required: true
                },
                order: [['createdAt', 'ASC']]
            });

            if (!approval) {
                await t.rollback();
                return res.status(400).json({
                    message: 'User does not have access to submit SQ.'
                });
            }

            // cek apakah user termasuk pengaju?
            const isCurrentUserSubmitter = approval.m_approval_ds && approval.m_approval_ds.length > 0;
            if (!isCurrentUserSubmitter) {
                // cek apakah ada user lain yg menjadi pengaju
                const otherSubmitter = await m_approval_d.findOne({
                    where: {
                        approval_id: approval.id,
                        user_id: { [Op.ne]: user.id },
                        type: 'mengajukan'
                    }
                });


                if (otherSubmitter) {
                    return res.status(400).json({
                        can_submit: false,
                        message: 'User does not have access to submit SI. Only specific users can submit.'
                    });
                }
            }

            // 3. Cek approver
            const approvers = await m_approval_d.findAll({
                where: {
                    approval_id: approval.id,
                    type: 'menyetujui'
                },
                order: [['level', 'ASC']]
            });

            if (!approvers.length) {
                await t.rollback();
                return res.status(400).json({
                    message: 'No approvers found for this SQ. Please check your approval config.'
                });
            }

            // 4. Simpan ke t_sales_quotation_approval
            const approvalRecords = approvers.map(appr => ({
                sq_id: po.id,
                approval_id: approval.id,
                approval_d_id: appr.id,
                user_id: appr.user_id,
                level: appr.level,
                full_approval: appr.full_approval,
                status: APPROVAL_STATUS.PENDING
            }));

            await t_sales_quotation_approval.bulkCreate(approvalRecords, { transaction: t });

            // 5. Update SQ
            await po.update({
                status: PO_APPROVAL_STATUS.IN_APPROVAL,
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
            res.status(500).json({ error: err.message });
        }
    },

    // Api untuk approver
    async approvalAction(req, res) {
        const { sales_quotation_id, status, notes } = req.body;
        const { t_sales_quotation, t_sales_quotation_approval } = req.models;
        const user = req.user;
        const sequelize = t_sales_quotation.sequelize;

        const validStatus = ['APPROVED', 'REJECTED', 'REVISED'];
        if (!sales_quotation_id || !validStatus.includes(status)) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const t = await sequelize.transaction(); // Awal transaksi

        try {
            const po = await t_sales_quotation.findByPk(sales_quotation_id);
            if (!po || po.status !== PO_APPROVAL_STATUS.IN_APPROVAL) {
                return res.status(400).json({ message: 'SQ not found or not in approval process' });
            }

            const approvalRecord = await t_sales_quotation_approval.findOne({
                where: {
                    sq_id: sales_quotation_id,
                    user_id: user.id,
                    level: po.current_approval_level,
                    status: APPROVAL_STATUS.PENDING,
                    is_active: true,
                },
                transaction: t
            });

            if (!approvalRecord) {
                return res.status(403).json({ message: 'You are not authorized to approve this SQ at the current level.' });
            }

            await approvalRecord.update({
                status,
                notes,
                approved_at: new Date()
            }, { transaction: t });

            // Jika bukan APPROVED, update status dan commit transaksi
            if (PO_APPROVAL_STATUS[status] !== PO_APPROVAL_STATUS.APPROVED) {
                let revisedCount = po.revised_count || 0;
                if (status === PO_APPROVAL_STATUS.REVISED) {
                    revisedCount++;
                }
                await po.update({ status: PO_APPROVAL_STATUS[status], revised_count: revisedCount }, { transaction: t });
                await t.commit();
                return res.json({ message: `SQ successfully ${status.toLowerCase()}` });
            } else {
                // Jika statusnya Approved, tambah nilai approved_count
                let approvedCount = po.approved_count || 0;
                approvedCount++;
                await po.update({ approved_count: approvedCount }, { transaction: t })

            }

            // Cek apakah semua approver di level ini sudah approve
            const sameLevelPending = await t_sales_quotation_approval.count({
                where: {
                    sq_id: sales_quotation_id,
                    level: po.current_approval_level,
                    status: APPROVAL_STATUS.PENDING,
                    full_approval: true,
                    is_active: true,
                    user_id: { [Op.ne]: user.id }
                },
                transaction: t
            });

            if (sameLevelPending > 0) {
                await t.commit();
                return res.json({ message: 'Your approval has been received, waiting for other approvers' });
            }

            const nextLevel = po.current_approval_level + 1;
            const nextApprovers = await t_sales_quotation_approval.count({
                where: {
                    sq_id: sales_quotation_id,
                    level: nextLevel,
                    is_active: true
                },
                transaction: t
            });

            if (nextApprovers > 0) {
                // Lanjut ke level berikutnya
                await po.update({ current_approval_level: nextLevel, updated_by: "06da1eab-b88d-4ff2-b264-c792ab386684" }, { transaction: t });
                await t.commit();
                return res.json({ message: 'SQ successfully approved, proceed to the next level' });
            } else {
                // Tidak ada level berikut → SQ selesai
                await po.update({ status: PO_APPROVAL_STATUS.APPROVED, updated_by: "06da1eab-b88d-4ff2-b264-c792ab386684" }, { transaction: t });
                await t.commit();
                return res.json({ message: 'SQ successfully approved in final' });
            }
        } catch (err) {
            await t.rollback(); // rollback jika error
            return res.status(500).json({ error: err.message });
        }
    }
};
