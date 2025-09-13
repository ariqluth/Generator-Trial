// Controller for t_purchase_return
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_purchase_return
//
// Tambahkan custom function di bawah ini

import { Op } from "sequelize";

export const t_purchase_returnController = {
    // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
    async uploadImage(req, res) {
        const fileFields = Object.keys(req.models.t_purchase_return.rawAttributes).filter(
            key => req.models.t_purchase_return.rawAttributes[key].type && req.models.t_purchase_return.rawAttributes[key].type.key === 'STRING'
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
            const inserted = await req.models.t_purchase_return.create(data);
            res.json({ message: 'Image uploaded', data: inserted });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async patchFileById(req, res) {
        try {
            const { t_purchase_return } = req.models;
            const file = req.files[0]

            const data = {}
            data[file.fieldname] = removeLocalPath(file.path)

            await t_purchase_return.update(data, { where: { id: req.body.id } });
            res.status(200).json({ status: 'success' })
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
            const inserted = await req.models.t_purchase_return.bulkCreate(records);
            res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async generateCode(req, res) {
        const params = req.query;
        const code = await getCodeStructure(req.models.t_purchase_return, params.menu_id, params.unit_bussiness_id)
        if (code.status === 'err') {
            res.json(errorResponse(code.error))
        }
        res.json(successResponse(code.data))
    },

    async removeInventory(req, res) {
        const {
            item_id,
            warehouse_id,
            quantity,
            transactionTypeName,
            unitCost,
            reference_id,
            reference_source,
            batchNumber,
            expirationDate
        } = req.body;

        const result = await inventoryService.insertStock({
            item_id,
            warehouse_id,
            quantity,
            transactionTypeName,
            unitCost: unitCost || null,
            reference_id: reference_id || null,
            reference_source: reference_source || null,
            batchNumber: batchNumber || null,
            expirationDate: expirationDate || null,
        });

        if (result.status === 'err') {
            res.json(errorResponse(result.error));
        }
        res.json(successResponse(result.data));
    },

    // async customIndex(req, res) {
    //     const { m_gen, t_penerimaan_barang, m_unit_bussiness, m_supplier, t_purchase_return, t_purchase_return_approval, m_approval, m_approval_d } = req.models;
    //     const page = parseInt(req.query.page) || 1;
    //     const limit = parseInt(req.query.paginate) || 10;
    //     const offset = (page - 1) * limit;

    //     let searchConditions = buildSearchQuery(req.query.search || null, req.query.searchfield || null);

    //     const where = {};

    //     if (searchConditions.length > 0) {
    //         where[Op.or] = searchConditions;
    //     }

    //     let order = [];

    //     if (req.query.order_by_raw) {
    //         const parts = req.query.order_by_raw.split(' ');
    //         if (parts.length === 2) {
    //             const [field, direction] = parts;
    //             order.push([field, direction.toUpperCase()]);
    //         }
    //     } else if (req.query.order_by && req.query.order_dir) {
    //         order.push([req.query.order_by, req.query.order_dir.toUpperCase()]);
    //     }

    //     const include = [
    //         {
    //             model: m_gen,
    //             as: 'prtReturnOption',
    //             attributes: ['id', 'value1']
    //         },
    //         {
    //             model: t_penerimaan_barang,
    //             as: 'prtPenerimaanBarang',
    //             include: [
    //                 {
    //                     model: m_unit_bussiness,
    //                     as: 'pbCompany',
    //                     attributes: ['id', 'name'],
    //                 },
    //                 {
    //                     model: m_supplier,
    //                     as: 'pbSupplier',
    //                     attributes: ['id', 'name'],
    //                 },
    //             ]
    //         },
    //     ];


    //     if (req.query.auth_user_id && req.query.menu_id) {
    //         // Cek role user
    //         const checkAprrovalRole = await m_approval_d.findOne({
    //             where: {
    //                 user_id: req.query.auth_user_id,
    //                 type: 'menyetujui'
    //             },
    //             include: [{
    //                 model: m_approval,
    //                 where: {
    //                     menu_id: req.query.menu_id
    //                 },
    //                 attributes: []
    //             }]
    //         });
    //         if (checkAprrovalRole) {
    //             include.push({
    //                 model: t_purchase_return_approval,
    //                 as: 'preApprovals',
    //                 attributes: ['id', 'user_id', 'status', 'full_approval'],
    //                 required: true,
    //                 where: {
    //                     user_id: req.query.auth_user_id,
    //                     is_active: true,
    //                 }
    //             });
    //         }
    //     }

    //     if (req.query.unit_bussiness_id) {
    //         where.unit_bussiness_id = {
    //             [Op.eq]: req.query.unit_bussiness_id
    //         };
    //     }
    //     if (req.query.status) {
    //         where.status = {
    //             [Op.eq]: req.query.status
    //         };
    //     }

    //     const { count, rows } = await t_purchase_return.findAndCountAll({
    //         include,
    //         where,
    //         order,
    //         limit,
    //         offset
    //     });

    //     const total = Array.isArray(count) ? count.length : count;
    //     const totalPages = Math.ceil(total / limit);

    //     return res.json({
    //         status: "success",
    //         data: rows,
    //         pagination: {
    //             total,
    //             page,
    //             totalPages,
    //             limit,
    //             currentRowsCount: rows.length,
    //             next_page: null,
    //             prev_page: null
    //         }
    //     });
    // },

    async customIndex(req, res) {
        const { m_gen, t_penerimaan_barang, m_unit_bussiness, m_supplier, t_purchase_return, t_purchase_return_approval, m_approval, m_approval_d } = req.models;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.paginate) || 10;
        const offset = (page - 1) * limit;

        let searchConditions = buildSearchQuery(req.query.search || null, req.query.searchfield || null);

        const where = {};

        if (searchConditions.length > 0) {
            where[Op.or] = searchConditions;
        }

        if (req.query.search_code) {
            where.code = {
                [Op.like]: `%${req.query.search_code}%`
            };
        }

        if (req.query.search_date) {
            const searchDate = req.query.search_date;
            if (searchDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                where.date = {
                    [Op.eq]: searchDate
                };
            } else {
                where.date = {
                    [Op.like]: `${searchDate}%`
                };
            }
        }

        if (req.query.search_supplier_name) {
            where.supplier_name = {
                [Op.like]: `%${req.query.search_supplier_name}%`
            };
        }

        if (req.query.search_notes) {
            where.notes = {
                [Op.like]: `%${req.query.search_notes}%`
            };
        }

        let penerimaanBarangIncludeWhere = {};
        let companyIncludeWhere = {};
        if (req.query.search_unit_business_name) {
            companyIncludeWhere.name = {
                [Op.like]: `%${req.query.search_unit_business_name}%`
            };
        }

        let returnOptionIncludeWhere = {};
        if (req.query.search_return_option) {
            returnOptionIncludeWhere.value1 = {
                [Op.like]: `%${req.query.search_return_option}%`
            };
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
            {
                model: m_gen,
                as: 'prtReturnOption',
                attributes: ['id', 'value1'],
                where: Object.keys(returnOptionIncludeWhere).length > 0 ? returnOptionIncludeWhere : undefined,
                required: Object.keys(returnOptionIncludeWhere).length > 0 ? true : false
            },
            {
                model: t_penerimaan_barang,
                as: 'prtPenerimaanBarang',
                where: Object.keys(penerimaanBarangIncludeWhere).length > 0 ? penerimaanBarangIncludeWhere : undefined,
                required: Object.keys(penerimaanBarangIncludeWhere).length > 0 || Object.keys(companyIncludeWhere).length > 0 ? true : false,
                include: [
                    {
                        model: m_unit_bussiness,
                        as: 'pbCompany',
                        attributes: ['id', 'name'],
                        where: Object.keys(companyIncludeWhere).length > 0 ? companyIncludeWhere : undefined,
                        required: Object.keys(companyIncludeWhere).length > 0 ? true : false
                    },
                    {
                        model: m_supplier,
                        as: 'pbSupplier',
                        attributes: ['id', 'name'],
                    },
                ]
            },
        ];

        if (req.query.auth_user_id && req.query.menu_id) {
            const checkAprrovalRole = await m_approval_d.findOne({
                where: {
                    user_id: req.query.auth_user_id,
                    type: 'menyetujui'
                },
                include: [{
                    model: m_approval,
                    where: {
                        menu_id: req.query.menu_id
                    },
                    attributes: []
                }]
            });
            if (checkAprrovalRole) {
                include.push({
                    model: t_purchase_return_approval,
                    as: 'preApprovals',
                    attributes: ['id', 'user_id', 'status', 'full_approval'],
                    required: true,
                    where: {
                        user_id: req.query.auth_user_id,
                        is_active: true,
                    }
                });
            }
        }

        if (req.query.unit_bussiness_id) {
            where.unit_bussiness_id = {
                [Op.eq]: req.query.unit_bussiness_id
            };
        }
        if (req.query.status) {
            where.status = {
                [Op.eq]: req.query.status
            };
        }

        const { count, rows } = await t_purchase_return.findAndCountAll({
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
                next_page: page < totalPages ? page + 1 : null,
                prev_page: page > 1 ? page - 1 : null
            }
        });
    },
};
