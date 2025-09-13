// Controller for t_surat_jalan_return
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_surat_jalan_return
//
// Tambahkan custom function di bawah ini

export const t_surat_jalan_returnController = {
    // Contoh: Upload gambar ke database (kolom image: Buffer/BLOB)
    async uploadImage(req, res) {
        const imageFile = req.files?.find(f => f.mimetype.startsWith('image/'));
        if (!imageFile) return res.status(400).json({ error: 'No image file found' });
        try {
        const inserted = await req.models.t_surat_jalan_return.create({ image: imageFile.buffer });
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
        const inserted = await req.models.t_surat_jalan_return.bulkCreate(records);
        res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
        res.status(500).json({ error: err.message });
        }
    },

    async generateCode(req, res) {
        const params = req.query;
        const code = await getCodeStructure(req.models.t_surat_jalan_return, params.menu_id, params.unit_bussiness_id)
        if (code.status === 'err') {
            res.json(errorResponse(code.error))
        }
        res.json(successResponse(code.data))
    },

    async upsertSuratJalanReturn(req, res) {
        const payload = req.body;
        const {
            t_surat_jalan,
            t_surat_jalan_return,
            m_warehouse
        } = req.models;

        const user = req.user;
        const transaction = await t_surat_jalan_return.sequelize.transaction();

        try {
            // Validasi sj_id terlebih dahulu
            if (!payload.sj_id) {
                throw new Error('sj_id tidak boleh kosong');
            }

            // Ambil data surat jalan
            const suratJalan = await t_surat_jalan.findOne({ where: { id: payload.sj_id } });
            if (!suratJalan) {
                return res.status(404).json({ message: 'Surat Jalan tidak ditemukan' });
            }

            // Cek apakah surat jalan return sudah ada
            let sjReturn = await t_surat_jalan_return.findOne({
                where: { sj_id: payload.sj_id },
                transaction
            });

            if (sjReturn) {
                await sjReturn.update({
                    unit_bussiness_id: payload.unit_bussiness_id,
                    status: payload.status,
                    date: payload.date,
                    unit_bussiness: payload.unit_bussiness,
                    customer_name: payload.customer_name,
                    delivery_area: payload.delivery_area,
                    expedition_type: payload.expedition_type,
                    nopol: payload.nopol,
                    expedition: payload.expedition,
                    vehicle: payload.vehicle,
                    driver: payload.driver,
                    customer_id: suratJalan.customer_id,
                    notes: payload.notes,
                    updated_by: user.id,
                    // updated_by: "06da1eab-b88d-4ff2-b264-c792ab386684",
                }, { transaction });

                // await req.models.t_surat_jalan_return_d.destroy({
                //     where: { surat_jalan_return_id: sjReturn.id },
                //     transaction
                // });
            } else {
                sjReturn = await t_surat_jalan_return.create({
                    sj_id: payload.sj_id,
                    unit_bussiness_id: payload.unit_bussiness_id,
                    status: payload.status,
                    date: payload.date,
                    unit_bussiness: payload.unit_bussiness,
                    customer_name: payload.customer_name,
                    delivery_area: payload.delivery_area,
                    expedition_type: payload.expedition_type,
                    nopol: payload.nopol,
                    expedition: payload.expedition,
                    vehicle: payload.vehicle,
                    driver: payload.driver,
                    customer_id: suratJalan.customer_id,
                    notes: payload.notes,
                    created_by: user.id,
                    // created_by: "06da1eab-b88d-4ff2-b264-c792ab386684"
                }, { transaction });
            }

            let warehouse = null;
            if (payload.status === 2) {
                warehouse = await m_warehouse.findOne({
                    where: { unit_bussiness_id: payload.unit_bussiness_id },
                    transaction
                });
                if (!warehouse) {
                    throw new Error('Gudang tidak ditemukan');
                }
            }

            // Validasi t_surat_jalan_return_d
            if (!payload.t_surat_jalan_return_d || !Array.isArray(payload.t_surat_jalan_return_d)) {
                throw new Error('Data detail surat jalan return tidak valid');
            }

            let totalAmount = 0;
            for (const detail of payload.t_surat_jalan_return_d) {
                // Validasi detail
                if (!detail.item_id) {
                    throw new Error('item_id tidak boleh kosong');
                }
                
                const existingDetail = await req.models.t_surat_jalan_return_d.findOne({
                    where: {
                        surat_jalan_return_id: sjReturn.id,
                        item_id: detail.item_id
                    },
                    transaction
                });

                if (existingDetail) {
                    await existingDetail.update({
                        qty_sj: detail.qty_sj,
                        qty_return: detail.qty_return,
                        notes: detail.notes || null,
                        item_name: detail.item_name || null,
                        uom_unit: detail.uom_unit,
                        uom_value: detail.uom_value
                    }, { transaction });
                } else {
                    await req.models.t_surat_jalan_return_d.create({
                        surat_jalan_return_id: sjReturn.id,
                        item_id: detail.item_id,
                        qty_sj: detail.qty_sj,
                        qty_return: detail.qty_return,
                        notes: detail.notes || null,
                        item_name: detail.item_name || null,
                        uom_unit: detail.uom_unit,
                        uom_value: detail.uom_value
                    }, { transaction });
                }

                // Handle stock update only if status = 2
                if (payload.status === 2) {
                    const { Sequelize } = req.models.t_surat_jalan_d.sequelize;

                    // Update qty_return dan kurangi qty di t_surat_jalan_d
                    await req.models.t_surat_jalan_d.update(
                        {
                            qty_return: Sequelize.literal(`qty_return + ${detail.qty_return}`),
                            qty: Sequelize.literal(`qty - ${detail.qty_return}`)
                        },
                        {
                            where: {
                                surat_jalan_id: payload.sj_id,
                                item_id: detail.item_id,
                            },
                            transaction
                        }
                    );

                    const inventoryQty = detail.qty_return * (detail.uom_value ?? 1);

                    const resultCOGS = await inventoryService.getCOGS(detail.item_id, warehouse.id, transaction);

                    await inventoryService.insertStock({
                        item_id: detail.item_id,
                        warehouse_id: warehouse.id,
                        quantity: inventoryQty,
                        transactionTypeName: "SALES_RETURN",
                        unitCost: resultCOGS,
                        reference_id: sjReturn.id,
                        reference_source: 't_surat_jalan_return',
                        batchNumber: sjReturn.code,
                    });

                    totalAmount += resultCOGS * inventoryQty;
                }
            }

            // Buat jurnal hanya kalau status = 2
            if (payload.status === 2) {
                await accountingService.createJournal(
                    {
                        unit_bussiness_id: sjReturn.unit_bussiness_id,
                        reference_id: sjReturn.id,
                        reference_type: "SURAT_JALAN_RETURN",
                        reference_no: sjReturn.code,
                        date: sjReturn.date,
                        entity_id: sjReturn.customer_id,
                        entity_type: "m_customer",
                        created_by: user.id,
                        details: [
                            {
                                variable: "var_Persediaan",
                                debit: totalAmount,
                                credit: 0,
                                notes: "Transaksi Surat Jalan Return",
                            },
                            {
                                variable: "var_HPP",
                                debit: 0,
                                credit: totalAmount,
                                notes: "Transaksi Surat Jalan Return",
                            },
                        ],
                    },
                    { transaction }
                );
            }

            await transaction.commit();
            return res.status(200).json({
                message: 'Upsert surat jalan return berhasil',
                data: sjReturn
            });

        } catch (error) {
            console.log("error", error)
            await transaction.rollback();
            // return res.status(500).json({ message: 'Terjadi kesalahan saat upsert surat jalan return' });
            return res.status(500).json({ message: error.message });
        }
    }


};
