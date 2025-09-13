// Controller for t_sales_return
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_sales_return
//
// Tambahkan custom function di bawah ini

export const t_sales_returnController = {
    // Contoh: Upload gambar ke database (kolom image: Buffer/BLOB)
    async uploadImage(req, res) {
        const imageFile = req.files?.find(f => f.mimetype.startsWith('image/'));
        if (!imageFile) return res.status(400).json({ error: 'No image file found' });
        try {
        const inserted = await req.models.t_sales_return.create({ image: imageFile.buffer });
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
        const inserted = await req.models.t_sales_return.bulkCreate(records);
        res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
        res.status(500).json({ error: err.message });
        }
    },

    async generateCode(req, res) {
        const params = req.query;
        const code = await getCodeStructure(req.models.t_sales_return, params.menu_id, params.unit_bussiness_id)
        if (code.status === 'err') {
            res.json(errorResponse(code.error))
        }
        res.json(successResponse(code.data))
    },

    async customIndex(req, res) {
        const { 
            m_customer, 
            m_unit_bussiness, 
            t_sales_invoice, 
            t_sales_return, 
            t_sales_return_approval,
        } = req.models;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const menu_id = '7960edce-ac85-461a-a4d9-ce2ee9227b32';

        let searchConditions = buildSearchQuery(req.query.search || null, req.query.searchfield || null);

        let where = {};

        if (searchConditions.length > 0) {
            where[Op.or] = searchConditions;
        }

        let order = [];

        if (req.query.order_by_raw) {
            const parts = req.query.order_by_raw.split(' ');
            if (parts.length === 2) {
                const [field, direction] = parts;
                order.push([field, direction.toUpperCase()]);
            }
        } else if (req.query.order_by && req.query.order_dir) {
            order.push([req.query.order_by, req.query.order_dir.toUpperCase()]);
        }

        const include = [
            m_customer && {
                model: m_customer,
                as: 'm_customer',
                attributes: ['id', 'code', 'name']
            },
            m_unit_bussiness && {
                model: m_unit_bussiness,
                as: 'm_unit_bussiness',
                attributes: ['id', 'name']
            },
            t_sales_invoice && {
                model: t_sales_invoice,
                as: 't_sales_invoice',
                attributes: ['id', 'code']
            },
            t_sales_return_approval && {
                model: t_sales_return_approval,
                as: 't_sales_return_approvals'
            }
        ].filter(Boolean);

        where = await parseWhereQueryParam(req.query.where);

        // Proses filter_column_{model_alias}.{field}
        Object.keys(req.query).forEach(key => {
            if (key.startsWith('filter_column_')) {
                const match = key.match(/^filter_column_(.+)\.(.+)$/);
                if (match) {
                    const modelAlias = match[1];
                    const field = match[2];
                    const value = req.query[key];

                    const targetInclude = include.find(i => i.as === modelAlias);
                    if (targetInclude) {
                        if (!targetInclude.where) targetInclude.where = {};
                        targetInclude.where[field] = { [Op.iLike]: `%${value}%` };
                    }
                }
            }
        });

        const { count, rows } = await t_sales_return.findAndCountAll({
            include,
            where,
            order,
            limit,
            offset,
            distinct: true
        });

        const total = Array.isArray(count) ? count.length : count;
        const totalPages = Math.ceil(total / limit);

        return res.json({
            status: "success",
            data: rows,
            pagination: {
                total,
                page,
                totalPages,
                limit,
                currentRowsCount: rows.length,
                next_page: null,
                prev_page: null
            }
        });
    },

    // async createSalesReturn(req, res) {
    //     const { t_sales_return, t_sales_return_d } = req.models;
    //     const payload = req.body;
    //     const user = req.user;
    //     const sequelize = t_sales_return.sequelize;
    //     const transaction = await sequelize.transaction();

    //     try {
    //         // Validasi minimal
    //         if (!payload.t_sales_return_d || payload.t_sales_return_d.length === 0) {
    //             return res.status(400).json({ error: "Data detail retur tidak boleh kosong" });
    //         }

    //         // Buat header sales return
    //         const salesReturn = await t_sales_return.create({
    //             unit_bussiness_id: payload.unit_bussiness_id,
    //             return_type: payload.return_type,
    //             si_id: payload.si_id,
    //             sj_id: payload.sj_id,
    //             complain_id: payload.complain_id,
    //             date: payload.date,
    //             customer_id: payload.customer_id,
    //             customer_name: payload.customer_name,
    //             notes: payload.notes,
    //             total: 0,
    //             unit_bussiness: payload.unit_bussiness,
    //             created_by: "06da1eab-b88d-4ff2-b264-c792ab386684",
    //         }, { transaction });

    //         let total = 0;

    //         // Proses detail
    //         for (const detail of payload.t_sales_return_d) {
    //             // Validasi kuantitas return tidak boleh melebihi qty_sj
    //             if (detail.qty_return > detail.qty_sj) {
    //                 await transaction.rollback();
    //                 return res.status(400).json({
    //                     error: `Qty return untuk item "${detail.item_name}" melebihi qty SJ`,
    //                 });
    //             }

    //             let amount = detail.qty_return * detail.price;

    //             await t_sales_return_d.create({
    //                 sales_return_id: salesReturn.id,
    //                 so_id: detail.so_id,
    //                 date: detail.date,
    //                 item_id: detail.item_id,
    //                 item_name: detail.item_name,
    //                 reason_id: detail.reason_id,
    //                 qty_si: detail.qty_si,
    //                 qty_sj: detail.qty_sj,
    //                 qty_return: detail.qty_return,
    //                 uom_unit: detail.uom_unit,
    //                 uom_value: detail.uom_value,
    //                 price: detail.price,
    //                 amount,
    //             }, { transaction });

    //             total += amount;
    //         }

    //         salesReturn.total = total;
    //         await salesReturn.save({ transaction });

    //         await transaction.commit();
    //         return res.status(201).json({
    //             status: "success",
    //             data: salesReturn,
    //         });

    //     } catch (error) {
    //         await transaction.rollback();
    //         console.error("Error creating sales return:", error);
    //         return res.status(500).json({ error: "Gagal membuat sales return" });
    //     }
    // },

    // async updateSalesReturn(req, res) {
    //     const { t_sales_return, t_sales_return_d } = req.models;
    //     const { id } = req.query;
    //     const payload = req.body;
    //     const user = req.user;
    //     const sequelize = t_sales_return.sequelize;
    //     const transaction = await sequelize.transaction();

    //     try {
    //         const existing = await t_sales_return.findByPk(id, { transaction });
    //         if (!existing) {
    //             await transaction.rollback();
    //             return res.status(404).json({ error: "Sales return tidak ditemukan" });
    //         }

    //         // Update header
    //         await existing.update({
    //             unit_bussiness_id: payload.unit_bussiness_id,
    //             return_type: payload.return_type,
    //             si_id: payload.si_id,
    //             sj_id: payload.sj_id,
    //             complain_id: payload.complain_id,
    //             date: payload.date,
    //             customer_id: payload.customer_id,
    //             customer_name: payload.customer_name,
    //             notes: payload.notes,
    //             unit_bussiness: payload.unit_bussiness,
    //             updated_by: "06da1eab-b88d-4ff2-b264-c792ab386684",
    //         }, { transaction });

    //         // Hapus semua detail sebelumnya
    //         await t_sales_return_d.destroy({
    //             where: { sales_return_id: id },
    //             transaction
    //         });

    //         let total = 0;

    //         // Tambahkan detail baru
    //         for (const detail of payload.t_sales_return_d) {
    //             if (detail.qty_return > detail.qty_sj) {
    //                 await transaction.rollback();
    //                 return res.status(400).json({
    //                     error: `Qty return untuk item "${detail.item_name}" melebihi qty SJ`,
    //                 });
    //             }

    //             let amount = detail.qty_return * detail.price;

    //             await t_sales_return_d.create({
    //                 sales_return_id: id,
    //                 so_id: detail.so_id,
    //                 date: detail.date,
    //                 item_id: detail.item_id,
    //                 item_name: detail.item_name,
    //                 reason_id: detail.reason_id,
    //                 qty_si: detail.qty_si,
    //                 qty_sj: detail.qty_sj,
    //                 qty_return: detail.qty_return,
    //                 uom_unit: detail.uom_unit,
    //                 uom_value: detail.uom_value,
    //                 price: detail.price,
    //                 amount,
    //             }, { transaction });

    //             total += amount;
    //         }

    //         existing.total = total;
    //         await existing.save({ transaction });

    //         await transaction.commit();
    //         return res.status(200).json({
    //             status: "success",
    //             data: existing,
    //         });

    //     } catch (error) {
    //         await transaction.rollback();
    //         console.error("Error updating sales return:", error);
    //         return res.status(500).json({ error: "Gagal mengupdate sales return" });
    //     }
    // },

    async createSalesReturn(req, res) {
        const { t_sales_return, t_sales_return_d, t_sales_invoice_d } = req.models;
        const payload = req.body;
        const user = req.user;
        const sequelize = t_sales_return.sequelize;
        const transaction = await sequelize.transaction();

        try {
            // Validasi minimal
            if (!payload.t_sales_return_d || payload.t_sales_return_d.length === 0) {
                return res.status(400).json({ error: "Data detail retur tidak boleh kosong" });
            }

            // Buat header sales return
            const salesReturn = await t_sales_return.create({
                unit_bussiness_id: payload.unit_bussiness_id,
                return_type: payload.return_type,
                si_id: payload.si_id,
                sj_id: payload.sj_id,
                complain_id: payload.complain_id,
                date: payload.date,
                customer_id: payload.customer_id,
                customer_name: payload.customer_name,
                notes: payload.notes,
                total: 0,
                dpp: 0,
                dpp2: 0,
                ppn: 0,
                grand_total: 0,
                unit_bussiness: payload.unit_bussiness,
                created_by: user.id,
            }, { transaction });

            let total = 0, dpp = 0, dpp2 = 0, ppn = 0, grandTotal = 0;

            // Proses detail
            for (const detail of payload.t_sales_return_d) {
                // Validasi kuantitas return tidak boleh melebihi qty_sj
                if (detail.qty_return > detail.qty_sj) {
                    await transaction.rollback();
                    return res.status(400).json({
                        error: `Qty return untuk item "${detail.item_name}" melebihi qty SJ`,
                    });
                }

                // Ambil referensi data dari sales invoice detail untuk hitung pajak/dpp
                const invoiceDetail = await t_sales_invoice_d.findOne({
                    where: { item_id: detail.item_id, sales_invoice_id: payload.si_id },
                    transaction
                });

                if (!invoiceDetail) {
                    await transaction.rollback();
                    return res.status(400).json({
                        error: `Item ${detail.item_name} tidak ditemukan di Sales Invoice`
                    });
                }

                // Hitung amount, dpp, dpp2, tax, total sesuai qty return
                const amount = detail.qty_return * detail.price;

                // Skalakan dari invoice detail (pro-rata berdasarkan qty return)
                const factor = detail.qty_return / invoiceDetail.qty_inv;
                const dppDetail = parseFloat((invoiceDetail.dpp * factor).toFixed(2));
                const dpp2Detail = parseFloat((invoiceDetail.dpp2 * factor).toFixed(2));
                const ppnDetail = parseFloat((invoiceDetail.total_tax * factor).toFixed(2));
                const totalDetail = parseFloat((dppDetail + ppnDetail).toFixed(2));

                await t_sales_return_d.create({
                    sales_return_id: salesReturn.id,
                    so_id: detail.so_id,
                    date: detail.date,
                    item_id: detail.item_id,
                    item_name: detail.item_name,
                    reason_id: detail.reason_id,
                    qty_si: detail.qty_si,
                    qty_sj: detail.qty_sj,
                    qty_return: detail.qty_return,
                    uom_unit: detail.uom_unit,
                    uom_value: detail.uom_value,
                    price: detail.price,
                    amount,
                    dpp: dppDetail,
                    dpp2: dpp2Detail,
                    total_tax: ppnDetail,
                    total: totalDetail,
                }, { transaction });

                // Akumulasi ke header
                total += amount;
                dpp += dppDetail;
                dpp2 += dpp2Detail;
                ppn += ppnDetail;
                grandTotal += totalDetail;
            }

            // Update header
            salesReturn.total = parseFloat(total.toFixed(2));
            salesReturn.dpp = parseFloat(dpp.toFixed(2));
            salesReturn.dpp2 = parseFloat(dpp2.toFixed(2));
            salesReturn.ppn = parseFloat(ppn.toFixed(2));
            salesReturn.grand_total = parseFloat(grandTotal.toFixed(2));

            await salesReturn.save({ transaction });

            await transaction.commit();
            return res.status(201).json({
                status: "success",
                data: salesReturn,
            });

        } catch (error) {
            await transaction.rollback();
            console.error("Error creating sales return:", error.message);
            return res.status(500).json({ error: "Gagal membuat sales return" });
        }
    },

    async updateSalesReturn(req, res) {
        const { t_sales_return, t_sales_return_d, t_sales_invoice_d } = req.models;
        const { id } = req.query;
        const payload = req.body;
        const user = req.user;
        const sequelize = t_sales_return.sequelize;
        const transaction = await sequelize.transaction();

        try {
            const existing = await t_sales_return.findByPk(id, { transaction });
            if (!existing) {
                await transaction.rollback();
                return res.status(404).json({ error: "Sales return tidak ditemukan" });
            }

            // Update header (sementara nolkan dulu dpp/dpp2/ppn/total, nanti dihitung ulang)
            await existing.update({
                unit_bussiness_id: payload.unit_bussiness_id,
                return_type: payload.return_type,
                si_id: payload.si_id,
                sj_id: payload.sj_id,
                complain_id: payload.complain_id,
                date: payload.date,
                customer_id: payload.customer_id,
                customer_name: payload.customer_name,
                notes: payload.notes,
                unit_bussiness: payload.unit_bussiness,
                updated_by: user.id,
                total: 0,
                dpp: 0,
                dpp2: 0,
                ppn: 0,
                grand_total: 0,
            }, { transaction });

            // Hapus semua detail sebelumnya
            await t_sales_return_d.destroy({
                where: { sales_return_id: id },
                transaction
            });

            let total = 0, dpp = 0, dpp2 = 0, ppn = 0, grandTotal = 0;

            // Tambahkan detail baru
            for (const detail of payload.t_sales_return_d) {
                if (detail.qty_return > detail.qty_sj) {
                    await transaction.rollback();
                    return res.status(400).json({
                        error: `Qty return untuk item "${detail.item_name}" melebihi qty SJ`,
                    });
                }

                // Ambil referensi data dari sales invoice detail
                const invoiceDetail = await t_sales_invoice_d.findOne({
                    where: { item_id: detail.item_id, sales_invoice_id: payload.si_id },
                    transaction
                });

                if (!invoiceDetail) {
                    await transaction.rollback();
                    return res.status(400).json({
                        error: `Item ${detail.item_name} tidak ditemukan di Sales Invoice`
                    });
                }

                // Hitung amount, dpp, dpp2, ppn, total (pro-rata)
                const amount = detail.qty_return * detail.price;
                const factor = detail.qty_return / invoiceDetail.qty_inv;

                const dppDetail = parseFloat((invoiceDetail.dpp * factor).toFixed(2));
                const dpp2Detail = parseFloat((invoiceDetail.dpp2 * factor).toFixed(2));
                const ppnDetail = parseFloat((invoiceDetail.total_tax * factor).toFixed(2));
                const totalDetail = parseFloat((dppDetail + ppnDetail).toFixed(2));

                await t_sales_return_d.create({
                    sales_return_id: id,
                    so_id: detail.so_id,
                    date: detail.date,
                    item_id: detail.item_id,
                    item_name: detail.item_name,
                    reason_id: detail.reason_id,
                    qty_si: detail.qty_si,
                    qty_sj: detail.qty_sj,
                    qty_return: detail.qty_return,
                    uom_unit: detail.uom_unit,
                    uom_value: detail.uom_value,
                    price: detail.price,
                    amount,
                    dpp: dppDetail,
                    dpp2: dpp2Detail,
                    total_tax: ppnDetail,
                    total: totalDetail,
                }, { transaction });

                // Akumulasi ke header
                total += amount;
                dpp += dppDetail;
                dpp2 += dpp2Detail;
                ppn += ppnDetail;
                grandTotal += totalDetail;
            }

            // Update hasil perhitungan ke header
            existing.total = parseFloat(total.toFixed(2));
            existing.dpp = parseFloat(dpp.toFixed(2));
            existing.dpp2 = parseFloat(dpp2.toFixed(2));
            existing.ppn = parseFloat(ppn.toFixed(2));
            existing.grand_total = parseFloat(grandTotal.toFixed(2));

            await existing.save({ transaction });

            await transaction.commit();
            return res.status(200).json({
                status: "success",
                data: existing,
            });

        } catch (error) {
            await transaction.rollback();
            console.error("Error updating sales return:", error);
            return res.status(500).json({ error: "Gagal mengupdate sales return" });
        }
    }

};
