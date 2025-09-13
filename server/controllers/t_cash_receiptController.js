// Controller for t_cash_receipt
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_cash_receipt
//
// Tambahkan custom function di bawah ini

export const t_cash_receiptController = {
    // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
    async uploadImage(req, res) {
        const fileFields = Object.keys(req.models.t_cash_receipt.rawAttributes).filter(
        key => req.models.t_cash_receipt.rawAttributes[key].type && req.models.t_cash_receipt.rawAttributes[key].type.key === 'STRING'
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
        const inserted = await req.models.t_cash_receipt.create(data);
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
        const inserted = await req.models.t_cash_receipt.bulkCreate(records);
        res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
        res.status(500).json({ error: err.message });
        }
    },

    async generateCode(req, res) {
        const params = req.query;
        const code = await getCodeStructure(req.models.t_cash_receipt, params.menu_id, params.unit_bussiness_id)
        if (code.status === 'err') {
            res.json(errorResponse(code.error))
        }
        res.json(successResponse(code.data))
    },

    async upsertCashReceipt(req, res) {
        const payload = req.body;
        const { id } = req.query;
        const { 
            t_cash_receipt, 
            t_cash_receipt_d 
        } = req.models;

        const user = req.user;
        const transaction = await t_cash_receipt.sequelize.transaction();

        try {
            let cashReceipt;
            if (id) {
                // cek apakah data sudah ada
                cashReceipt = await t_cash_receipt.findOne({
                    where: { id },
                    transaction
                });
            }

            if (cashReceipt) {
                // update header
                await cashReceipt.update({
                    code: payload.code,
                    cash_code: payload.cash_code,
                    unit_bussiness_id: payload.unit_bussiness_id,
                    type_id: payload.type_id,
                    date: payload.date,
                    status: payload.status,
                    group_id: payload.group_id,
                    coa_id: payload.coa_id,
                    si_id: payload.si_id,
                    customer_id: payload.customer_id,
                    customer_name: payload.customer_name,
                    ref_no: payload.ref_no,
                    notes: payload.notes,
                    bank_id: payload.bank_id,
                    bank_account: payload.bank_account,
                    account_number: payload.account_number,
                    giro_number: payload.giro_number,
                    giro_deadline: payload.giro_deadline,
                    employee_id: payload.employee_id,
                    employee_name: payload.employee_name,
                    updated_by: user.id
                }, { transaction });
            } else {
                // insert header
                cashReceipt = await t_cash_receipt.create({
                    code: payload.code,
                    cash_code: payload.cash_code,
                    unit_bussiness_id: payload.unit_bussiness_id,
                    type_id: payload.type_id,
                    date: payload.date,
                    status: payload.status,
                    group_id: payload.group_id,
                    coa_id: payload.coa_id,
                    si_id: payload.si_id,
                    customer_id: payload.customer_id,
                    customer_name: payload.customer_name,
                    ref_no: payload.ref_no,
                    notes: payload.notes,
                    bank_id: payload.bank_id,
                    bank_account: payload.bank_account,
                    account_number: payload.account_number,
                    giro_number: payload.giro_number,
                    giro_deadline: payload.giro_deadline,
                    employee_id: payload.employee_id,
                    employee_name: payload.employee_name,
                    created_by: user.id
                }, { transaction });
            }

            // validasi detail
            if (!payload.t_cash_receipt_d || !Array.isArray(payload.t_cash_receipt_d)) {
                throw new Error('Data detail cash receipt tidak valid');
            }

            // hitung total dari detail
            let totalAmount = 0;

            for (const detail of payload.t_cash_receipt_d) {
                if (!detail.coa_id) {
                    throw new Error('coa_id tidak boleh kosong');
                }

                const existingDetail = await t_cash_receipt_d.findOne({
                    where: {
                        cash_receipt_id: cashReceipt.id,
                        coa_id: detail.coa_id
                    },
                    transaction
                });

                if (existingDetail) {
                    await existingDetail.update({
                        description: detail.description,
                        amount: detail.amount,
                        notes: detail.notes || null
                    }, { transaction });
                } else {
                    await t_cash_receipt_d.create({
                        cash_receipt_id: cashReceipt.id,
                        coa_id: detail.coa_id,
                        description: detail.description,
                        amount: detail.amount,
                        notes: detail.notes || null
                    }, { transaction });
                }

                totalAmount += Number(detail.amount || 0);
            }

            // if (payload.status === 'posted') {}

            // update total di header
            await cashReceipt.update(
                { total: totalAmount },
                { transaction }
            );

            await transaction.commit();
            return res.status(200).json({
                message: 'Upsert cash receipt berhasil',
                data: cashReceipt
            });

        } catch (error) {
            await transaction.rollback();
            return res.status(500).json({ error: error.message, message: 'Terjadi kesalahan saat upsert cash receipt' });
        }
    }

};
