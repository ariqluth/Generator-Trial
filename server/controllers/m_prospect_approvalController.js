// Controller for m_prospect_approval
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.m_prospect_approval
//
// Tambahkan custom function di bawah ini

import { Op } from "sequelize";

const P_APPROVAL_STATUS = {
    DRAFT: 1,
    IN_APPROVAL: 2,
    REVISED: 3,
    APPROVED: 4,
    REJECTED: 9,
}

const APPROVAL_STATUS = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REVISED: 'REVISED',
    REJECTED: 'REJECTED',
}

export const m_prospect_approvalController = {
    // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
    async uploadImage(req, res) {
        const fileFields = Object.keys(req.models.m_prospect_approval.rawAttributes).filter(
        key => req.models.m_prospect_approval.rawAttributes[key].type && req.models.m_prospect_approval.rawAttributes[key].type.key === 'STRING'
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
        const inserted = await req.models.m_prospect_approval.create(data);
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
        const inserted = await req.models.m_prospect_approval.bulkCreate(records);
        res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
        res.status(500).json({ error: err.message });
        }
    },

    // cek jika user punya akses untuk mengajukan SI
    async checkCanSubmit(req, res) {
        const { unit_bussiness_id } = req.body;
        const { m_approval, m_approval_d } = req.models;
        const user = req.user;
        const menu_id = '70c82851-c1f8-4130-8def-9d1e84fb26e7';

        if (!unit_bussiness_id) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // 1. Cari approval yg cocok dengan menu
        const approval = await m_approval.findOne({
            where: {
                menu_id,
                // min_trx: { [Op.lte]: grand_total },
                // max_trx: { [Op.gte]: grand_total },
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
                message: 'User does not have access to submit propect.'
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
                    message: 'User does not have access to submit Prospect. Only specific users can submit.'
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
                message: 'No users can approve this Prospect. Please check your approval configuration.'
            });
        }

        res.json({
            can_submit: true,
            approval_id: approval.id
        });
    },

    async requestApproval(req, res) {
        const { prospect_id } = req.body;
        const user = req.user;
        const { 
            m_prospect, 
            m_prospect_approval,
            m_approval, 
            m_approval_d
        } = req.models;
        const menu_id = '70c82851-c1f8-4130-8def-9d1e84fb26e7';
        const sequelize = m_approval.sequelize;

        if (!prospect_id) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const t = await sequelize.transaction();

        try {
            // 1. Ambil Sales order
            const po = await m_prospect.findByPk(prospect_id);
            if (!po) return res.status(404).json({ message: 'Prospect not found' });

            if (po.status !== P_APPROVAL_STATUS.DRAFT && po.status !== P_APPROVAL_STATUS.REVISED) {
                return res.status(400).json({ message: 'Prospect has been processed' });
            }

            // 2. Cari approval rule yg cocok
            const approval = await m_approval.findOne({
                where: {
                    menu_id,
                    // min_trx: { [Op.lte]: po.total },
                    // max_trx: { [Op.gte]: po.total },
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
                    message: 'User does not have access to submit Prospect.'
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
                    message: 'No approvers found for this Prospect. Please check your approval config.'
                });
            }

            // 4. Simpan ke m_prospect_approval
            const approvalRecords = approvers.map(appr => ({
                prospect_id: po.id,
                approval_id: approval.id,
                approval_d_id: appr.id,
                user_id: appr.user_id,
                level: appr.level,
                full_approval: appr.full_approval,
                status: APPROVAL_STATUS.PENDING
            }));

            await m_prospect_approval.bulkCreate(approvalRecords, { transaction: t });

            // 5. Update m_prospect
            await po.update({
                status: P_APPROVAL_STATUS.IN_APPROVAL,
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
        const { prospect_id, status, notes } = req.body;
        const user = req.user;
        const {
            m_prospect,
            m_prospect_approval,
            m_customer
        } = req.models;

        const validStatus = ['APPROVED', 'REJECTED', 'REVISED'];
        if (!prospect_id || !validStatus.includes(status)) {
            return res.status(400).json({ message: 'Invalid input' });
        }

        const sequelize = m_prospect.sequelize;
        const t = await sequelize.transaction(); // Awal transaksi

        try {
            const po = await m_prospect.findByPk(prospect_id, { transaction: t });
            if (!po || po.status !== P_APPROVAL_STATUS.IN_APPROVAL) {
                await t.rollback();
                return res.status(400).json({ message: 'Prospect not found or not in approval process' });
            }

            const approvalRecord = await m_prospect_approval.findOne({
                where: {
                    prospect_id,
                    user_id: user.id,
                    level: po.current_approval_level,
                    status: APPROVAL_STATUS.PENDING,
                    is_active: true,
                },
                transaction: t
            });

            if (!approvalRecord) {
                await t.rollback();
                return res.status(403).json({ message: 'You are not authorized to approve this Prospect at the current level.' });
            }

            await approvalRecord.update({
                status,
                notes,
                approved_at: new Date()
            }, { transaction: t });

            // === Non-Approved (REJECTED or REVISED) ===
            if (P_APPROVAL_STATUS[status] !== P_APPROVAL_STATUS.APPROVED) {
                let revisedCount = po.revised_count || 0;
                if (status === P_APPROVAL_STATUS.REVISED) {
                    revisedCount++;
                }
                await po.update({ status: P_APPROVAL_STATUS[status], revised_count: revisedCount }, { transaction: t });
                await t.commit();
                return res.json({ message: `Prospect successfully ${status.toLowerCase()}` });
            } else {
                // Jika statusnya Approved, tambah nilai approved_count
                let approvedCount = po.approved_count || 0;
                approvedCount++;
                await po.update({ approved_count: approvedCount }, { transaction: t })

            }

            // === APPROVED ===
            let approvedCount = po.approved_count || 0;
            approvedCount++;
            await po.update({ approved_count: approvedCount }, { transaction: t });

            // Cek apakah masih ada approver di level ini
            const sameLevelPending = await m_prospect_approval.count({
                where: {
                    prospect_id,
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
            const nextApprovers = await m_prospect_approval.count({
                where: {
                    prospect_id,
                    level: nextLevel,
                    is_active: true
                },
                transaction: t
            });

            // Jika ada level selanjutnya
            if (nextApprovers > 0) {
                await po.update({ current_approval_level: nextLevel }, { transaction: t });
                await t.commit();
                return res.json({ message: 'Prospect successfully approved, proceed to the next level' });
            }

            // === FINAL APPROVAL ===
            await po.update({ status: P_APPROVAL_STATUS.APPROVED }, { transaction: t });

            // CREATE NEW CUSTOMER
            const customer_menu_id = '0cf0f686-9b8d-434f-9274-6e5a1accf5c2';
            const codeResult = await getCodeStructure(m_customer, customer_menu_id, po.unit_bussiness_id);
            if (!codeResult?.data) {
                throw new Error("Gagal mendapatkan kode customer");
            }

            const customer = await m_customer.create({
                code: codeResult.data,
                name: po.name,
                email: po.email,
                notes: po.notes,
                top_id: po.top_id,
                name_type_id: po.name_type_id,
                contact_person: po.contact_person,
                is_active: true,
                group_id: null, // tidak ada di prospek
                pn: po.pn,
                coa_id: null, // tidak ada di prospek
                phone: po.phone,
                sales_area_id: po.sales_area_id,
                sales_id: po.sales_id,
                unit_bussiness_id: po.unit_bussiness_id,
                latitude: po.latitude,
                longitude: po.longitude
            }, { transaction: t} )

            // UPDATE DETAIL TO INSERT customer_id
            await req.models.m_customer_d_account.update(
                { customer_id: customer.id, updated_by: user.id },
                {
                    where: { prospect_id: po.id },
                    transaction: t,
                }
            )

            await req.models.m_customer_d_address.update(
                { customer_id: customer.id, updated_by: user.id },
                {
                    where: { prospect_id: po.id },
                    transaction: t,
                }
            )

            await req.models.m_customer_d_docs.update(
                { customer_id: customer.id, updated_by: user.id },
                {
                    where: { prospect_id: po.id },
                    transaction: t,
                }
            )

            await req.models.m_customer_d_itemfav.update(
                { customer_id: customer.id, updated_by: user.id },
                {
                    where: { prospect_id: po.id },
                    transaction: t,
                }
            )

            await req.models.m_customer_d_npwp.update(
                { customer_id: customer.id, updated_by: user.id },
                {
                    where: { prospect_id: po.id },
                    transaction: t,
                }
            )


            await req.models.m_customer_d_phone.update(
                { customer_id: customer.id, updated_by: user.id },
                {
                    where: { prospect_id: po.id },
                    transaction: t,
                }
            )


            await req.models.m_customer_d_restriction.update(
                { customer_id: customer.id, updated_by: user.id },
                {
                    where: { prospect_id: po.id },
                    transaction: t,
                }
            )

            await t.commit();
            return res.json({ message: 'Prospect successfully approved in final' });

        } catch (err) {
            await t.rollback();
            console.error(err);
            return res.status(500).json({ error: err.message });
        }
    }
};
