// Controller for t_sales_return_approval
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_sales_return_approval
//
// Tambahkan custom function di bawah ini

import { Op } from "sequelize";

const SR_APPROVAL_STATUS = {
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

export const t_sales_return_approvalController = {
    // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
    async uploadImage(req, res) {
        const fileFields = Object.keys(req.models.t_sales_return_approval.rawAttributes).filter(
        key => req.models.t_sales_return_approval.rawAttributes[key].type && req.models.t_sales_return_approval.rawAttributes[key].type.key === 'STRING'
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
        const inserted = await req.models.t_sales_return_approval.create(data);
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
        const inserted = await req.models.t_sales_return_approval.bulkCreate(records);
        res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
        res.status(500).json({ error: err.message });
        }
    },

    // cek jika user punya akses untuk mengajukan SI
    async checkCanSubmit(req, res) {
        const { grand_total, unit_bussiness_id } = req.body;
        const { m_approval, m_approval_d } = req.models;
        const user = req.user;
        const menu_id = '7960edce-ac85-461a-a4d9-ce2ee9227b32';
        // const sequelize = m_approval.sequelize;

        if (grand_total == null) {
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
                message: 'User does not have access to submit Sales Return.'
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
                    message: 'User does not have access to submit Sales Return. Only specific users can submit.'
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
                message: 'No users can approve this Sales Return. Please check your approval configuration.'
            });
        }

        res.json({
            can_submit: true,
            approval_id: approval.id
        });
    },

    async requestApproval(req, res) {
        const { sales_return_id } = req.body;
        const user = req.user;
        const { 
            t_sales_return, 
            m_approval, 
            m_approval_d, 
            t_sales_return_approval 
        } = req.models;
        const menu_id = '7960edce-ac85-461a-a4d9-ce2ee9227b32';
        const sequelize = m_approval.sequelize;

        if (!sales_return_id) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const t = await sequelize.transaction();

        try {
            // 1. Ambil Sales order
            const po = await t_sales_return.findByPk(sales_return_id);
            if (!po) return res.status(404).json({ message: 'Sales Return not found' });

            if (po.status !== SR_APPROVAL_STATUS.DRAFT && po.status !== SR_APPROVAL_STATUS.REVISED) {
                return res.status(400).json({ message: 'Sales Return has been processed' });
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
                    message: 'User does not have access to submit Sales Return.'
                });
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
                    message: 'No approvers found for this Sales Return. Please check your approval config.'
                });
            }

            // 4. Simpan ke t_sales_return_approval
            const approvalRecords = approvers.map(appr => ({
                sr_id: po.id,
                approval_id: approval.id,
                approval_d_id: appr.id,
                user_id: appr.user_id,
                level: appr.level,
                full_approval: appr.full_approval,
                status: APPROVAL_STATUS.PENDING
            }));

            await t_sales_return_approval.bulkCreate(approvalRecords, { transaction: t });

            // 5. Update SQ
            await po.update({
                status: SR_APPROVAL_STATUS.IN_APPROVAL,
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
        const { sales_return_id, status, notes } = req.body;
        const user = req.user;
        const {
            t_sales_return,
            t_sales_return_approval,
            t_sales_return_d,
            m_warehouse
        } = req.models;

        const validStatus = ['APPROVED', 'REJECTED', 'REVISED'];
        if (!sales_return_id || !validStatus.includes(status)) {
            return res.status(400).json({ message: 'Invalid input' });
        }

        const sequelize = t_sales_return.sequelize;
        const t = await sequelize.transaction(); // Awal transaksi

        try {
            const po = await t_sales_return.findByPk(sales_return_id, { transaction: t });
            if (!po || po.status !== SR_APPROVAL_STATUS.IN_APPROVAL) {
                await t.rollback();
                return res.status(400).json({ message: 'Sales Return not found or not in approval process' });
            }

            const approvalRecord = await t_sales_return_approval.findOne({
                where: {
                    sr_id: sales_return_id,
                    user_id: user.id,
                    level: po.current_approval_level,
                    status: APPROVAL_STATUS.PENDING,
                    is_active: true,
                },
                transaction: t
            });

            if (!approvalRecord) {
                await t.rollback();
                return res.status(403).json({ message: 'You are not authorized to approve this Sales Return at the current level.' });
            }

            await approvalRecord.update({
                status,
                notes,
                approved_at: new Date()
            }, { transaction: t });

            // === Non-Approved (REJECTED or REVISED) ===
            if (SR_APPROVAL_STATUS[status] !== SR_APPROVAL_STATUS.APPROVED) {
                let revisedCount = po.revised_count || 0;
                if (status === SR_APPROVAL_STATUS.REVISED) {
                    revisedCount++;
                }
                await po.update({ status: SR_APPROVAL_STATUS[status], revised_count: revisedCount }, { transaction: t });
                await t.commit();
                return res.json({ message: `Sales Return successfully ${status.toLowerCase()}` });
            } else {
                // Jika statusnya Approved, tambah nilai approved_count
                let approvedCount = po.approved_count || 0;
                approvedCount++;
                await po.update({ approved_count: approvedCount, updated_by: user.id }, { transaction: t })

            }

            // === APPROVED ===
            let approvedCount = po.approved_count || 0;
            approvedCount++;
            await po.update({ approved_count: approvedCount }, { transaction: t });

            // Cek apakah masih ada approver di level ini
            const sameLevelPending = await t_sales_return_approval.count({
                where: {
                    sr_id: sales_return_id,
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
            const nextApprovers = await t_sales_return_approval.count({
                where: {
                    sr_id: sales_return_id,
                    level: nextLevel,
                    is_active: true
                },
                transaction: t
            });

            // Jika ada level selanjutnya
            if (nextApprovers > 0) {
                await po.update({ current_approval_level: nextLevel, updated_by: user.id }, { transaction: t });
                await t.commit();
                return res.json({ message: 'Sales Return successfully approved, proceed to the next level' });
            }

            // === FINAL APPROVAL ===
            await po.update({ status: SR_APPROVAL_STATUS.APPROVED }, { transaction: t });

            const warehouse = await m_warehouse.findOne({
                where: { unit_bussiness_id: po.unit_bussiness_id },
                transaction: t
            });

            if (!warehouse) {
                throw new Error('Warehouse not found for this unit_bussiness');
            }

            const details = await t_sales_return_d.findAll({
                where: { sales_return_id },
                transaction: t
            });

            for (const detail of details) {
                const inventoryQty = detail.qty_return * (detail.uom_value ?? 1);
                const unitCost = await inventoryService.getCOGS(detail.item_id, warehouse.id, t);
                await inventoryService.insertStock({
                    item_id: detail.item_id,
                    warehouse_id: warehouse.id,
                    quantity: inventoryQty,
                    transactionTypeName: "RETURN_INWARDS",
                    unitCost,
                    reference_id: po.id,
                    reference_source: 't_sales_return',
                    batchNumber: po.code,
                    transaction: t
                });
            }
            
            // CREATE JURNAL - Masih Perlu Konfirmasi ke Mas Rico
            await accountingService.createJournal(
                {
                    unit_bussiness_id: po.unit_bussiness_id,
                    reference_id: po.id,
                    reference_type: "SALES_RETURN",
                    reference_no: po.code,
                    date: po.date,
                    entity_id: po.customer_id,
                    entity_type: "m_customer",
                    created_by: user.id,
                    details: [
                        {
                            variable: "var_Persediaan",
                            debit: po.total,
                            credit: 0,
                            notes: "Transaksi Surat Jalan",
                        },
                        {
                            variable: "var_HPP",
                            debit: 0,
                            credit: po.total,
                            notes: "Transaksi Surat Jalan",
                        },
                    ],
                },
                { transaction: t }
            );

            await t.commit();
            return res.json({ message: 'Sales Return successfully approved in final' });

        } catch (err) {
            await t.rollback();
            console.error(err);
            return res.status(500).json({ error: err.message });
        }
    }
};
