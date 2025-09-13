// Controller for m_warehouse
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.m_warehouse
//
// Tambahkan custom function di bawah ini
import { Op, literal } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * Process inventory data for summary report
 * Groups data by warehouse and item, calculates opening, incoming, outgoing, closing
 * 
 * @param {Array} inventoryData - Raw inventory ledger data
 * @returns {Array} Processed summary data
 */
const processSummaryData = (inventoryData) => {
    // Group data by warehouse and item
    const groupedData = {};

    inventoryData.forEach(record => {
        const key = `${record.warehouse_id}-${record.item_id}`;

        if (!groupedData[key]) {
            groupedData[key] = {
                warehouse: record.m_warehouse,
                item: record.m_item,
                opening: 0,
                incoming: 0,
                outgoing: 0,
                closing: 0
            };
        }

        const multiplier = record.m_inventory_type.io_multiplier;
        const quantity = record.quantity * multiplier;

        if (multiplier > 0) {
            groupedData[key].incoming += quantity;
        } else {
            groupedData[key].outgoing += Math.abs(quantity);
        }

        groupedData[key].closing += quantity;
    });

    // Convert to array format for frontend
    let rowNumber = 1;
    return Object.values(groupedData).map(group => [
        rowNumber++,
        group.warehouse.m_unit_bussiness.name,
        group.warehouse.name,
        group.item.code,
        group.item.name,
        group.opening,
        group.incoming,
        group.outgoing,
        group.closing,
        group.item.itemUom?.value1 || 'PCS'
    ]);
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
        t_surat_jalan_return
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
            if (sj.t_surat_jalan_ds) {
                sj.t_surat_jalan_ds.forEach((item) => {
                    customerMap[sj.id][item.item_id] = {
                        cost: item.price,
                        customer: sj.m_customer,
                        transactionDate: sj.date || sj.createdAt, // Use date if available, fallback to createdAt
                        transactionCode: sj.code || `SJ-${sj.id}`, // Include transaction code
                    };
                })
            }
        });
    }

    // Fetch stock adjustment data
    const stockAdjustmentMap = {};
    if (stockAdjustmentIds.length > 0 && t_inventory_s_adjustment) {
        const stockAdjustments = await t_inventory_s_adjustment.findAll({
            where: { id: { [Op.in]: stockAdjustmentIds } },
            attributes: ["id", "date", "createdAt", "code"]
        });

        stockAdjustments.forEach((sa) => {
            stockAdjustmentMap[sa.id] = {
                transactionDate: sa.date || sa.createdAt,
                transactionCode: sa.code || `SA-${sa.id}`,
            };
        });
    }

    // Fetch transform item detail data (with parent transform_item)
    const transformItemDetailMap = {};
    if (transformItemDetailIds.length > 0 && t_inventory_transform_item_d) {
        const transformItemDetails = await t_inventory_transform_item_d.findAll({
            where: { id: { [Op.in]: transformItemDetailIds } },
            include: [
                {
                    model: t_inventory_transform_item,
                    attributes: ["id", "date", "createdAt", "code"]
                }
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
    if (transformItemIds.length > 0 && t_inventory_transform_item) {
        const transformItems = await t_inventory_transform_item.findAll({
            where: { id: { [Op.in]: transformItemIds } },
            attributes: ["id", "date", "createdAt", "code"]
        });

        transformItems.forEach((ti) => {
            transformItemMap[ti.id] = {
                transactionDate: ti.date || ti.createdAt,
                transactionCode: ti.code || `TI-${ti.id}`,
            };
        });
    }

    // Fetch sales return data (with customer)
    const salesReturnMap = {};
    if (salesReturnIds.length > 0 && t_sales_return) {
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
    if (suratJalanReturnIds.length > 0 && t_surat_jalan_return) {
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
            record.supplierCustomer = null; // Stock adjustments don't have suppliers/customers
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
            record.supplierCustomer = null; // Transform items don't have suppliers/customers
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
 * Calculate opening balances for each item-warehouse combination before the start date
 * @param {Object} filters - Filter parameters
 * @param {Object} models - Database models
 * @returns {Object} Opening balances keyed by item-warehouse combination
 */
const calculateOpeningBalances = async (filters, models) => {
    const {
        start_date,
        unit_business_ids,
        warehouse_ids,
        group_item_ids,
        supplier_ids,
        item_ids
    } = filters;

    const {
        t_inventory_ledger,
        m_item,
        m_warehouse,
        m_unit_bussiness,
        m_inventory_type,
        t_purchase_order,
        t_surat_jalan
    } = models;

    // If no start_date provided, return empty balances
    if (!start_date) {
        return {};
    }

    // Build where conditions for opening balance calculation
    const whereConditions = {
        createdAt: {
            [Op.lt]: start_date // Before start date
        }
    };

    const itemWhereConditions = {};
    const warehouseWhereConditions = {};
    const unitBusinessWhereConditions = {};

    // Apply same filters as main query
    if (unit_business_ids && unit_business_ids.length > 0) {
        unitBusinessWhereConditions.id = {
            [Op.in]: unit_business_ids
        };
    }

    if (warehouse_ids && warehouse_ids.length > 0) {
        warehouseWhereConditions.id = {
            [Op.in]: warehouse_ids
        };
    }

    if (item_ids && item_ids.length > 0) {
        itemWhereConditions.id = {
            [Op.in]: item_ids
        };
    }

    if (group_item_ids && group_item_ids.length > 0) {
        itemWhereConditions.group_item_id = {
            [Op.in]: group_item_ids
        };
    }

    // Handle supplier/customer filter for opening balance
    if (supplier_ids && supplier_ids.length > 0) {
        const supplierIds = [];
        const customerIds = [];

        supplier_ids.forEach(id => {
            if (typeof id === 'string' && id.startsWith('supplier_')) {
                supplierIds.push(id.replace('supplier_', ''));
            } else if (typeof id === 'string' && id.startsWith('customer_')) {
                customerIds.push(id.replace('customer_', ''));
            } else {
                supplierIds.push(id);
            }
        });

        const supplierCustomerConditions = [];

        if (supplierIds.length > 0) {
            const purchaseOrders = await t_purchase_order.findAll({
                where: {
                    supplier_id: {
                        [Op.in]: supplierIds
                    }
                },
                attributes: ['id']
            });

            const purchaseOrderIds = purchaseOrders.map(po => po.id);

            if (purchaseOrderIds.length > 0) {
                supplierCustomerConditions.push({
                    [Op.and]: [
                        { reference_source: 't_purchase_order' },
                        { reference_id: { [Op.in]: purchaseOrderIds } }
                    ]
                });
            }
        }

        if (customerIds.length > 0) {
            const suratJalans = await t_surat_jalan.findAll({
                where: {
                    customer_id: {
                        [Op.in]: customerIds
                    }
                },
                attributes: ['id']
            });

            const suratJalanIds = suratJalans.map(sj => sj.id);

            if (suratJalanIds.length > 0) {
                supplierCustomerConditions.push({
                    [Op.and]: [
                        { reference_source: 't_surat_jalan' },
                        { reference_id: { [Op.in]: suratJalanIds } }
                    ]
                });
            }
        }

        if (supplierCustomerConditions.length > 0) {
            whereConditions[Op.or] = supplierCustomerConditions;
        }
    }

    // Use SQL SUM to calculate opening balances efficiently
    const openingData = await t_inventory_ledger.findAll({
        where: whereConditions,
        include: [
            {
                model: m_item,
                where: itemWhereConditions,
                required: true,
                attributes: []
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
                        attributes: []
                    }
                ],
                attributes: []
            },
            {
                model: m_inventory_type,
                required: true,
                attributes: []
            }
        ],
        attributes: [
            'item_id',
            'warehouse_id',
            [literal('SUM(quantity * m_inventory_type.io_multiplier)'), 'opening_balance']
        ],
        group: ['item_id', 'warehouse_id'],
        raw: true
    });

    // Convert to keyed object
    const balances = {};

    openingData.forEach(record => {
        const key = `${record.item_id}-${record.warehouse_id}`;
        balances[key] = parseFloat(record.opening_balance) || 0;
    });

    return balances;
};

/**
 * Process inventory data for detail report format
 * Groups data by item and creates the structure shown in the screenshot
 * 
 * @param {Array} inventoryData - Enriched inventory ledger data
 * @param {Object} openingBalances - Opening balances keyed by item-warehouse combination
 * @returns {Array} Processed detail report data
 */
const processDetailData = (inventoryData, openingBalances = {}) => {
    // Group data by item
    const groupedByItem = {};

    inventoryData.forEach(record => {
        const itemKey = `${record.m_item.id}-${record.m_warehouse.id}`;

        if (!groupedByItem[itemKey]) {
            groupedByItem[itemKey] = {
                item: record.m_item,
                warehouse: record.m_warehouse,
                company: record.m_warehouse.m_unit_bussiness,
                transactions: [],
                openingBalance: 0,
                closingBalance: 0
            };
        }

        groupedByItem[itemKey].transactions.push(record);
    });

    // Convert to report format
    const reportData = [];

    Object.values(groupedByItem).forEach(itemGroup => {
        const { item, warehouse, company, transactions } = itemGroup;

        // Get opening balance from calculated balances
        const itemWarehouseKey = `${item.id}-${warehouse.id}`;
        const openingBalance = openingBalances[itemWarehouseKey] || 0;

        // Calculate period totals
        let totalIncoming = 0;
        let totalOutgoing = 0;
        let runningBalance = openingBalance;

        transactions.forEach(transaction => {
            const multiplier = transaction.m_inventory_type.io_multiplier;
            const quantity = transaction.quantity * multiplier;

            if (multiplier > 0) {
                totalIncoming += quantity;
            } else {
                totalOutgoing += Math.abs(quantity);
            }

            runningBalance += quantity;
            transaction.runningBalance = runningBalance;
        });

        const closingBalance = openingBalance + totalIncoming - totalOutgoing;

        // Add opening balance row (Item name in first column, Saldo Awal in supplier column)
        reportData.push([
            {
                value: item.name, colspan: 7, cellStyle: {
                    fontWeight: 700
                }
            }, // Item name in No column
            '',
            '',
            '',
            '',
            '',
            '',
            {
                value: 'Saldo Awal',
                cellStyle: {
                    fontWeight: 700
                }
            }, // Supplier/Customer
            '', // Masuk
            '', // Keluar
            openingBalance, // Balance
            item.itemUom?.value1 || 'PCS'
        ]);

        // Add transaction rows
        transactions.forEach((transaction, index) => {
            const multiplier = transaction.m_inventory_type.io_multiplier;
            const quantity = transaction.quantity;
            const masuk = multiplier > 0 ? quantity : '';
            const keluar = multiplier < 0 ? Math.abs(quantity) : '';

            // Format transaction date
            const transactionDate = transaction.transactionDate
                ? new Date(transaction.transactionDate).toLocaleDateString('id-ID')
                : new Date(transaction.createdAt).toLocaleDateString('id-ID');

            reportData.push([
                index + 1, // Row number
                company.name,
                warehouse.name,
                item.itemGroup?.value1 || '',
                item.code,
                item.name,
                transactionDate,
                transaction.supplierCustomer?.name || '',
                masuk || 0,
                keluar || 0,
                transaction.runningBalance || 0, // This should be calculated cumulatively
                item.itemUom?.value1 || 'PCS'
            ]);
        });

        // Add total row with full colspan from beginning to Saldo Akhir
        reportData.push([
            {
                value: 'Total', colspan: 7, cellStyle: {
                    fontWeight: 700
                }
            }, // Spans from No to Supplier/Customer columns
            '',
            '',
            '',
            '',
            '',
            '',
            {
                value: 'Saldo Akhir',
                cellStyle: {
                    fontWeight: 700
                }
            },
            totalIncoming,
            totalOutgoing,
            closingBalance,
            item.itemUom?.value1 || 'PCS'
        ]);
    });

    return reportData;
};


export const m_warehouseController = {
    // Contoh: Upload gambar ke database (kolom image: Buffer/BLOB)
    async uploadImage(req, res) {
        const imageFile = req.files?.find(f => f.mimetype.startsWith('image/'));
        if (!imageFile) return res.status(400).json({ error: 'No image file found' });
        try {
            const inserted = await req.models.m_warehouse.create({ image: imageFile.buffer });
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
            const inserted = await req.models.m_warehouse.bulkCreate(records);
            res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    // Contoh: Custom function
    async customFunction(req, res) {
        res.json({ message: 'Custom function untuk m_warehouse', body: req.body, query: req.query });
    },
    async getStockWarehouseReport(req, res) {
        try {
            // Extract query parameters for filters
            const {
                unit_business_ids = [],     // Array of company IDs
                warehouse_ids = [],         // Array of warehouse IDs
                group_item_ids = [],        // Array of item group IDs
                supplier_ids = [],          // Array of supplier IDs
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

            // Date range filter - fixed to handle single date and add time properly
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

            // Group Item filter
            if (group_item_ids && group_item_ids.length > 0) {
                itemWhereConditions.item_group_id = {
                    [Op.in]: group_item_ids
                };
            }

            if (supplier_ids && supplier_ids.length > 0) {
                // Parse supplier_ids to separate suppliers and customers
                const supplierIds = [];
                const customerIds = [];

                supplier_ids.forEach(id => {
                    if (typeof id === 'string' && id.startsWith('supplier_')) {
                        supplierIds.push(id.replace('supplier_', ''));
                    } else if (typeof id === 'string' && id.startsWith('customer_')) {
                        customerIds.push(id.replace('customer_', ''));
                    } else {
                        // Assume it's a supplier ID if no prefix
                        supplierIds.push(id);
                    }
                });

                // Build complex where conditions for suppliers and customers
                const supplierCustomerConditions = [];

                if (supplierIds.length > 0) {
                    // Find purchase orders with matching supplier IDs
                    supplierCustomerConditions.push({
                        [Op.and]: [
                            { reference_source: 't_purchase_order' },
                            {
                                reference_id: {
                                    [Op.in]: literal(`(
                                    SELECT id FROM t_purchase_order 
                                    WHERE supplier_id IN ('${supplierIds.join("','")}')
                                )`)
                                }
                            }
                        ]
                    });
                }

                if (customerIds.length > 0) {
                    // Find surat jalan with matching customer IDs
                    supplierCustomerConditions.push({
                        [Op.and]: [
                            { reference_source: 't_surat_jalan' },
                            {
                                reference_id: {
                                    [Op.in]: literal(`(
                                    SELECT id FROM t_surat_jalan 
                                    WHERE customer_id IN ('${customerIds.join("','")}')
                                )`)
                                }
                            }
                        ]
                    });
                }

                if (supplierCustomerConditions.length > 0) {
                    whereConditions[Op.or] = supplierCustomerConditions;
                }
            }

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
                                attributes: ['id', 'value1']
                            }
                        ],
                        attributes: ['id', 'name', 'code', 'item_uom_id']
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
                        attributes: ['id', 'io_multiplier']
                    }
                ],
                attributes: ['id', 'item_id', 'quantity', 'warehouse_id', 'inventory_type_id'],
                order: [
                    ['warehouse_id', 'ASC'],
                    ['item_id', 'ASC']
                ]
            });

            // Process and then paginate the grouped results
            const allGroupedData = processSummaryData(inventoryData);
            const startIndex = (parseInt(page) - 1) * parseInt(limit);
            const endIndex = startIndex + parseInt(limit);
            const processedData = allGroupedData.slice(startIndex, endIndex);

            const totalCount = allGroupedData.length;

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
                        group_item_ids,
                        supplier_ids,
                        item_ids,
                        start_date,
                        end_date
                    }
                },
                message: 'Stock warehouse report retrieved successfully'
            };

            res.status(200).json(response);

        } catch (error) {
            console.error('Error fetching stock warehouse report:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error while fetching stock warehouse report',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            });
        }
    },
    async getStockWarehouseDetailReport(req, res) {
        try {
            // Extract query parameters for filters
            const {
                unit_business_ids = [],     // Array of company IDs
                warehouse_ids = [],         // Array of warehouse IDs
                group_item_ids = [],        // Array of item group IDs
                supplier_ids = [],          // Array of supplier IDs
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
                t_surat_jalan_d,
                m_supplier,
                m_customer,
                t_inventory_s_adjustment,
                t_inventory_transform_item_d,
                t_inventory_transform_item,
                t_sales_return,
                t_surat_jalan_return
            } = req.models;

            // Build where conditions for filters
            const whereConditions = {};
            const itemWhereConditions = {};
            const warehouseWhereConditions = {};
            const unitBusinessWhereConditions = {};

            // Date range filter - fixed to handle single date and add time properly
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

            // Group Item filter
            if (group_item_ids && group_item_ids.length > 0) {
                itemWhereConditions.item_group_id = {
                    [Op.in]: group_item_ids
                };
            }

            // Supplier/Customer filter using reference_source and reference_id
            if (supplier_ids && supplier_ids.length > 0) {
                // Parse supplier_ids to separate suppliers and customers
                const supplierIds = [];
                const customerIds = [];

                supplier_ids.forEach(id => {
                    if (typeof id === 'string' && id.startsWith('supplier_')) {
                        supplierIds.push(id.replace('supplier_', ''));
                    } else if (typeof id === 'string' && id.startsWith('customer_')) {
                        customerIds.push(id.replace('customer_', ''));
                    } else {
                        // Assume it's a supplier ID if no prefix
                        supplierIds.push(id);
                    }
                });

                // Build complex where conditions for suppliers and customers
                const supplierCustomerConditions = [];

                if (supplierIds.length > 0) {
                    // Get purchase order IDs first
                    const purchaseOrders = await t_purchase_order.findAll({
                        where: {
                            supplier_id: {
                                [Op.in]: supplierIds
                            }
                        },
                        attributes: ['id']
                    });

                    const purchaseOrderIds = purchaseOrders.map(po => po.id);

                    if (purchaseOrderIds.length > 0) {
                        supplierCustomerConditions.push({
                            [Op.and]: [
                                { reference_source: 't_purchase_order' },
                                { reference_id: { [Op.in]: purchaseOrderIds } }
                            ]
                        });
                    }
                }

                if (customerIds.length > 0) {
                    // Get surat jalan IDs first
                    const suratJalans = await t_surat_jalan.findAll({
                        where: {
                            customer_id: {
                                [Op.in]: customerIds
                            }
                        },
                        attributes: ['id']
                    });

                    const suratJalanIds = suratJalans.map(sj => sj.id);

                    if (suratJalanIds.length > 0) {
                        supplierCustomerConditions.push({
                            [Op.and]: [
                                { reference_source: 't_surat_jalan' },
                                { reference_id: { [Op.in]: suratJalanIds } }
                            ]
                        });
                    }
                }

                if (supplierCustomerConditions.length > 0) {
                    whereConditions[Op.or] = supplierCustomerConditions;
                }
            }

            // Main query with all relationships - get detailed transaction data
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
                                attributes: ['id', 'value1']
                            },
                            {
                                model: m_gen,
                                as: "itemGroup",
                                attributes: ['id', 'value1']
                            }
                        ],
                        attributes: ['id', 'name', 'code', 'item_uom_id', 'item_group_id']
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
                attributes: [
                    'id',
                    'item_id',
                    'quantity',
                    'warehouse_id',
                    'inventory_type_id',
                    'reference_source',
                    'reference_id',
                    'createdAt'
                ],
                order: [
                    ['item_id', 'ASC'],
                    ['warehouse_id', 'ASC'],
                    ['createdAt', 'ASC']
                ]
            });


            // Get opening balances for each item-warehouse combination
            const openingBalances = await calculateOpeningBalances({
                start_date,
                unit_business_ids,
                warehouse_ids,
                group_item_ids,
                supplier_ids,
                item_ids
            }, {
                t_inventory_ledger,
                m_item,
                m_warehouse,
                m_unit_bussiness,
                m_inventory_type,
                t_purchase_order,
                t_surat_jalan
            });

            // Get supplier/customer information for each transaction
            const enrichedData = await enrichWithSupplierCustomer(inventoryData, {
                t_purchase_order,
                t_surat_jalan,
                t_surat_jalan_d,
                m_supplier,
                m_customer,
                t_inventory_s_adjustment,
                t_inventory_transform_item_d,
                t_inventory_transform_item,
                t_sales_return,
                t_surat_jalan_return
            });

            // Process data for detail report format
            const processedData = await processDetailData(enrichedData, openingBalances);

            // Apply pagination to the processed data
            const startIndex = (parseInt(page) - 1) * parseInt(limit);
            const endIndex = startIndex + parseInt(limit);
            const paginatedData = processedData.slice(startIndex, endIndex);

            // Response structure
            const response = {
                success: true,
                data: {
                    rows: paginatedData,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: processedData.length,
                        totalPages: Math.ceil(processedData.length / limit)
                    },
                    filters: {
                        unit_business_ids,
                        warehouse_ids,
                        group_item_ids,
                        supplier_ids,
                        item_ids,
                        start_date,
                        end_date
                    }
                },
                message: 'Stock warehouse detail report retrieved successfully'
            };

            res.status(200).json(response);

        } catch (error) {
            console.error('Error fetching stock warehouse detail report:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error while fetching stock warehouse detail report',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            });
        }
    },
    async checkAssoc(req, res) {
        const {
            m_warehouse
        } = req.models;
        const instance = await m_warehouse.findByPk("cf87f2a1-2765-4144-b90e-7f59e411fc61")
        // const existingRelations = await checkRelatedRecordsExist(sequelize, 'm_warehouse', instance);
        const existingRelations = getAllRelatedModels(sequelize, 'm_warehouse');
        res.status(200).json({ existingRelations });
    }
};












