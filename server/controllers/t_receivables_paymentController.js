// Controller for t_receivables_payment
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_receivables_payment
//
// Tambahkan custom function di bawah ini

export const t_receivables_paymentController = {
    // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
    async uploadImage(req, res) {
        const fileFields = Object.keys(req.models.t_receivables_payment.rawAttributes).filter(
        key => req.models.t_receivables_payment.rawAttributes[key].type && req.models.t_receivables_payment.rawAttributes[key].type.key === 'STRING'
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
        const inserted = await req.models.t_receivables_payment.create(data);
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
        const inserted = await req.models.t_receivables_payment.bulkCreate(records);
        res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
        res.status(500).json({ error: err.message });
        }
    },

    async generateCode(req, res) {
        const params = req.query;
        const code = await getCodeStructure(req.models.t_receivables_payment, params.menu_id, params.unit_bussiness_id)
        if (code.status === 'err') {
            res.json(errorResponse(code.error))
        }
        res.json(successResponse(code.data))
    },

    async upsertReceivablesPayment(req, res) {
        const payload = req.body;
        const { id } = req.query;
        const { 
            t_receivables_payment, 
            t_receivables_payment_d, 
            t_sales_invoice
        } = req.models;

        const user = req.user;
        const sequelize = t_receivables_payment.sequelize;
        const transaction = await sequelize.transaction();

        try {
            let receivablePayment;
            if (id) {
                // cek apakah data header sudah ada
                receivablePayment = await t_receivables_payment.findOne({
                    where: { id },
                    transaction
                });
            }

            if (receivablePayment) {
                // update header
                await receivablePayment.update({
                    unit_bussiness_id: payload.unit_bussiness_id,
                    type_id: payload.type_id,
                    date: payload.date,
                    status: payload.status,
                    coa_id: payload.coa_id,
                    customer_id: payload.customer_id,
                    customer_name: payload.customer_name,
                    total_si: payload.total_si,
                    difference: payload.difference,
                    notes: payload.notes,
                    updated_by: user.id
                }, { transaction });
            } else {
                // insert header
                receivablePayment = await t_receivables_payment.create({
                    unit_bussiness_id: payload.unit_bussiness_id,
                    type_id: payload.type_id,
                    date: payload.date,
                    status: payload.status,
                    coa_id: payload.coa_id,
                    customer_id: payload.customer_id,
                    customer_name: payload.customer_name,
                    total_si: payload.total_si,
                    difference: payload.difference,
                    notes: payload.notes,
                    created_by: user.id
                }, { transaction });
            }

            // validasi detail
            if (!payload.t_receivables_payment_d || !Array.isArray(payload.t_receivables_payment_d)) {
                throw new Error('Data detail receivables payment tidak valid');
                // return res.status(400).json({ message: 'Data detail receivables payment tidak valid' });
            }

            // hitung total dari detail
            let totalInvoice = 0;
            let totalPayment = 0;
            let totalDifference = 0;

            for (const detail of payload.t_receivables_payment_d) {
                if (!detail.si_id) {
                    throw new Error('si_id tidak boleh kosong');
                    // return res.status(400).json({ message: 'si_id tidak boleh kosong' });
                }

                // cek apakah Sales Invoice ada
                const salesInvoice = await t_sales_invoice.findOne({
                    where: { id: detail.si_id },
                    transaction
                });

                if (!salesInvoice) {
                    throw new Error(`Sales Invoice tidak ditemukan`);
                    // return res.status(404).json({ message: `Sales Invoice tidak ditemukan`});
                }

                if (payload.status === 'posted') {
                    // Kurangi grand total Sales Invoice
                    await salesInvoice.update(
                        {
                            grand_total: sequelize.literal(`grand_total - ${detail.total_payment}`),
                        },
                        { transaction }
                    );
                }

                const existingDetail = await t_receivables_payment_d.findOne({
                    where: {
                        receivables_payment_id: receivablePayment.id,
                        si_id: detail.si_id
                    },
                    transaction
                });

                if (existingDetail) {
                    await existingDetail.update({
                        total_si: detail.total_si,
                        total_paid: detail.total_paid,
                        total_remaining: detail.total_remaining,
                        total_payment: detail.total_payment,
                        difference: detail.difference,
                        notes: detail.notes || null
                    }, { transaction });
                } else {
                    await t_receivables_payment_d.create({
                        receivables_payment_id: receivablePayment.id,
                        si_id: detail.si_id,
                        total_si: detail.total_si,
                        total_paid: detail.total_paid,
                        total_remaining: detail.total_remaining,
                        total_payment: detail.total_payment,
                        difference: detail.difference,
                        notes: detail.notes || null
                    }, { transaction });
                }

                totalInvoice += Number(detail.total_si || 0);
                totalPayment += Number(detail.total_payment || 0);
                totalDifference += Number(detail.difference || 0);
            }

            // update total di header
            await receivablePayment.update(
                { 
                    total_si: totalInvoice,
                    total_payment: totalPayment,
                    difference: totalDifference
                },
                { transaction }
            );

            await transaction.commit();
            return res.status(200).json({
                message: 'Upsert receivables payment berhasil',
                data: receivablePayment
            });

        } catch (error) {
            await transaction.rollback();
            return res.status(500).json({ error: error.message, message: 'Terjadi kesalahan saat upsert receivables payment' });
        }
    }


};
