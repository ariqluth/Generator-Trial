// Controller for t_sales_order_approval
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_sales_order_approval
//
// Tambahkan custom function di bawah ini

import { Op } from "sequelize";

const SO_APPROVAL_STATUS = {
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

export const t_sales_order_approvalController = {
    // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
    async uploadImage(req, res) {
        const fileFields = Object.keys(req.models.t_sales_order_approval.rawAttributes).filter(
        key => req.models.t_sales_order_approval.rawAttributes[key].type && req.models.t_sales_order_approval.rawAttributes[key].type.key === 'STRING'
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
        const inserted = await req.models.t_sales_order_approval.create(data);
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
        const inserted = await req.models.t_sales_order_approval.bulkCreate(records);
        res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
        res.status(500).json({ error: err.message });
        }
    },

    // cek jika user punya akses untuk mengajukan SQ
    async checkCanSubmit(req, res) {
        const { grand_total, unit_bussiness_id } = req.body;
        const { m_approval, m_approval_d } = req.models;
        const user = req.user;
        const menu_id = '98d791ce-988f-41eb-90a5-77fb3aae3c48';
        // const sequelize = m_approval.sequelize;

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
                message: 'User does not have access to submit SO.'
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
                    message: 'User does not have access to submit SO. Only specific users can submit.'
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
                message: 'No users can approve this SO. Please check your approval configuration.'
            });
        }

        res.json({
            can_submit: true,
            approval_id: approval.id
        });
    },

    async requestApproval(req, res) {
        const { sales_order_id } = req.body;
        const { 
            t_sales_order, 
            m_approval, 
            m_approval_d, 
            t_sales_order_approval 
        } = req.models;
        const menu_id = '98d791ce-988f-41eb-90a5-77fb3aae3c48';
        const user = req.user;
        const sequelize = m_approval.sequelize;

        if (!sales_order_id) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const t = await sequelize.transaction();

        try {
            // 1. Ambil Sales order
            const po = await t_sales_order.findByPk(sales_order_id);
            if (!po) return res.status(404).json({ message: 'SO not found' });
            if (po.status !== SO_APPROVAL_STATUS.DRAFT && po.status !== SO_APPROVAL_STATUS.REVISED) {
                return res.status(400).json({ message: 'SO has been processed' });
            }

            // 2. Cari approval rule yg cocok
            const approval = await m_approval.findOne({
                where: {
                    menu_id,
                    min_trx: { [Op.lte]: po.grand_total },
                    max_trx: { [Op.gte]: po.grand_total },
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
                    message: 'User does not have access to submit SO.'
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
                    message: 'No approvers found for this SO. Please check your approval config.'
                });
            }

            // 4. Simpan ke t_sales_order_approval
            const approvalRecords = approvers.map(appr => ({
                so_id: po.id,
                approval_id: approval.id,
                approval_d_id: appr.id,
                user_id: appr.user_id,
                level: appr.level,
                full_approval: appr.full_approval,
                status: APPROVAL_STATUS.PENDING
            }));

            await t_sales_order_approval.bulkCreate(approvalRecords, { transaction: t });

            // 5. Update SO
            await po.update({
                status: SO_APPROVAL_STATUS.IN_APPROVAL,
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
        const { sales_order_id, status, notes } = req.body;
        const { 
            t_sales_order, 
            t_sales_order_d, 
            t_sales_quotation_d, 
            t_sales_order_approval, 
            t_reservation, 
            t_reservation_d 
        } = req.models;
        const user = req.user;
        const sequelize = t_sales_order.sequelize;

        const validStatus = ['APPROVED', 'REJECTED', 'REVISED'];
        if (!sales_order_id || !validStatus.includes(status)) {
            return res.status(400).json({ message: 'Invalid input' });
        }

        const t = await sequelize.transaction(); // Awal transaksi

        try {
            const po = await t_sales_order.findByPk(sales_order_id, {
                include: [{
                    model: t_sales_order_d,
                    as: 't_sales_order_ds'
                }],
                transaction: t
            });
            if (!po || po.status !== SO_APPROVAL_STATUS.IN_APPROVAL) {
                return res.status(400).json({ message: 'SO not found or not in approval process' });
            }

            const approvalRecord = await t_sales_order_approval.findOne({
                where: {
                    so_id: sales_order_id,
                    user_id: user.id,
                    level: po.current_approval_level,
                    status: APPROVAL_STATUS.PENDING,
                    is_active: true,
                },
                transaction: t
            });

            if (!approvalRecord) {
                return res.status(403).json({ message: 'You are not authorized to approve this SO at the current level.' });
            }

            await approvalRecord.update({
                status,
                notes,
                approved_at: new Date()
            }, { transaction: t });

            // Jika bukan APPROVED, update status dan commit transaksi
            if (SO_APPROVAL_STATUS[status] !== SO_APPROVAL_STATUS.APPROVED) {
                let revisedCount = po.revised_count || 0;
                if (status === SO_APPROVAL_STATUS.REVISED) {
                    revisedCount++;
                }
                await po.update({ status: SO_APPROVAL_STATUS[status], revised_count: revisedCount }, { transaction: t });
                await t.commit();
                return res.json({ message: `SO successfully ${status.toLowerCase()}` });
            } else {
                // Jika statusnya Approved, tambah nilai approved_count
                let approvedCount = po.approved_count || 0;
                approvedCount++;
                await po.update({ approved_count: approvedCount, reason: notes, updated_by: user.id }, { transaction: t })

            }

            // Cek apakah semua approver di level ini sudah approve
            const sameLevelPending = await t_sales_order_approval.count({
                where: {
                    so_id: sales_order_id,
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
            const nextApprovers = await t_sales_order_approval.count({
                where: {
                    so_id: sales_order_id,
                    level: nextLevel,
                    is_active: true
                },
                transaction: t
            });

            if (nextApprovers > 0) {
                // Lanjut ke level berikutnya
                await po.update({ current_approval_level: nextLevel, updated_by: user.id }, { transaction: t });
                await t.commit();
                return res.json({ message: 'SO successfully approved, proceed to the next level' });
            } else {
                // Tidak ada level berikut → SO selesai
                await po.update({ status: SO_APPROVAL_STATUS.APPROVED, reason: notes, updated_by: user.id }, { transaction: t });

                // Create reservation header
                const reservation = await t_reservation.create({
                    unit_bussiness_id: po.unit_bussiness_id,
                    so_id: po.id,
                    customer_id: po.customer_id,
                    sales_id: po.sales_id,
                    status: 0, // need book
                    date: new Date(),
                    notes: po.notes,
                    ship_to_id: po.ship_to_id,
                    unit_bussiness: po.unit_bussiness,
                    customer_name: po.customer_name,
                    ship_to_name: po.ship_to_name,
                    ship_to_address: po.ship_to_address,
                    sales: po.sales,
                    created_by: user.id,
                }, { transaction: t });

                // Create reservation details
                const details = po.t_sales_order_ds || [];
                for (const detail of details) {
                    await t_reservation_d.create({
                        reservation_id: reservation.id,
                        item_id: detail.item_id,
                        so_qty: detail.qty,
                        uom_id: detail.uom_id,
                        price: detail.price,
                        free_stock: detail.free_stock,
                        stock_booking: 0,
                        status: 0,
                        item_name: detail.item_name,
                        uom_unit: detail.uom_unit,
                        uom_value: detail.uom_value,
                    }, { transaction: t });

                    // kurangi qty pada item sales quotaion
                    const sqd = await t_sales_quotation_d.findOne({
                        where: {
                            sales_quotation_id: po.sq_id,
                            item_id: detail.item_id
                        },
                        transaction: t
                    });

                    if (!sqd) {
                        throw new Error('Sales quotation detail not found');
                    }

                    const newQty = sqd.qty - detail.qty;
                    if (newQty < 0) {
                        return res.status(400).json({ message: 'Qty item sales quotation tidak boleh kurang dari 0' });
                    }

                    await t_sales_quotation_d.update(
                        { qty: newQty },
                        {
                            where: {
                                sales_quotation_id: po.sq_id,
                                item_id: detail.item_id
                            },
                            transaction: t
                        }
                    );
                }

                await t.commit();
                return res.json({ message: 'SO successfully approved in final' });
            }
        } catch (err) {
            await t.rollback(); // rollback jika error
            return res.status(500).json({ error: err.message });
        }
    }
};
