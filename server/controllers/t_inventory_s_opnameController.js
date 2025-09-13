// Controller for t_inventory_s_opname
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_inventory_s_opname
//
// Tambahkan custom function di bawah ini
import { Op, literal } from 'sequelize';

/**
 * Process stock opname data for summary report
 * Groups data by company, stock opname number, warehouse
 * 
 * @param {Array} stockOpnameData - Raw stock opname data
 * @returns {Array} Processed summary data
 */
const processSummaryData = (stockOpnameData) => {
    const processedData = [];

    stockOpnameData.forEach(record => {
        const company = record.m_warehouse?.m_unit_bussiness?.name || '';
        const stockOpnameNumber = record.code || '';
        const date = record.date ? new Date(record.date).toLocaleDateString('id-ID', {
            day: '2-digit',
            month: '2-digit', 
            year: 'numeric'
        }) : '';
        const warehouse = record.m_warehouse?.name || '';
        const pic = record.pic_name || '';
        const status = record.status || 'DRAFT';
        const notes = record.notes || '';

        // Calculate totals from details
        let qtyAwal = 0;
        let qtyAkhir = 0;
        let selisih = 0;
        let satuan = '';

        if (record.t_inventory_s_opname_ds && record.t_inventory_s_opname_ds.length > 0) {
            // For summary, we'll aggregate all items in this stock opname
            record.t_inventory_s_opname_ds.forEach(detail => {
                const stokProgram = detail.current_on_hand_quantity || 0;
                const stokOpname = detail.opname_qty || 0;
                
                qtyAwal += stokProgram;
                qtyAkhir += stokOpname;
                
                // Get unit from first item (for simplicity in summary)
                if (!satuan && detail.stockOpnameDetailUom?.value1) {
                    satuan = detail.stockOpnameDetailUom.value1;
                }
            });
            
            selisih = qtyAkhir - qtyAwal;
        }

        processedData.push([
            company,
            stockOpnameNumber,
            date,
            warehouse,
            qtyAwal || 0,
            qtyAkhir || 0,
            selisih || 0,
            satuan || 'PCS',
            pic,
            status,
            notes
        ]);
    });

    return processedData;
};

/**
 * Process stock opname data for detail report
 * Shows individual items within each stock opname
 * 
 * @param {Array} stockOpnameData - Raw stock opname data with details
 * @returns {Array} Processed detail data
 */
const processDetailData = (stockOpnameData) => {
    const processedData = [];
    let rowNumber = 1;

    stockOpnameData.forEach(record => {
        const company = record.m_warehouse?.m_unit_bussiness?.name || '';
        const stockOpnameNumber = record.code || '';
        const date = record.date ? new Date(record.date).toLocaleDateString('id-ID', {
            day: '2-digit',
            month: '2-digit', 
            year: 'numeric'
        }) : '';
        const warehouse = record.m_warehouse?.name || '';
        const pic = record.pic_name || '';
        const status = record.status || 'DRAFT';
        const notes = record.notes || '';

        if (record.t_inventory_s_opname_ds && record.t_inventory_s_opname_ds.length > 0) {
            record.t_inventory_s_opname_ds.forEach(detail => {
                const kodeItem = detail.item_code || detail.stockOpnameDetailItem?.code || '';
                const namaItem = detail.stockOpnameDetailItem?.name || '';
                const satuan = detail.stockOpnameDetailUom?.value1 || 'PCS';
                const stokProgram = detail.current_on_hand_quantity || 0;
                const stokOpname = detail.opname_qty || 0;
                const selisih = stokOpname - stokProgram;
                const balance = stokOpname; // For stock opname, balance is the counted quantity

                processedData.push([
                    rowNumber++,
                    company,
                    stockOpnameNumber,
                    date,
                    warehouse,
                    kodeItem,
                    namaItem,
                    satuan,
                    stokProgram || 0,
                    stokOpname || 0,
                    selisih || 0,
                    balance || 0,
                    pic,
                    status,
                    notes
                ]);
            });
        } else {
            // If no details, still show the stock opname record
            processedData.push([
                rowNumber++,
                company,
                stockOpnameNumber,
                date,
                warehouse,
                '',
                '',
                '',
                0,
                0,
                0,
                0,
                pic,
                status,
                notes
            ]);
        }
    });

    return processedData;
};

export const t_inventory_s_opnameController = {
    // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
    async uploadImage(req, res) {
        const fileFields = Object.keys(req.models.t_inventory_s_opname.rawAttributes).filter(
            key => req.models.t_inventory_s_opname.rawAttributes[key].type && req.models.t_inventory_s_opname.rawAttributes[key].type.key === 'STRING'
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
            const inserted = await req.models.t_inventory_s_opname.create(data);
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
            const inserted = await req.models.t_inventory_s_opname.bulkCreate(records);
            res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async generateCode(req, res) {
        const params = req.query;
        const code = await getCodeStructure(req.models.t_inventory_s_opname, params.menu_id)
        if (code.status === 'err') {
            res.json(errorResponse(code.error))
        }
        res.json(successResponse(code.data))
    },

    // Contoh: Custom function
    async customFunction(req, res) {
        res.json({ message: 'Custom function untuk t_inventory_s_opname', body: req.body, query: req.query });
    },

    // Stock Opname Summary Report
    async getStockOpnameReport(req, res) {
        try {
            // Extract query parameters for filters
            const {
                unit_business_ids = [],     // Array of company IDs
                warehouse_ids = [],         // Array of warehouse IDs
                start_date,                 // Date string (YYYY-MM-DD)
                end_date,                   // Date string (YYYY-MM-DD)
                page = 1,                   // Pagination
                limit = 100                 // Items per page
            } = req.query;

            // Access models from req.models
            const {
                t_inventory_s_opname,
                t_inventory_s_opname_d,
                m_item,
                m_warehouse,
                m_unit_bussiness,
                m_gen
            } = req.models;

            // Build where conditions for filters
            const whereConditions = {
                status: "POSTED" // Only show POSTED stock opname records
            };
            const warehouseWhereConditions = {};
            const unitBusinessWhereConditions = {};

            // Date range filter
            if (start_date && end_date) {
                if (start_date === end_date) {
                    // Single date: show data for the entire day
                    whereConditions.date = {
                        [Op.between]: [`${start_date} 00:00:00`, `${start_date} 23:59:59`]
                    };
                } else {
                    // Different dates: add time ranges
                    whereConditions.date = {
                        [Op.between]: [`${start_date} 00:00:00`, `${end_date} 23:59:59`]
                    };
                }
            } else if (start_date) {
                whereConditions.date = {
                    [Op.gte]: `${start_date} 00:00:00`
                };
            } else if (end_date) {
                whereConditions.date = {
                    [Op.lte]: `${end_date} 23:59:59`
                };
            }

            // Company/Unit Business filter
            if (unit_business_ids && unit_business_ids.length > 0) {
                unitBusinessWhereConditions.id = {
                    [Op.in]: unit_business_ids
                };
            }

            // Warehouse filter
            if (warehouse_ids && warehouse_ids.length > 0) {
                warehouseWhereConditions.id = {
                    [Op.in]: warehouse_ids
                };
            }

            // Main query with all relationships
            const stockOpnameData = await t_inventory_s_opname.findAll({
                where: whereConditions,
                include: [
                    {
                        model: m_warehouse,
                        as: 'm_warehouse',
                        where: warehouseWhereConditions,
                        required: true,
                        include: [
                            {
                                model: m_unit_bussiness,
                                as: 'm_unit_bussiness',
                                where: unitBusinessWhereConditions,
                                required: true,
                                attributes: ['id', 'name']
                            }
                        ],
                        attributes: ['id', 'name', 'unit_bussiness_id']
                    },
                    {
                        model: t_inventory_s_opname_d,
                        as: 't_inventory_s_opname_ds',
                        required: false,
                        include: [
                            {
                                model: m_item,
                                as: "stockOpnameDetailItem",
                                required: false,
                                attributes: ['id', 'name', 'code']
                            },
                            {
                                model: m_gen,
                                as: "stockOpnameDetailUom",
                                required: false,
                                attributes: ['id', 'value1']
                            }
                        ],
                        attributes: ['id', 'item_id', 'item_code', 'opname_qty', 'current_on_hand_quantity', 'item_uom_id']
                    }
                ],
                attributes: ['id', 'code', 'date', 'pic_name', 'status', 'notes', 'warehouse_id', 'unit_bussiness_id'],
                order: [
                    ['date', 'DESC'],
                    ['code', 'ASC']
                ]
            });

            // Process and then paginate the results
            const allProcessedData = processSummaryData(stockOpnameData);
            const startIndex = (parseInt(page) - 1) * parseInt(limit);
            const endIndex = startIndex + parseInt(limit);
            const processedData = allProcessedData.slice(startIndex, endIndex);

            const totalCount = allProcessedData.length;

            // Response structure
            const response = {
                success: true,
                data: {
                    rows: processedData,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: totalCount,
                        totalPages: Math.ceil(totalCount / limit)
                    },
                    filters: {
                        unit_business_ids,
                        warehouse_ids,
                        start_date,
                        end_date
                    }
                },
                message: 'Stock opname summary report retrieved successfully'
            };

            res.status(200).json(response);

        } catch (error) {
            console.error('Error fetching stock opname report:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error while fetching stock opname report',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            });
        }
    },

    // Stock Opname Detail Report
    async getStockOpnameDetailReport(req, res) {
        try {
            // Extract query parameters for filters
            const {
                unit_business_ids = [],     // Array of company IDs
                warehouse_ids = [],         // Array of warehouse IDs
                start_date,                 // Date string (YYYY-MM-DD)
                end_date,                   // Date string (YYYY-MM-DD)
                page = 1,                   // Pagination
                limit = 100                 // Items per page
            } = req.query;

            // Access models from req.models
            const {
                t_inventory_s_opname,
                t_inventory_s_opname_d,
                m_item,
                m_warehouse,
                m_unit_bussiness,
                m_gen
            } = req.models;

            // Build where conditions for filters
            const whereConditions = {
                status: "POSTED" // Only show POSTED stock opname records
            };
            const warehouseWhereConditions = {};
            const unitBusinessWhereConditions = {};

            // Date range filter
            if (start_date && end_date) {
                if (start_date === end_date) {
                    // Single date: show data for the entire day
                    whereConditions.date = {
                        [Op.between]: [`${start_date} 00:00:00`, `${start_date} 23:59:59`]
                    };
                } else {
                    // Different dates: add time ranges
                    whereConditions.date = {
                        [Op.between]: [`${start_date} 00:00:00`, `${end_date} 23:59:59`]
                    };
                }
            } else if (start_date) {
                whereConditions.date = {
                    [Op.gte]: `${start_date} 00:00:00`
                };
            } else if (end_date) {
                whereConditions.date = {
                    [Op.lte]: `${end_date} 23:59:59`
                };
            }

            // Company/Unit Business filter
            if (unit_business_ids && unit_business_ids.length > 0) {
                unitBusinessWhereConditions.id = {
                    [Op.in]: unit_business_ids
                };
            }

            // Warehouse filter
            if (warehouse_ids && warehouse_ids.length > 0) {
                warehouseWhereConditions.id = {
                    [Op.in]: warehouse_ids
                };
            }

            // Main query with all relationships - get detailed data
            const stockOpnameData = await t_inventory_s_opname.findAll({
                where: whereConditions,
                include: [
                    {
                        model: m_warehouse,
                        as: 'm_warehouse',
                        where: warehouseWhereConditions,
                        required: true,
                        include: [
                            {
                                model: m_unit_bussiness,
                                as: 'm_unit_bussiness',
                                where: unitBusinessWhereConditions,
                                required: true,
                                attributes: ['id', 'name']
                            }
                        ],
                        attributes: ['id', 'name', 'unit_bussiness_id']
                    },
                    {
                        model: t_inventory_s_opname_d,
                        as: 't_inventory_s_opname_ds',
                        required: false,
                        include: [
                            {
                                model: m_item,
                                as: "stockOpnameDetailItem",
                                required: false,
                                attributes: ['id', 'name', 'code']
                            },
                            {
                                model: m_gen,
                                as: "stockOpnameDetailUom",
                                required: false,
                                attributes: ['id', 'value1']
                            }
                        ],
                        attributes: ['id', 'item_id', 'item_code', 'opname_qty', 'current_on_hand_quantity', 'item_uom_id']
                    }
                ],
                attributes: ['id', 'code', 'date', 'pic_name', 'status', 'notes', 'warehouse_id', 'unit_bussiness_id'],
                order: [
                    ['date', 'DESC'],
                    ['code', 'ASC'],
                    [{ model: t_inventory_s_opname_d, as: 't_inventory_s_opname_ds' }, 'id', 'ASC']
                ]
            });

            // Process data for detail report format
            const allProcessedData = processDetailData(stockOpnameData);

            // Apply pagination to the processed data
            const startIndex = (parseInt(page) - 1) * parseInt(limit);
            const endIndex = startIndex + parseInt(limit);
            const processedData = allProcessedData.slice(startIndex, endIndex);

            // Response structure
            const response = {
                success: true,
                data: {
                    rows: processedData,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: allProcessedData.length,
                        totalPages: Math.ceil(allProcessedData.length / limit)
                    },
                    filters: {
                        unit_business_ids,
                        warehouse_ids,
                        start_date,
                        end_date
                    }
                },
                message: 'Stock opname detail report retrieved successfully'
            };

            res.status(200).json(response);

        } catch (error) {
            console.error('Error fetching stock opname detail report:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error while fetching stock opname detail report',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            });
        }
    }
};
