// Controller for t_credit_note
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_credit_note
//
// Tambahkan custom function di bawah ini

export const t_credit_noteController = {
    // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
    async uploadImage(req, res) {
        const fileFields = Object.keys(req.models.t_credit_note.rawAttributes).filter(
        key => req.models.t_credit_note.rawAttributes[key].type && req.models.t_credit_note.rawAttributes[key].type.key === 'STRING'
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
        const inserted = await req.models.t_credit_note.create(data);
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
        const inserted = await req.models.t_credit_note.bulkCreate(records);
        res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
        res.status(500).json({ error: err.message });
        }
    },

    async generateCode(req, res) {
        const params = req.query;
        const code = await getCodeStructure(req.models.t_credit_note, params.menu_id, params.unit_bussiness_id);
        if (code.status === 'err') {
            res.json(errorResponse(code.error))
        }
        res.json(successResponse(code.data))
    },

    async upsertCreditNote(req, res) {
        const payload = req.body;
        const { id } = req.query;
        const { t_credit_note, m_gen } = req.models;

        const user = req.user;
        const sequelize = t_credit_note.sequelize;
        const transaction = await sequelize.transaction();

        try {
            let creditNote;
            if (id) {
                // cek apakah data sudah ada
                creditNote = await t_credit_note.findOne({
                    where: { id },
                    transaction
                });
            }

            if (creditNote) {
                // update header
                await creditNote.update({
                    unit_bussiness_id: payload.unit_bussiness_id,
                    type_id: payload.type_id,
                    type_value: payload.type_value,
                    pi_id: payload.pi_id,
                    si_id: payload.si_id,
                    total: payload.total,
                    total_return: payload.total_return,
                    balance_after_cn: payload.balance_after_cn,
                    credit_coa_id: payload.credit_coa_id,
                    debit_coa_id: payload.debit_coa_id,
                    reason_id: payload.reason_id,
                    notes: payload.notes,
                    status: payload.status,
                    date: payload.date,
                    supplier_id: payload.supplier_id,
                    supplier_name: payload.supplier_name,
                    balance: payload.balance,
                    total_payment: payload.total_payment,
                    credit_amount: payload.credit_amount,
                    category_id: payload.category_id,
                    pic_id: payload.pic_id,
                    pic_name: payload.pic_name,
                    category_name: payload.category_name,
                    reason: payload.reason,
                    updated_by: user.id
                }, { transaction });
            } else {
                // insert header
                creditNote = await t_credit_note.create({
                    unit_bussiness_id: payload.unit_bussiness_id,
                    type_id: payload.type_id,
                    type_value: payload.type_value,
                    pi_id: payload.pi_id,
                    si_id: payload.si_id,
                    total: payload.total,
                    total_return: payload.total_return,
                    balance_after_cn: payload.balance_after_cn,
                    credit_coa_id: payload.credit_coa_id,
                    debit_coa_id: payload.debit_coa_id,
                    reason_id: payload.reason_id,
                    notes: payload.notes,
                    status: payload.status,
                    date: payload.date,
                    supplier_id: payload.supplier_id,
                    supplier_name: payload.supplier_name,
                    balance: payload.balance,
                    total_payment: payload.total_payment,
                    credit_amount: payload.credit_amount,
                    category_id: payload.category_id,
                    pic_id: payload.pic_id,
                    pic_name: payload.pic_name,
                    category_name: payload.category_name,
                    reason: payload.reason,
                    created_by: user.id
                }, { transaction });
            }

            if (payload.status === 'posted') {
                const typeRow = await m_gen.findOne({
                    where: {
                        id: payload.type_id,
                        group: 'm_accounting_type_note',
                    },
                    transaction
                });

                const accountingType = typeRow?.value1
                const amount = Number(payload.credit_amount || 0);

                const targetId =
                    accountingType === 'Account Receivable' ? payload.si_id :
                    accountingType === 'Account Payable' ? payload.pi_id :
                    null;

                if (accountingType && targetId && amount > 0) {
                    // panggil helper di dalam transaksi yang sama
                    await accoutingCreditAndDebitTypeAction(
                        sequelize,
                        accountingType,
                        'credit',
                        targetId,
                        amount,
                        transaction
                    );
                }
            }

            await transaction.commit();
            return res.status(200).json({
                message: 'Upsert credit note berhasil',
                data: creditNote
            });

        } catch (error) {
            await transaction.rollback();
            return res.status(500).json({ error: error.message, message: 'Terjadi kesalahan saat upsert credit note' });
        }
    }

};
