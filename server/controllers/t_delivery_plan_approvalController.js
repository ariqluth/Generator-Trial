// Controller for t_delivery_plan_approval
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_delivery_plan_approval
//
// Tambahkan custom function di bawah ini

import { Op } from "sequelize";

const DP_APPROVAL_STATUS = {
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

export const t_delivery_plan_approvalController = {
    // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
    async uploadImage(req, res) {
        const fileFields = Object.keys(req.models.t_delivery_plan_approval.rawAttributes).filter(
        key => req.models.t_delivery_plan_approval.rawAttributes[key].type && req.models.t_delivery_plan_approval.rawAttributes[key].type.key === 'STRING'
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
        const inserted = await req.models.t_delivery_plan_approval.create(data);
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
        const inserted = await req.models.t_delivery_plan_approval.bulkCreate(records);
        res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
        res.status(500).json({ error: err.message });
        }
    },

    // cek jika user punya akses untuk mengajukan DP
    async checkCanSubmit(req, res) {
        const { grand_total, unit_bussiness_id } = req.body;
        const { m_approval, m_approval_d } = req.models;
        const user = req.user;
        const menu_id = 'bd51df02-dcaa-49ed-b415-b8dbf26d17ab';
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
                message: 'User does not have access to submit DP.'
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
                    message: 'User does not have access to submit DP. Only specific users can submit.'
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
                message: 'No users can approve this DP. Please check your approval configuration.'
            });
        }

        res.json({
            can_submit: true,
            approval_id: approval.id
        });
    },

    async requestApproval(req, res) {
        const { delivery_plan_id } = req.body;
        const user = req.user;
        const { 
            t_delivery_plan, 
            m_approval, 
            m_approval_d, 
            t_delivery_plan_approval 
        } = req.models;
        const menu_id = 'bd51df02-dcaa-49ed-b415-b8dbf26d17ab';
        const sequelize = m_approval.sequelize;

        if (!delivery_plan_id) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const t = await sequelize.transaction();

        try {
            // 1. Ambil Sales order
            const po = await t_delivery_plan.findByPk(delivery_plan_id);
            if (!po) return res.status(404).json({ message: 'Delivery plan not found' });
            if (po.status !== DP_APPROVAL_STATUS.DRAFT && po.status !== DP_APPROVAL_STATUS.REVISED) {
                return res.status(400).json({ message: 'Delivery plan has been processed' });
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
                    message: 'User does not have access to submit delivery plan.'
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
                    message: 'No approvers found for this delivery plan. Please check your approval config.'
                });
            }

            // 4. Simpan ke t_delivery_plan_approval
            const approvalRecords = approvers.map(appr => ({
                dp_id: po.id,
                approval_id: approval.id,
                approval_d_id: appr.id,
                user_id: appr.user_id,
                level: appr.level,
                full_approval: appr.full_approval,
                status: APPROVAL_STATUS.PENDING
            }));

            await t_delivery_plan_approval.bulkCreate(approvalRecords, { transaction: t });

            // 5. Update SQ
            await po.update({
                status: DP_APPROVAL_STATUS.IN_APPROVAL,
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
        const { delivery_plan_id, status, notes } = req.body;
        // const { delivery_plan_id, auth_user_id, status, notes } = req.body;
        const user = req.user;
        const { 
            t_delivery_plan, 
            t_delivery_plan_d, 
            t_delivery_plan_d_item, 
            t_delivery_plan_approval, 
            t_reservation, 
            t_reservation_d, 
            t_sales_order_d
        } = req.models;
        const sequelize = t_delivery_plan.sequelize;

        const validStatus = ['APPROVED', 'REJECTED', 'REVISED'];
        if (!delivery_plan_id || !validStatus.includes(status)) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const t = await sequelize.transaction(); // Awal transaksi

        try {
            const po = await t_delivery_plan.findByPk(delivery_plan_id, {
                include: [{
                    model: t_delivery_plan_d,
                    as: 't_delivery_plan_ds',
                    include: [
                        {
                            model: t_delivery_plan_d_item,
                            as: 't_delivery_plan_d_items'
                        }
                    ]
                }],
                transaction: t
            });

            if (!po || po.status !== DP_APPROVAL_STATUS.IN_APPROVAL) {
                return res.status(400).json({ message: 'Delivery plan not found or not in approval process' });
            }

            if (!po.t_delivery_plan_ds?.length) {
                return res.status(400).json({ message: 'No delivery plan details found' });
            }

            const approvalRecord = await t_delivery_plan_approval.findOne({
                where: {
                    dp_id: delivery_plan_id,
                    // user_id: auth_user_id,
                    user_id: user.id,
                    level: po.current_approval_level,
                    status: APPROVAL_STATUS.PENDING,
                    is_active: true,
                },
                transaction: t
            });

            if (!approvalRecord) {
                return res.status(403).json({ message: 'You are not authorized to approve this delivery plan at the current level.' });
            }

            await approvalRecord.update({
                status,
                notes,
                approved_at: new Date()
            }, { transaction: t });

            // Jika bukan APPROVED, update status dan commit transaksi
            if (DP_APPROVAL_STATUS[status] !== DP_APPROVAL_STATUS.APPROVED) {
                let revisedCount = po.revised_count || 0;
                if (status === DP_APPROVAL_STATUS.REVISED) {
                    revisedCount++;
                }
                await po.update({ status: DP_APPROVAL_STATUS[status], revised_count: revisedCount }, { transaction: t });
                await t.commit();
                return res.json({ message: `Delivery plan successfully ${status.toLowerCase()}` });
            } else {
                // Jika statusnya Approved, tambah nilai approved_count
                let approvedCount = po.approved_count || 0;
                approvedCount++;
                await po.update({ approved_count: approvedCount }, { transaction: t })

            }

            // Cek apakah semua approver di level ini sudah approve
            const sameLevelPending = await t_delivery_plan_approval.count({
                where: {
                    dp_id: delivery_plan_id,
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
            const nextApprovers = await t_delivery_plan_approval.count({
                where: {
                    dp_id: delivery_plan_id,
                    level: nextLevel,
                    is_active: true
                },
                transaction: t
            });

            if (nextApprovers > 0) {
                await po.update({ current_approval_level: nextLevel }, { transaction: t });
                await t.commit();
                return res.json({ message: 'Delivery plan successfully approved, proceed to the next level' });
            } else {
                await po.update({ status: DP_APPROVAL_STATUS.APPROVED }, { transaction: t });

                // Ambil semua reservation detail yang dibutuhkan dalam satu query
                const reservationMap = new Map();
                const allReservationDs = await t_reservation_d.findAll({
                    include: [
                        {
                            model: t_reservation,
                            as: 't_reservation',
                            where: {
                                so_id: { [Op.in]: po.t_delivery_plan_ds.map(d => d.so_id) },
                                status: { [Op.in]: [1, 2] }, // optional: filter status di sini
                            }
                        }
                    ],
                    where: {
                        item_id: {
                            [Op.in]: po.t_delivery_plan_ds.flatMap(d => d.t_delivery_plan_d_items.map(i => i.item_id))
                        }
                    },
                    transaction: t
                });

                // Masukkan ke dalam Map untuk pencarian cepat
                for (const res of allReservationDs) {
                    const so_id = res.t_reservation.so_id;
                    reservationMap.set(`${so_id}_${res.item_id}`, res);
                }

                // Dalam loop:
                for (const detail of po.t_delivery_plan_ds) {
                    for (const item of detail.t_delivery_plan_d_items) {
                        const key = `${detail.so_id}_${item.item_id}`;
                        const reservation_d = reservationMap.get(key);

                        if (typeof reservation_d.stock_booking !== 'number' || isNaN(reservation_d.stock_booking)) {
                            throw new Error(`Nilai stock_booking tidak valid untuk item ${item.item_id}`);
                        }
                        if (typeof item.qty_so !== 'number' || isNaN(item.qty_so)) {
                            throw new Error(`Qty pengiriman tidak valid untuk item ${item.item_id}`);
                        }

                        if (!reservation_d) {
                            throw new Error(`Reservation untuk item ${item.item_id} tidak ditemukan`);
                        }

                        if (reservation_d.so_qty < item.qty_so || reservation_d.stock_booking < item.qty) {
                            throw new Error(`Qty pengiriman melebihi stok pada reservation (Item: ${item.item_id})`);
                        }

                        reservation_d.so_qty -= item.qty_dp;
                        reservation_d.stock_booking -= item.qty_dp;

                        await reservation_d.save({ transaction: t });

                        // Kurangi juga dari sales order detail
                        await t_sales_order_d.update(
                            {
                                qty: sequelize.literal(`qty - ${item.qty_dp}`) // kurangi sesuai qty_dp
                            },
                            {
                                where: {
                                    so_id: detail.so_id,
                                    item_id: item.item_id
                                },
                                transaction: t
                            }
                        );
                    }
                }

                await t.commit();
                return res.json({ message: 'Delivery plan successfully approved in final' });
            }
        } catch (err) {
            await t.rollback(); // rollback jika error
            return res.status(500).json({ error: err.message });
        }
    }
};
