// Controller for t_inventory_transform_item
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_inventory_transform_item
//
// Tambahkan custom function di bawah ini
import { QueryProcessor } from '../utils/queryProcessor.min.js';
import t_inventory_ledger from '../models/t_inventory_ledger.js';
import { validateModel } from '../utils/modelValidator.min.js';
import { Op, literal } from 'sequelize';

/**
 * Process transform item data for summary report
 * Groups data by company, transform number, warehouse
 * 
 * @param {Array} transformItemData - Raw transform item data
 * @returns {Array} Processed summary data
 */
const processSummaryData = (transformItemData) => {
    const processedData = [];
    let rowNumber = 1;

    transformItemData.forEach(record => {
        const company = record.m_unit_bussiness?.name || '';
        const transformNumber = record.code || '';
        const date = record.date ? new Date(record.date).toLocaleDateString('id-ID') : '';
        const tipeTransform = record.tipe || '';
        const grupItem = record.m_item?.itemGroup?.value1 || 'BUNDLING'; // Group from m_gen via item_group_id
        const kodeItem = record.m_item?.code || record.item_name || '';
        const namaItem = record.m_item?.name || record.item_name || '';
        const qty = record.qty || 0;
        const satuan = record.m_gen?.value1 || 'PCS';
        const warehouse = record.m_warehouse?.name || '';
        const createdBy = record.created_by_name || 'N/A';

        processedData.push([
            rowNumber++,
            company,
            transformNumber,
            date,
            tipeTransform,
            grupItem,
            kodeItem,
            namaItem,
            qty,
            satuan,
            warehouse,
            // createdBy
        ]);
    });

    return processedData;
};

/**
 * Process transform item data for detail report
 * Shows individual items with input and output details
 * 
 * @param {Array} transformItemData - Raw transform item data with details
 * @returns {Array} Processed detail data as objects with metadata and tables
 */
const processDetailData = (transformItemData) => {
    const processedData = [];

    transformItemData.forEach(record => {
        const company = record.m_warehouse?.m_unit_bussiness?.name || '';
        const transformNumber = record.code || '';
        const date = record.date ? new Date(record.date).toLocaleDateString('id-ID') : '';
        const tipeTransform = record.tipe || '';
        const kodeItem = record.m_item?.code || record.item_name || '';
        const namaItem = record.m_item?.name || record.item_name || '';
        const qty = record.qty || 0;
        const satuan = record.m_gen?.value1 || 'PCS';
        const warehouse = record.m_warehouse?.name || '';
        const createdBy = record.created_by_name || 'N/A';

        // Prepare detail input data
        const detailInput = [];
        const detailOutput = [];

        if (record.t_inventory_transform_item_ds && record.t_inventory_transform_item_ds.length > 0) {
            record.t_inventory_transform_item_ds.forEach((detail, index) => {
                const detailItem = detail.detailItem || {};
                const detailUom = detail.m_gen || {};

                const inputOutputData = {
                    "No": index + 1,
                    "Kode Item": detailItem.code || '',
                    "Nama Item": detailItem.name || '',
                    "Berat (KG)": detailItem.actual_weight || 0,
                    "Qty": detail.qty || 0,
                    "Satuan": detailUom.value1 || 'PCS',
                    "Catatan": detail.note || ''
                };

                // For REPACK, details are inputs (raw materials going into the bundle)
                // For UNPACK, details are outputs (individual items from the bundle)
                if (record.tipe === 'REPACK') {
                    detailInput.push(inputOutputData);
                } else if (record.tipe === 'UNPACK') {
                    detailOutput.push(inputOutputData);
                }
            });
        }

        // For REPACK: the main item is the output (bundled product)
        // For UNPACK: the main item is the input (bundle being unpacked)
        if (record.tipe === 'REPACK') {
            detailOutput.push({
                "No": 1,
                "Kode Item": kodeItem,
                "Nama Item": namaItem,
                "Berat (KG)": record.m_item?.actual_weight || 0,
                "Qty": qty,
                "Satuan": satuan,
                "Catatan": record.notes || ''
            });
        } else if (record.tipe === 'UNPACK') {
            detailInput.push({
                "No": 1,
                "Kode Item": kodeItem,
                "Nama Item": namaItem,
                "Berat (KG)": record.m_item?.actual_weight || 0,
                "Qty": qty,
                "Satuan": satuan,
                "Catatan": record.notes || ''
            });
        }

        // Create object structure as shown in screenshot
        const transformItemDetail = {
            metadata: {
                company: company,
                transformNumber: transformNumber,
                date: date,
                warehouse: warehouse,
                tipeTransform: tipeTransform === 'REPACK' ? 'Bundle' : 'Unbundle',
                kodeItem: kodeItem,
                namaItem: namaItem,
                qty: `${qty} ${satuan}`,
                createdBy: createdBy
            },
            detailInput: detailInput,
            detailOutput: detailOutput
        };

        processedData.push(transformItemDetail);
    });

    return processedData;
};

export const t_inventory_transform_itemController = {
    // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
    async uploadImage(req, res) {
        const fileFields = Object.keys(req.models.t_inventory_transform_item.rawAttributes).filter(
            key => req.models.t_inventory_transform_item.rawAttributes[key].type && req.models.t_inventory_transform_item.rawAttributes[key].type.key === 'STRING'
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
            const inserted = await req.models.t_inventory_transform_item.create(data);
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
            const inserted = await req.models.t_inventory_transform_item.bulkCreate(records);
            res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    // Contoh: Custom function
    async customFunction(req, res) {
        res.json({ message: 'Custom function untuk t_inventory_transform_item', body: req.body, query: req.query });
    },

    async generateCode(req, res) {
        const params = req.query;
        const code = await getCodeStructure(req.models.t_inventory_transform_item, params.menu_id)
        if (code.status === 'err') {
            res.json(errorResponse(code.error))
        }
        res.json(successResponse(code.data))
    },

    async createWithDetails(req, res) {
        let transaction;
        try {
            const modelName = req.params.model;
            const model = validateModel(modelName);

            const sequelize = req.models.t_inventory_transform_item.sequelize;
            transaction = await sequelize.transaction();

            // Separate mainData and all array properties (details)
            const { details, ...mainData } = req.body;
            const detailPayloads = {};
            Object.keys(req.body).forEach(key => {
                if (Array.isArray(req.body[key]) && key !== 'details') {
                    detailPayloads[key] = req.body[key];
                }
            });

            // Build include array for nested creation
            const includeOptions = [];

            // Process details (old convention)
            if (details) {
                const detailModelName = `${modelName}_d`;
                const detailModel = sequelize.models[detailModelName];
                if (!detailModel) throw new Error(`Detail model '${detailModelName}' not found`);

                // Find the association between main model and detail model
                const association = Object.values(model.associations).find(a =>
                    a.target && a.target.name === detailModelName
                );

                if (association) {
                    mainData[association.as || detailModelName] = Array.isArray(details) ? details : [details];
                    includeOptions.push({
                        model: detailModel,
                        as: association.as
                    });
                }
            }

            // Process all other array properties
            for (const [prop, arr] of Object.entries(detailPayloads)) {
                // Try exact model name first
                let detailModel = sequelize.models[prop];
                // If not found, try singular form
                if (!detailModel && prop.endsWith('s')) {
                    detailModel = sequelize.models[prop.slice(0, -1)];
                }
                if (!detailModel) continue;

                // Find association from main model to detail model
                const association = Object.values(model.associations).find(a =>
                    a.target && (a.target.name === prop || a.target.name === prop.slice(0, -1))
                );

                if (association) {
                    mainData[association.as || prop] = arr;
                    includeOptions.push({
                        model: detailModel,
                        as: association.as
                    });
                }
            }

            // Pass user data and transaction to options
            const options = {
                include: includeOptions,
                transaction,
                user: req.user || res.locals.user
            };

            // Single create operation with nested data
            const item = await model.create(mainData, options);

            await transaction.commit();
            const formattedItem = QueryProcessor.formatDateTimeFields(item, model);
            res.json(successResponse(formattedItem))
        } catch (error) {
            if (transaction) await transaction.rollback();
            res.status(500).json(errorResponse(error.message))
        }
    },
    async updateWithDetails(req, res) {
        let transaction;
        try {
            const modelName = req.params.model;
            const model = validateModel(modelName);

            const sequelize = req.models.t_inventory_transform_item.sequelize;
            transaction = await sequelize.transaction();

            // Separate mainData and all array properties (details)
            const { details, ...mainData } = req.body;
            const detailPayloads = {};
            Object.keys(req.body).forEach(key => {
                if (Array.isArray(req.body[key]) && key !== 'details') {
                    detailPayloads[key] = req.body[key];
                }
            });

            // Find the item
            const item = await model.findByPk(req.query.id);
            if (!item) throw new Error('Main record not found');


            // Helper function to process detail arrays
            const processDetails = async (detailArray, modelName) => {
                const detailModel = sequelize.models[modelName] ||
                    sequelize.models[modelName.slice(0, -1)];
                if (!detailModel) return;

                const association = Object.values(model.associations).find(a =>
                    a.target && (a.target.name === modelName || a.target.name === modelName.slice(0, -1))
                );
                if (!association) return;

                // Delete existing records
                await detailModel.destroy({
                    where: { [association.foreignKey]: item.id },
                    transaction
                });

                // Create new records and attach to item in memory
                const newRecords = await detailModel.bulkCreate(
                    detailArray.map(detail => ({
                        ...detail,
                        [association.foreignKey]: item.id
                    })),
                    { transaction, returning: true }
                );

                // Update item's association in memory for afterSave hook
                const associationName = association.as || modelName;
                item.dataValues[associationName] = newRecords;
                item[associationName] = newRecords;
            };

            // Process details (old convention)
            if (details) {
                const detailArray = Array.isArray(details) ? details : [details];
                await processDetails(detailArray, `${modelName}_d`);
            }

            // Process all other array properties
            for (const [prop, arr] of Object.entries(detailPayloads)) {
                await processDetails(arr, prop);
            }

            // Update main data in the instance
            Object.assign(item, mainData);

            // Use save() instead of update() to ensure all hooks are triggered
            const options = {
                transaction,
                user: req.user || res.locals.user
            };

            await item.save(options);

            await transaction.commit();
            const formattedItem = QueryProcessor.formatDateTimeFields(item, model);
            res.json(successResponse(formattedItem))
        } catch (error) {
            if (transaction) await transaction.rollback();
            res.status(500).json(errorResponse(error.message))

        }
    },
    async getRepackedItems(req, res) {
        try {
            const { unit_bussiness_id, warehouse_id } = req.query;
            const { t_inventory_transform_item, t_inventory_transform_item_d } = req.models;

            // Build where clause for filtering
            const whereClause = {
                tipe: "REPACK",
                status: "POSTED"
            };

            // Apply filters if provided
            if (unit_bussiness_id) {
                whereClause.unit_bussiness_id = unit_bussiness_id;
            }
            if (warehouse_id) {
                whereClause.warehouse_id = warehouse_id;
            }

            // Fetch repacked items from database using Sequelize
            const transformItems = await t_inventory_transform_item.findAll({
                where: whereClause,
                attributes: ['id', 'item_name', 'code', 'item_uom_id', 'qty', 'warehouse_id', 'unit_bussiness_id'],
                include: [{
                    model: t_inventory_transform_item_d,
                    as: 't_inventory_transform_item_ds',
                    required: false
                }]
            });

            // If no items found, return empty array
            if (transformItems.length === 0) {
                return res.json({
                    success: true,
                    data: []
                });
            }

            // Get the actual bundled item IDs from inventory ledger transactions
            // similar to how it's done in the hooks for UNPACK process
            const bundledItemIds = [];
            for (const transformItem of transformItems) {
                try {

                    // Find the inventory ledger entry for the original bundle creation
                    const bundleTransaction = await t_inventory_ledger.findOne({
                        where: {
                            reference_id: transformItem.id,
                            reference_source: 'transform_item',
                        }
                    });

                    if (bundleTransaction) {
                        bundledItemIds.push(bundleTransaction.item_id);
                        transformItem.item_id = bundleTransaction.item_id
                    } else {
                        // Fallback to transform item ID if ledger entry not found
                        bundledItemIds.push(transformItem.id);
                        transformItem.item_id = bundleTransaction.id
                    }
                } catch (error) {
                    console.warn(`Failed to get bundled item ID for transform item ${transformItem.id}:`, error.message);
                    // Fallback to transform item ID
                    bundledItemIds.push(transformItem.id);
                }
            }

            let stockData = {};

            if (warehouse_id) {
                // Get stock for specific warehouse
                stockData = await inventoryService.getCurrentStockForItemsInWarehouse(
                    bundledItemIds,
                    warehouse_id,
                    true // getOnHand = true for physical stock
                );

            } else if (unit_bussiness_id) {
                // Get stock aggregated by company
                stockData = await inventoryService.getCurrentStockForItemsByCompany(
                    bundledItemIds,
                    unit_bussiness_id,
                    true // getOnHand = true for physical stock
                );
            } else {
                // Get stock for each item individually across all warehouses
                for (const item of transformItems) {
                    try {
                        const stock = await inventoryService.getCurrentStock(item.id, item.warehouse_id);
                        stockData[item.id] = stock;
                    } catch (error) {
                        console.warn(`Failed to get stock for item ${item.id}:`, error.message);
                        stockData[item.id] = 0;
                    }
                }
            }

            // Enhance items with stock information
            const enhancedItems = transformItems.map(item => ({
                id: item.id,
                item_name: item.item_name,
                code: item.code,
                item_uom_id: item.item_uom_id,
                qty: stockData[item.item_id] || item.qty || 0,
                warehouse_id: item.warehouse_id,
                unit_bussiness_id: item.unit_bussiness_id,
                stock_on_hand: stockData[item.item_id] || 0,
                t_inventory_transform_item_ds: item.t_inventory_transform_item_ds || []
            }));

            // Filter out items with zero stock if needed (optional)
            const availableItems = enhancedItems.filter(item => item.stock_on_hand > 0);

            res.json({
                success: true,
                data: availableItems,
                message: `Found ${availableItems.length} repacked items with stock available`
            });

        } catch (error) {
            console.error("Error in getRepackedItems:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch repacked items",
                error: error.message
            });
        }
    },
    /**
     * Get Transform Item Summary Report Data
     * Fetches transform item data for summary view
     *
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Object} JSON response with transform item summary data
     */
    async getTransformItemSummaryReport(req, res) {
        try {
            // Extract query parameters for filters
            const {
                unit_bussiness_id = [], // Array of company IDs
                warehouse_id = [], // Array of warehouse IDs
                item_id = [], // Array of item IDs
                group_item_id = [], // Array of group item IDs
                start_date, // Date string (YYYY-MM-DD)
                end_date, // Date string (YYYY-MM-DD)
                tipe_transform, // Transform type filter
                status, // Status filter
                page = 1, // Pagination
                limit = 100, // Items per page
            } = req.query;

            // Access models from req.models
            const {
                t_inventory_transform_item,
                m_item,
                m_warehouse,
                m_unit_bussiness,
                m_gen,
                t_inventory_transform_item_d
            } = req.models;

            // Build where conditions for filters
            const whereConditions = {};
            const itemWhereConditions = {};
            const warehouseWhereConditions = {};
            const unitBusinessWhereConditions = {};
            const groupItemWhereConditions = {};

            // Date range filter - fixed to handle single date and add time properly
            if (start_date && end_date) {
                if (start_date === end_date) {
                    // Same date - search for records on that specific day
                    const startOfDay = `${start_date} 00:00:00`;
                    const endOfDay = `${start_date} 23:59:59`;
                    whereConditions.date = {
                        [Op.between]: [startOfDay, endOfDay],
                    };
                } else {
                    // Different dates - add time to ensure full day coverage
                    const startOfDay = `${start_date} 00:00:00`;
                    const endOfDay = `${end_date} 23:59:59`;
                    whereConditions.date = {
                        [Op.between]: [startOfDay, endOfDay],
                    };
                }
            } else if (start_date) {
                const startOfDay = `${start_date} 00:00:00`;
                whereConditions.date = {
                    [Op.gte]: startOfDay,
                };
            } else if (end_date) {
                const endOfDay = `${end_date} 23:59:59`;
                whereConditions.date = {
                    [Op.lte]: endOfDay,
                };
            }

            // Transform type filter
            if (tipe_transform && tipe_transform !== 'ALL') {
                whereConditions.tipe = tipe_transform;
            }

            // Status filter
            if (status && status !== 'ALL') {
                whereConditions.status = status;
            }

            // Company/Unit Business filter
            if (unit_bussiness_id && unit_bussiness_id.length > 0) {
                unitBusinessWhereConditions.id = {
                    [Op.in]: unit_bussiness_id,
                };
            }

            // Warehouse filter
            if (warehouse_id && warehouse_id.length > 0) {
                warehouseWhereConditions.id = {
                    [Op.in]: warehouse_id,
                };
            }

            // Item filter
            if (item_id && item_id.length > 0) {
                itemWhereConditions.id = {
                    [Op.in]: item_id,
                };
            }

            // Group item filter
            if (group_item_id && group_item_id.length > 0) {
                groupItemWhereConditions.id = {
                    [Op.in]: group_item_id,
                };
            }

            // Main query with all relationships for summary report
            const transformItemData = await t_inventory_transform_item.findAndCountAll({
                where: whereConditions,
                include: [
                    {
                        model: m_item,
                        // where: Object.keys(itemWhereConditions).length > 0 ? itemWhereConditions : undefined,
                        // required: false,
                        // include: [
                        //     {
                        //         model: m_gen,
                        //         as: "itemUom",
                        //         attributes: ["id", "value1"],
                        //     },
                        //     {
                        //         model: m_gen,
                        //         as: "itemGroup",
                        //         // where: Object.keys(groupItemWhereConditions).length > 0 ? groupItemWhereConditions : undefined,
                        //         // required: Object.keys(groupItemWhereConditions).length > 0,
                        //         attributes: ["id", "value1"],
                        //     },
                        // ],
                        attributes: ["id", "name", "code", "item_uom_id", "item_group_id", "actual_weight"],
                    },
                    {
                        model: m_warehouse,
                        where: warehouseWhereConditions,
                        required: true,
                        attributes: ["id", "name", "unit_bussiness_id"],
                    },
                    {
                        model: m_gen,
                        attributes: ["id", "value1"],
                    },
                    {
                        model: m_unit_bussiness,
                        where: unitBusinessWhereConditions,
                        required: true,
                        attributes: ["id", "name"],
                    },
                ],
                attributes: [
                    "id",
                    "code",
                    "date",
                    "tipe",
                    "item_id",
                    "item_name",
                    "qty",
                    "notes",
                    "warehouse_id",
                    "unit_bussiness_id",
                    "item_uom_id",
                    "status",
                    "createdAt",
                ],
                order: [
                    ["date", "DESC"],
                    ["code", "ASC"],
                ],
                limit: parseInt(limit),
                offset: (parseInt(page) - 1) * parseInt(limit),
            });

            console.log(transformItemData.rows);
            // Process summary data
            const processedData = processSummaryData(transformItemData.rows);

            // Response structure
            const response = {
                success: true,
                data: {
                    rows: processedData,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: transformItemData.count,
                        totalPages: Math.ceil(transformItemData.count / parseInt(limit)),
                    },
                    filters: {
                        unit_bussiness_id,
                        warehouse_id,
                        item_id,
                        group_item_id,
                        start_date,
                        end_date,
                        tipe_transform,
                        status,
                    },
                },
                message: "Transform item summary report retrieved successfully",
            };

            res.status(200).json(response);
        } catch (error) {
            console.error("Error fetching transform item summary report:", error);
            res.status(500).json({
                success: false,
                message:
                    "Internal server error while fetching transform item summary report",
                error: process.env.NODE_ENV === "development" ? error.message : undefined,
                stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
            });
        }
    },

    /**
     * Get Transform Item Detail Report Data
     * Fetches detailed transform item data with input/output breakdown
     *
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Object} JSON response with detailed transform item data
     */
    async getTransformItemDetailReport(req, res) {
        try {
            // Extract query parameters for filters
            const {
                unit_bussiness_id = [], // Array of company IDs
                warehouse_id = [], // Array of warehouse IDs
                item_id = [], // Array of item IDs
                group_item_id = [], // Array of group item IDs
                start_date, // Date string (YYYY-MM-DD)
                end_date, // Date string (YYYY-MM-DD)
                tipe_transform, // Transform type filter
                status, // Status filter
                page = 1, // Pagination
                limit = 100, // Items per page
            } = req.query;

            // Access models from req.models
            const {
                t_inventory_transform_item,
                t_inventory_transform_item_d,
                m_item,
                m_warehouse,
                m_unit_bussiness,
                m_gen,
            } = req.models;

            // Build where conditions for filters
            const whereConditions = {};
            const warehouseWhereConditions = {};
            const unitBusinessWhereConditions = {};

            // Date range filter - fixed to handle single date and add time properly
            if (start_date && end_date) {
                if (start_date === end_date) {
                    // Same date - search for records on that specific day
                    const startOfDay = `${start_date} 00:00:00`;
                    const endOfDay = `${start_date} 23:59:59`;
                    whereConditions.date = {
                        [Op.between]: [startOfDay, endOfDay],
                    };
                } else {
                    // Different dates - add time to ensure full day coverage
                    const startOfDay = `${start_date} 00:00:00`;
                    const endOfDay = `${end_date} 23:59:59`;
                    whereConditions.date = {
                        [Op.between]: [startOfDay, endOfDay],
                    };
                }
            } else if (start_date) {
                const startOfDay = `${start_date} 00:00:00`;
                whereConditions.date = {
                    [Op.gte]: startOfDay,
                };
            } else if (end_date) {
                const endOfDay = `${end_date} 23:59:59`;
                whereConditions.date = {
                    [Op.lte]: endOfDay,
                };
            }

            // Transform type filter
            if (tipe_transform && tipe_transform !== 'ALL') {
                whereConditions.tipe = tipe_transform;
            }

            // Status filter
            if (status && status !== 'ALL') {
                whereConditions.status = status;
            }

            // Company/Unit Business filter
            if (unit_bussiness_id && unit_bussiness_id.length > 0) {
                unitBusinessWhereConditions.id = {
                    [Op.in]: unit_bussiness_id,
                };
            }

            // Warehouse filter
            if (warehouse_id && warehouse_id.length > 0) {
                warehouseWhereConditions.id = {
                    [Op.in]: warehouse_id,
                };
            }

            // Note: Item and group item filters are handled via subqueries below

            // Add item filter to main where conditions if needed
            if (item_id && item_id.length > 0) {
                whereConditions.item_id = {
                    [Op.in]: item_id,
                };
            }

            // Add group item filter via subquery if needed
            if (group_item_id && group_item_id.length > 0) {
                const itemsInGroup = await m_item.findAll({
                    where: {
                        item_group_id: {
                            [Op.in]: group_item_id,
                        }
                    },
                    attributes: ['id']
                });
                const itemIdsInGroup = itemsInGroup.map(item => item.id);

                if (whereConditions.item_id) {
                    // If item_id filter already exists, intersect with group items
                    const existingItemIds = Array.isArray(whereConditions.item_id[Op.in])
                        ? whereConditions.item_id[Op.in]
                        : [whereConditions.item_id[Op.in]];
                    whereConditions.item_id = {
                        [Op.in]: existingItemIds.filter(id => itemIdsInGroup.includes(id))
                    };
                } else {
                    whereConditions.item_id = {
                        [Op.in]: itemIdsInGroup,
                    };
                }
            }

            // Main query with relationships for detail report
            const transformItemData = await t_inventory_transform_item.findAndCountAll({
                where: whereConditions,
                include: [
                    {
                        model: m_warehouse,
                        where: warehouseWhereConditions,
                        required: true,
                        include: [
                            {
                                model: m_unit_bussiness,
                                where: unitBusinessWhereConditions,
                                required: true,
                                attributes: ["id", "name"],
                            },
                        ],
                        attributes: ["id", "name", "unit_bussiness_id"],
                    },
                    {
                        model: t_inventory_transform_item_d,
                        as: "t_inventory_transform_item_ds",
                        required: false,
                        include: [
                            {
                                model: m_gen,
                                required: false,
                                attributes: ["id", "value1"],
                            },
                        ],
                        attributes: ["id", "item_id", "qty", "note", "item_uom_id"],
                    },
                    {
                        model: m_gen,
                        attributes: ["id", "value1"],
                    },
                ],
                attributes: [
                    "id",
                    "code",
                    "date",
                    "tipe",
                    "item_id",
                    "item_name",
                    "qty",
                    "notes",
                    "warehouse_id",
                    "unit_bussiness_id",
                    "item_uom_id",
                    "status",
                    "createdAt",
                ],
                order: [
                    ["date", "DESC"],
                    ["code", "ASC"],
                    [{ model: t_inventory_transform_item_d, as: "t_inventory_transform_item_ds" }, "id", "ASC"],
                ],
                limit: parseInt(limit),
                offset: (parseInt(page) - 1) * parseInt(limit),
            });

            // Fetch item data separately for transform items
            const mainItemIds = [...new Set(transformItemData.rows.map(row => row.item_id).filter(id => id))];

            // Also collect item IDs from detail records
            const detailItemIds = [...new Set(transformItemData.rows.flatMap(row =>
                (row.t_inventory_transform_item_ds || []).map(detail => detail.item_id).filter(id => id)
            ))];

            const allItemIds = [...new Set([...mainItemIds, ...detailItemIds])];

            const itemsData = await m_item.findAll({
                where: {
                    id: {
                        [Op.in]: allItemIds
                    }
                },
                include: [
                    {
                        model: m_gen,
                        as: "itemUom",
                        attributes: ["id", "value1"],
                    },
                    {
                        model: m_gen,
                        as: "itemGroup",
                        attributes: ["id", "value1"],
                    },
                ],
                attributes: ["id", "name", "code", "item_uom_id", "item_group_id", "actual_weight"],
            });

            // Create item lookup map
            const itemLookup = {};
            itemsData.forEach(item => {
                itemLookup[item.id] = item;
            });

            // Attach item data to transform records
            transformItemData.rows.forEach(row => {
                if (row.item_id && itemLookup[row.item_id]) {
                    row.m_item = itemLookup[row.item_id];
                }

                // Attach item data to detail records
                if (row.t_inventory_transform_item_ds) {
                    row.t_inventory_transform_item_ds.forEach(detail => {
                        if (detail.item_id && itemLookup[detail.item_id]) {
                            detail.detailItem = itemLookup[detail.item_id];
                        }
                    });
                }
            });

            // Process detail data
            const processedData = processDetailData(transformItemData.rows);

            // Response structure
            const response = {
                success: true,
                data: {
                    rows: processedData,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: transformItemData.count,
                        totalPages: Math.ceil(transformItemData.count / parseInt(limit)),
                    },
                    filters: {
                        unit_bussiness_id,
                        warehouse_id,
                        item_id,
                        group_item_id,
                        start_date,
                        end_date,
                        tipe_transform,
                        status,
                    },
                },
                message: "Transform item detail report retrieved successfully",
            };

            res.status(200).json(response);
        } catch (error) {
            console.error("Error fetching transform item detail report:", error);
            res.status(500).json({
                success: false,
                message:
                    "Internal server error while fetching transform item detail report",
                error: process.env.NODE_ENV === "development" ? error.message : undefined,
                stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
            });
        }
    },
};
