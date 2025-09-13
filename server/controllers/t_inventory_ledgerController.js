// Controller for t_inventory_ledger
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_inventory_ledger
//
// Tambahkan custom function di bawah ini
import { Op, literal } from 'sequelize';
import { sequelize } from '../config/database.js';
import t_inventory_ledger from '../models/t_inventory_ledger.js';
import m_item from '../models/m_item.js';
import m_warehouse from '../models/m_warehouse.js';
import t_inventory_s_batches from '../models/t_inventory_s_batches.js';
import t_inventory_s_average from '../models/t_inventory_s_average.js';
import m_inventory_type from '../models/m_inventory_type.js';
import t_inventory_reservations from '../models/t_inventory_reservations.js';


// A helper function to robustly parse the 'items' query parameter.
const parseItemIds = (itemsParam) => {
    if (!itemsParam) {
        return [];
    }

    let itemIds = [];
    if (Array.isArray(itemsParam)) {
        // Handles cases like ?items[]=101&items[]=102
        itemIds = itemsParam;
    } else if (typeof itemsParam === 'string') {
        // Handles cases like ?items=101,102,103
        itemIds = itemsParam.split(',');
    } else {
        // Handles a single item like ?items=101
        itemIds = [String(itemsParam)];
    }

    // Sanitize the array: convert to numbers and filter out any invalid entries (e.g., NaN)
    return itemIds;
};

/**
 * Enrich inventory data with supplier/customer information and transaction dates
 * @param {Array} inventoryData - Raw inventory ledger data
 * @param {Object} models - Database models
 * @returns {Array} Enriched data with supplier/customer info and transaction dates
 */
const enrichWithSupplierCustomer = async (inventoryData, models) => {

    const {
        t_purchase_order,
        t_surat_jalan,
        t_surat_jalan_d,
        m_supplier,
        m_customer,
        t_inventory_s_adjustment,
        t_inventory_transform_item_d,
        t_inventory_transform_item,
        t_sales_return,
        t_surat_jalan_return,
        user: user_default
    } = models;

    // Get all unique reference IDs grouped by source
    const purchaseOrderIds = [];
    const suratJalanIds = [];
    const stockAdjustmentIds = [];
    const transformItemDetailIds = [];
    const transformItemIds = [];
    const salesReturnIds = [];
    const suratJalanReturnIds = [];

    inventoryData.forEach((record) => {
        if (record.reference_source === "t_purchase_order" && record.reference_id) {
            purchaseOrderIds.push(record.reference_id);
        } else if (record.reference_source === "t_surat_jalan" && record.reference_id) {
            suratJalanIds.push(record.reference_id);
        } else if (record.reference_source === "stock_adjustments" && record.reference_id) {
            stockAdjustmentIds.push(record.reference_id);
        } else if ((record.reference_source === "transform_item" || record.reference_source === "transform_item_unpack" || record.reference_source === "transform_item_detail" || record.reference_source === "transform_item_detail_unpack") && record.reference_id) {
            transformItemIds.push(record.reference_id);
        } else if (record.reference_source === "t_sales_return" && record.reference_id) {
            salesReturnIds.push(record.reference_id);
        } else if (record.reference_source === "t_surat_jalan_return" && record.reference_id) {
            suratJalanReturnIds.push(record.reference_id);
        }
    });

    // Fetch supplier data with transaction dates
    const supplierMap = {};
    if (purchaseOrderIds.length > 0) {
        const purchaseOrders = await t_purchase_order.findAll({
            where: { id: { [Op.in]: purchaseOrderIds } },
            include: [
                {
                    model: m_supplier,
                    as: "poSupplier",
                    attributes: ["id", "name", "code"],
                },
            ],
            attributes: ["id", "supplier_id", "date", "createdAt", "code"], // Include date fields and code
        });

        purchaseOrders.forEach((po) => {
            supplierMap[po.id] = {
                supplier: po.poSupplier,
                transactionDate: po.date || po.createdAt, // Use date if available, fallback to createdAt
                transactionCode: po.code || `PO-${po.id}`, // Include transaction code
            };
        });
    }

    // Fetch customer data with transaction dates
    const customerMap = {};
    if (suratJalanIds.length > 0) {
        const suratJalans = await t_surat_jalan.findAll({
            where: { id: { [Op.in]: suratJalanIds } },
            include: [
                {
                    model: m_customer,
                    attributes: ["id", "name", "code"],
                },
                {
                    model: t_surat_jalan_d,
                    attributes: ["id", "price", "item_id"],
                },
            ],
            attributes: ["id", "customer_id", "date", "createdAt", "code"], // Include date fields and code
        });

        suratJalans.forEach((sj) => {
            customerMap[sj.id] = {}
            sj.t_surat_jalan_ds.forEach((item) => {
                customerMap[sj.id][item.item_id] = {
                    cost: item.price,
                    customer: sj.m_customer,
                    transactionDate: sj.date || sj.createdAt, // Use date if available, fallback to createdAt
                    transactionCode: sj.code || `SJ-${sj.id}`, // Include transaction code
                };
            })
        });
    }

    // Fetch stock adjustment data
    const stockAdjustmentMap = {};
    if (stockAdjustmentIds.length > 0) {
        const stockAdjustments = await t_inventory_s_adjustment.findAll({
            where: { id: { [Op.in]: stockAdjustmentIds } },
            include: [
                {
                    model: user_default,
                    attributes: ['id','name']
                }
            ],
            attributes: ["id", "date", "createdAt", "code"]
        });

        stockAdjustments.forEach((sa) => {
            stockAdjustmentMap[sa.id] = {
                customer: sa.user_default || null,
                transactionDate: sa.date || sa.createdAt,
                transactionCode: sa.code || `SA-${sa.id}`,
            };
        });
    }

    // Fetch transform item detail data (with parent transform_item)
    const transformItemDetailMap = {};
    if (transformItemDetailIds.length > 0) {
        const transformItemDetails = await t_inventory_transform_item_d.findAll({
            where: { id: { [Op.in]: transformItemDetailIds } },
            include: [
                {
                    model: t_inventory_transform_item,
                    attributes: ["id", "date", "createdAt", "code"]
                },
            ],
            attributes: ["id", "t_inventory_transform_item_id"]
        });

        transformItemDetails.forEach((tid) => {
            const parent = tid.t_inventory_transform_item;
            transformItemDetailMap[tid.id] = {
                transactionDate: parent?.date || parent?.createdAt,
                transactionCode: parent?.code || `TID-${tid.id}`,
            };
        });
    }

    // Fetch transform item data
    const transformItemMap = {};
    if (transformItemIds.length > 0) {
        const transformItems = await t_inventory_transform_item.findAll({
            where: { id: { [Op.in]: transformItemIds } },
            include: [
                {
                    model: user_default,
                    attributes: ['id','name']
                }
            ],
            attributes: ["id", "date", "createdAt", "code"]
        });

        transformItems.forEach((ti) => {
            transformItemMap[ti.id] = {
                customer: ti.user_default || null,
                transactionDate: ti.date || ti.createdAt,
                transactionCode: ti.code || `TI-${ti.id}`,
            };
        });
    }

    // Fetch sales return data (with customer)
    const salesReturnMap = {};
    if (salesReturnIds.length > 0) {
        const salesReturns = await t_sales_return.findAll({
            where: { id: { [Op.in]: salesReturnIds } },
            include: [
                {
                    model: m_customer,
                    attributes: ["id", "name", "code"],
                },
            ],
            attributes: ["id", "customer_id", "date", "createdAt", "code"]
        });

        salesReturns.forEach((sr) => {
            salesReturnMap[sr.id] = {
                customer: sr.m_customer,
                transactionDate: sr.date || sr.createdAt,
                transactionCode: sr.code || `SR-${sr.id}`,
            };
        });
    }

    // Fetch surat jalan return data (with customer)
    const suratJalanReturnMap = {};
    if (suratJalanReturnIds.length > 0) {
        const suratJalanReturns = await t_surat_jalan_return.findAll({
            where: { id: { [Op.in]: suratJalanReturnIds } },
            include: [
                {
                    model: m_customer,
                    attributes: ["id", "name", "code"],
                },
            ],
            attributes: ["id", "customer_id", "date", "createdAt", "code"]
        });

        suratJalanReturns.forEach((sjr) => {
            suratJalanReturnMap[sjr.id] = {
                customer: sjr.m_customer,
                transactionDate: sjr.date || sjr.createdAt,
                transactionCode: sjr.code || `SJR-${sjr.id}`,
            };
        });
    }

    // Enrich the original data
    return inventoryData.map((record) => {
        record.supplierCustomer = null;
        record.transactionDate = record.createdAt; // Default to ledger createdAt
        record.transactionCode = "N/A";

        if (
            record.reference_source === "t_purchase_order" &&
            supplierMap[record.reference_id]
        ) {
            const poData = supplierMap[record.reference_id];
            record.supplierCustomer = poData.supplier;
            record.transactionDate = poData.transactionDate;
            record.transactionCode = poData.transactionCode;
        } else if (
            record.reference_source === "t_surat_jalan" &&
            customerMap[record.reference_id] &&
            customerMap[record.reference_id][record.item_id]
        ) {
            const sjData = customerMap[record.reference_id][record.item_id];
            record.supplierCustomer = sjData.customer;
            record.cost = sjData.cost;
            record.transactionDate = sjData.transactionDate;
            record.transactionCode = sjData.transactionCode;
        } else if (
            record.reference_source === "stock_adjustments" &&
            stockAdjustmentMap[record.reference_id]
        ) {
            const saData = stockAdjustmentMap[record.reference_id];
            record.supplierCustomer = saData.customer; // Stock adjustments don't have suppliers/customers
            record.transactionDate = saData.transactionDate;
            record.transactionCode = saData.transactionCode;
        } else if (
            (record.reference_source === "transform_item" ||
                record.reference_source === "transform_item_unpack" ||
                record.reference_source === "transform_item_detail" ||
                record.reference_source === "transform_item_detail_unpack") &&
            transformItemMap[record.reference_id]
        ) {
            const tiData = transformItemMap[record.reference_id];
            record.supplierCustomer = tiData.customer; // Transform items don't have suppliers/customers
            record.transactionDate = tiData.transactionDate;
            record.transactionCode = tiData.transactionCode;
        } else if (
            record.reference_source === "t_sales_return" &&
            salesReturnMap[record.reference_id]
        ) {
            const srData = salesReturnMap[record.reference_id];
            record.supplierCustomer = srData.customer;
            record.transactionDate = srData.transactionDate;
            record.transactionCode = srData.transactionCode;
        } else if (
            record.reference_source === "t_surat_jalan_return" &&
            suratJalanReturnMap[record.reference_id]
        ) {
            const sjrData = suratJalanReturnMap[record.reference_id];
            record.supplierCustomer = sjrData.customer;
            record.transactionDate = sjrData.transactionDate;
            record.transactionCode = sjrData.transactionCode;
        }
        return record
    });
};

/**
 * Process inventory data for detail report
 * Includes full transaction details with reference information
 * 
 * @param {Array} inventoryData - Enriched inventory ledger data
 * @param {Object} models - Sequelize models
 * @returns {Array} Processed detail data
 */
const processDetailData = async (inventoryData, models, globalOpeningBalance = 0, globalMutationOpeningBalance = 0) => {
    const processedData = [];
    let globalSaldo = globalOpeningBalance; // Start with global opening balance
    let globalMutasiSaldo = globalMutationOpeningBalance; // Start with global opening balance
    for (let i = 0; i < inventoryData.length; i++) {
        const record = inventoryData[i];

        // Get reference information from enriched data
        const referenceInfo = {
            transactionType: record.m_inventory_type.name,
            transactionCode: record.transactionCode || 'N/A',
            customerSupplier: record.supplierCustomer?.name || 'N/A'
        };

        // Calculate global running saldo (trackable from first row)
        const multiplier = record.m_inventory_type.io_multiplier;
        const quantity = record.quantity;
        const qtyIn = multiplier > 0 ? quantity : 0;
        const qtyOut = multiplier < 0 ? Math.abs(quantity) : 0;
        const unitPrice = record.cost || 0;

        // Update global saldo with current transaction
        globalSaldo += (quantity * multiplier);
        globalMutasiSaldo += (unitPrice * multiplier) * quantity;

        // Format date using enriched transaction date
        const formattedDate = new Date(record.transactionDate || record.createdAt).toLocaleDateString('id-ID');

        // Calculate weight values based on actual_weight
        const actualWeight = parseFloat(record.m_item.actual_weight) || 0;
        const weightKg = actualWeight * quantity; // Total weight for the transaction

        processedData.push([
            i + 1,
            record.m_warehouse.m_unit_bussiness.name,
            formattedDate,
            record.m_warehouse.name,
            record.m_item.code,
            record.m_item.name,
            referenceInfo.transactionType,
            referenceInfo.transactionCode,
            referenceInfo.customerSupplier,
            actualWeight.toLocaleString('id-ID'), // Weight per unit (from m_item.actual_weight)
            (record.cost || 0).toLocaleString('id-ID'), // Transaction value
            qtyIn,
            qtyOut,
            globalSaldo, // Global running saldo (trackable from first row)
            weightKg.toLocaleString('id-ID'), // Total weight KG (actual_weight * quantity)
            unitPrice.toLocaleString('id-ID'), // Unit price
            qtyIn > 0 ? ((record.cost || 0) * (qtyIn)).toLocaleString('id-ID') : 0,
            qtyOut > 0 ? ((record.cost || 0) * (qtyOut)).toLocaleString('id-ID') : 0,
            globalMutasiSaldo.toLocaleString('id-ID') // Global saldo amount
        ]);
    }

    return processedData;
};

/**
 * Process item overstock data for summary report
 * Groups data by company, item, warehouse and calculates overstock amounts
 * 
 * @param {Array} inventoryData - Raw inventory ledger data
 * @returns {Array} Processed summary data
 */
const processSummaryData = (inventoryData) => {
    const processedData = [];

    // Group data by company, item, warehouse
    const groupedData = {};

    inventoryData.forEach(record => {
        const company = record.m_warehouse?.m_unit_bussiness?.name || '';
        const itemCode = record.m_item?.code || '';
        const itemName = record.m_item?.name || '';
        const warehouse = record.m_warehouse?.name || '';
        const maxStock = record.m_item?.max_stock || 0;
        const unit = record.m_item?.itemUom?.value1 || 'PCS';

        const key = `${company}-${itemCode}-${warehouse}`;

        if (!groupedData[key]) {
            groupedData[key] = {
                company,
                date: record.createdAt ? new Date(record.createdAt).toLocaleDateString('id-ID', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                }) : '',
                itemCode,
                itemName,
                unit,
                maxStock,
                warehouse,
                initialStock: 0,
                buyQty: 0,
                sellQty: 0,
                returnQty: 0 // Always 0 as per requirement
            };
        }

        // Calculate quantities based on inventory type io_multiplier
        // io_multiplier > 0 = IN (beli), io_multiplier < 0 = OUT (jual)
        const qty = Math.abs(record.quantity || 0);
        const multiplier = record.m_inventory_type?.io_multiplier || 0;

        if (multiplier > 0) {
            // This is IN (beli) - positive impact on stock
            groupedData[key].buyQty += qty;
        } else if (multiplier < 0) {
            // This is OUT (jual) - negative impact on stock
            groupedData[key].sellQty += qty;
        }
        // Return is hardcoded to 0 as per requirement
    });

    // Convert grouped data to array and calculate overstock
    Object.values(groupedData).forEach(item => {
        const currentStock = item.initialStock + item.buyQty - item.sellQty + item.returnQty;
        const overstock = Math.max(0, currentStock - item.maxStock);

        // Only include items that have overstock
        if (overstock > 0) {
            processedData.push([
                item.company,
                item.date,
                item.itemCode,
                item.itemName,
                item.unit,
                item.maxStock ?? 0,
                item.initialStock ?? 0,
                item.buyQty ?? 0,
                item.sellQty ?? 0,
                item.returnQty ?? 0,
                overstock
            ]);
        }
    });

    return processedData;
};


export const t_inventory_ledgerController = {
    // Contoh: Upload gambar ke database (kolom image: Buffer/BLOB)
    async uploadImage(req, res) {
        const imageFile = req.files?.find(f => f.mimetype.startsWith('image/'));
        if (!imageFile) return res.status(400).json({ error: 'No image file found' });
        try {
            const inserted = await req.models.t_inventory_ledger.create({ image: imageFile.buffer });
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
            const inserted = await req.models.t_inventory_ledger.bulkCreate(records);
            res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    // Contoh: Custom function
    async customFunction(req, res) {
        res.json({ message: 'Custom function untuk t_inventory_ledger', body: req.body, query: req.query });
    },
    async test(req, res) {
        try {
            res.json({ message: 'Purchase received successfully!', body: req.body, query: req.query, response: await inventoryService.recalibrateAllStock() });
        } catch (error) {
            res.json({ message: 'Failed to process purchase:' + error.message, body: req.body, query: req.query });
        }
    },
    async getItemStock(req, res) {
        try {
            const { items, warehouse_id, company_id } = req.query;

            // Use the helper to parse the 'items' parameter into a clean array of numbers
            const itemIds = parseItemIds(items);

            if (itemIds.length === 0) {
                return res.status(400).json({ error: 'Invalid or missing "items" parameter.' });
            }

            if (!inventoryService) {
                return res.status(500).json({ error: 'Inventory service not configured.' });
            }

            let stockData = {};

            if (!!warehouse_id) {
                // --- Case 1: Scoped to a single warehouse ---
                stockData = await inventoryService.getCurrentStockForItemsInWarehouse(
                    itemIds,
                    warehouse_id,
                );

            } else if (!!company_id) {
                // --- Case 2: Scoped to an entire company ---
                stockData = await inventoryService.getCurrentStockForItemsByCompany(
                    itemIds,
                    company_id,
                );

            } else {
                // --- Case 3: Invalid scope ---
                return res.status(400).json({ error: 'You must provide either a "warehouse_id" or a "company_id" to define the scope.' });
            }

            return res.json({ message: 'ok', data: stockData });
            // The service methods already return the data in the desired { id: stock } format.
            return res.status(200).json(stockData);

        } catch (error) {
            console.error('Error in getItemStock controller:', error);
            return res.status(500).json({ error: 'An internal server error occurred while fetching stock.' });
        }
    },
    async getItemCOGS(req, res) {
        try {
            const { items, warehouse_id } = req.query;

            // Use the helper to parse the 'items' parameter into a clean array of numbers
            const itemIds = parseItemIds(items);

            if (itemIds.length === 0) {
                return res.status(400).json({ error: 'Invalid or missing "items" parameter.' });
            }

            if (!inventoryService) {
                return res.status(500).json({ error: 'Inventory service not configured.' });
            }

            let stockData = {};

            if (!!warehouse_id) {
                for (const item of itemIds) {
                    stockData[item] = await inventoryService.getCOGS(item, warehouse_id)
                }
            } else {
                // --- Case 3: Invalid scope ---
                return res.status(400).json({ error: 'You must provide either a "warehouse_id" to define the scope.' });
            }

            return res.json({ message: 'ok', data: stockData });
        } catch (err) {
            console.error('Error in getItemCOGS controller:', err.message);
            return res.status(500).json({ error: 'An internal server error occurred while fetching stock.' });
        }
    },
    async getInventoryLedgerDetailReport(req, res) {
        try {
            // Extract query parameters for filters
            const {
                unit_business_ids = [],     // Array of company IDs
                warehouse_ids = [],         // Array of warehouse IDs
                item_ids = [],              // Array of item IDs
                start_date,                 // Date string (YYYY-MM-DD)
                end_date,                   // Date string (YYYY-MM-DD)
                page = 1,                   // Pagination
                limit = 100                 // Items per page
            } = req.query;

            // Access models from req.models
            const {
                t_inventory_ledger,
                m_item,
                m_warehouse,
                m_unit_bussiness,
                m_gen,
                m_inventory_type,
                t_purchase_order,
                t_surat_jalan,
                m_supplier,
                m_customer
            } = req.models;

            // Build where conditions for filters
            const whereConditions = {};
            const itemWhereConditions = {};
            const warehouseWhereConditions = {};
            const unitBusinessWhereConditions = {};

            // Date range filter
            if (start_date && end_date) {
                // If start_date and end_date are the same, we need to include the entire day
                // by setting end_date to end of day (23:59:59)
                const startDateTime = `${start_date} 00:00:00`;
                const endDateTime = start_date === end_date 
                    ? `${end_date} 23:59:59`
                    : `${end_date} 23:59:59`;
                
                whereConditions.createdAt = {
                    [Op.between]: [startDateTime, endDateTime]
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

            // Item filter
            if (item_ids && item_ids.length > 0) {
                itemWhereConditions.id = {
                    [Op.in]: item_ids
                };
            }

            // Calculate global opening balance (saldo awal) from all transactions before start_date
            let globalOpeningBalance = 0;
            let globalMutationOpeningBalance = 0;
            if (start_date) {
                const openingWhereConditions = {
                    createdAt: {
                        [Op.lt]: `${start_date} 00:00:00`
                    }
                };

                const openingInventoryData = await t_inventory_ledger.findAll({
                    where: openingWhereConditions,
                    include: [
                        {
                            model: m_item,
                            where: itemWhereConditions,
                            required: true,
                            attributes: ['id']
                        },
                        {
                            model: m_warehouse,
                            where: warehouseWhereConditions,
                            required: true,
                            include: [
                                {
                                    model: m_unit_bussiness,
                                    where: unitBusinessWhereConditions,
                                    required: true,
                                    attributes: ['id']
                                }
                            ],
                            attributes: ['id']
                        },
                        {
                            model: m_inventory_type,
                            required: true,
                            attributes: ['id', 'io_multiplier']
                        }
                    ],
                    attributes: ['quantity', 'inventory_type_id', "cost"]
                });

                // Calculate global opening balance by summing all historical transactions
                openingInventoryData.forEach(record => {
                    const multiplier = record.m_inventory_type.io_multiplier;
                    globalOpeningBalance += (record.quantity * multiplier);
                    globalMutationOpeningBalance += ((record.cost * record.quantity) * multiplier)
                });
            }

            // Main query with all relationships for detail report
            const inventoryData = await t_inventory_ledger.findAndCountAll({
                where: whereConditions,
                include: [
                    {
                        model: m_item,
                        where: itemWhereConditions,
                        required: true,
                        include: [
                            {
                                model: m_gen,
                                as: "itemUom",
                                attributes: ['id', 'value1']
                            }
                        ],
                        attributes: ['id', 'name', 'code', 'item_uom_id', 'actual_weight']
                    },
                    {
                        model: m_warehouse,
                        where: warehouseWhereConditions,
                        required: true,
                        include: [
                            {
                                model: m_unit_bussiness,
                                where: unitBusinessWhereConditions,
                                required: true,
                                attributes: ['id', 'name']
                            }
                        ],
                        attributes: ['id', 'name', 'unit_bussiness_id']
                    },
                    {
                        model: m_inventory_type,
                        required: true,
                        attributes: ['id', 'io_multiplier', 'name']
                    }
                ],
                attributes: ['id', 'cost', 'reference_id', 'reference_source', 'item_id', 'quantity', 'warehouse_id', 'inventory_type_id', 'createdAt'],
                order: [
                    ['createdAt', 'ASC'], // Changed to ASC for proper chronological saldo tracking
                    ['warehouse_id', 'ASC'],
                    ['item_id', 'ASC']
                ],
            });

            // Get supplier/customer information for each transaction
            const enrichedData = await enrichWithSupplierCustomer(inventoryData.rows, req.models);
            // Process detail data with global opening balance and trackable saldo
            const processedData = await processDetailData(enrichedData, req.models, globalOpeningBalance, globalMutationOpeningBalance);
            // Response structure
            const response = {
                success: true,
                data: {
                    rows: processedData,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: inventoryData.count,
                        totalPages: Math.ceil(inventoryData.count / parseInt(limit))
                    },
                    filters: {
                        unit_business_ids,
                        warehouse_ids,
                        item_ids,
                        start_date,
                        end_date
                    },
                    opening_balance: globalOpeningBalance
                },
                message: 'Inventory ledger detail report retrieved successfully'
            };

            res.status(200).json(response);

        } catch (error) {
            console.error('Error fetching inventory ledger detail report:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error while fetching inventory ledger detail report',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            });
        }
    },
    async getInventoryLedgerGrouped(req, res) {
        try {
            // Access models from req.models
            const {
                t_inventory_ledger,
                m_inventory_type
            } = req.models;

            // Simple grouped query without filters
            const groupedData = await t_inventory_ledger.findAll({
                include: [
                    {
                        model: m_inventory_type,
                        required: true,
                        attributes: ['name']
                    }
                ],
                attributes: [
                    [literal('m_inventory_type.name'), 'inventory_type_name'],
                    'reference_source'
                ],
                group: [
                    [literal('m_inventory_type.name')],
                    'reference_source'
                ],
                raw: true
            });

            // Response structure
            const response = {
                success: true,
                data: groupedData.map(record => ({
                    inventory_type_name: record.inventory_type_name,
                    reference_source: record.reference_source
                })),
                message: 'Inventory ledger grouped data retrieved successfully'
            };

            res.status(200).json(response);

        } catch (error) {
            console.error('Error fetching grouped inventory ledger data:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error while fetching grouped inventory ledger data',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },
    // Item Overstock Report (Summary only)
    async getItemOverstockReport(req, res) {
        try {
            // Extract query parameters for filters
            const {
                unit_business_ids = [],     // Array of company IDs
                warehouse_ids = [],         // Array of warehouse IDs
                item_ids = [],              // Array of item IDs
                start_date,                 // Date string (YYYY-MM-DD)
                end_date,                   // Date string (YYYY-MM-DD)
                page = 1,                   // Pagination
                limit = 100                 // Items per page
            } = req.query;

            // Access models from req.models
            const {
                t_inventory_ledger,         // Main inventory ledger table
                m_item,
                m_warehouse,
                m_unit_bussiness,
                m_inventory_type,
                m_gen
            } = req.models;

            // Build where conditions for filters
            const whereConditions = {};
            const itemWhereConditions = {};
            const warehouseWhereConditions = {};
            const unitBusinessWhereConditions = {};

            // Date range filter (using createdAt for inventory ledger)
            if (start_date && end_date) {
                if (start_date === end_date) {
                    // Same date - search for records on that specific day
                    const startOfDay = `${start_date} 00:00:00`;
                    const endOfDay = `${start_date} 23:59:59`;
                    whereConditions.createdAt = {
                        [Op.between]: [startOfDay, endOfDay],
                    };
                } else {
                    // Different dates - add time to ensure full day coverage
                    const startOfDay = `${start_date} 00:00:00`;
                    const endOfDay = `${end_date} 23:59:59`;
                    whereConditions.createdAt = {
                        [Op.between]: [startOfDay, endOfDay],
                    };
                }
            } else if (start_date) {
                const startOfDay = `${start_date} 00:00:00`;
                whereConditions.createdAt = {
                    [Op.gte]: startOfDay,
                };
            } else if (end_date) {
                const endOfDay = `${end_date} 23:59:59`;
                whereConditions.createdAt = {
                    [Op.lte]: endOfDay,
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

            // Item filter
            if (item_ids && item_ids.length > 0) {
                itemWhereConditions.id = {
                    [Op.in]: item_ids
                };
            }

            // Only include items that have max_stock defined (for overstock calculation)
            itemWhereConditions.max_stock = {
                [Op.gt]: 0
            };

            // Main query with all relationships
            const inventoryData = await t_inventory_ledger.findAll({
                where: whereConditions,
                include: [
                    {
                        model: m_item,
                        where: itemWhereConditions,
                        required: true,
                        include: [
                            {
                                model: m_gen,
                                as: "itemUom",
                                required: false,
                                attributes: ['id', 'value1']
                            }
                        ],
                        attributes: ['id', 'name', 'code', 'max_stock', 'item_uom_id']
                    },
                    {
                        model: m_warehouse,
                        where: warehouseWhereConditions,
                        required: true,
                        include: [
                            {
                                model: m_unit_bussiness,
                                where: unitBusinessWhereConditions,
                                required: true,
                                attributes: ['id', 'name']
                            }
                        ],
                        attributes: ['id', 'name', 'unit_bussiness_id']
                    },
                    {
                        model: m_inventory_type,
                        required: true,
                        attributes: ['id', 'io_multiplier', 'name']
                    }
                ],
                attributes: ['id', 'quantity', 'cost', 'item_id', 'warehouse_id', 'inventory_type_id', 'createdAt'],
                order: [
                    ['createdAt', 'DESC'],
                    [m_item, 'code', 'ASC']
                ]
            });

            // Process and then paginate the results
            const allProcessedData = processSummaryData(inventoryData);
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
                        item_ids,
                        start_date,
                        end_date
                    }
                },
                message: 'Item overstock report retrieved successfully'
            };

            res.status(200).json(response);

        } catch (error) {
            console.error('Error fetching item overstock report:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error while fetching item overstock report',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            });
        }
    }
};
