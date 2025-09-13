import moment from 'moment';
import { Op, literal } from 'sequelize';

import m_set_approval from '../models/m_set_approval.js';
import m_set_approval_d from '../models/m_set_approval_d.js';

import m_format_num from '../models/m_format_num.js';
import m_format_num_d from '../models/m_format_num_d.js';
import m_prefix_num from '../models/m_prefix_num.js';
import m_gen from '../models/m_gen.js';
import m_unit_bussiness from '../models/m_unit_bussiness.js';

import { sequelize } from '../config/database.js';
import t_inventory_ledger from '../models/t_inventory_ledger.js';
import m_item from '../models/m_item.js';
import m_warehouse from '../models/m_warehouse.js';
import t_inventory_s_batches from '../models/t_inventory_s_batches.js';
import t_inventory_s_average from '../models/t_inventory_s_average.js';
import m_inventory_type from '../models/m_inventory_type.js';
import t_inventory_reservations from '../models/t_inventory_reservations.js';

// import accounting models
import t_accounting_journal from '../models/t_accounting_journal.js';
import t_accounting_journal_d from '../models/t_accounting_journal_d.js';
import m_interface from '../models/m_interface.js';
import m_interface_d from '../models/m_interface_d.js';

const uri = 'https://server.qqltech.com:7093'

const localPath = [
    '/opt/www/express/BE-bbs'
]
function removeLocalPath(string) {
    for (const base of localPath) {
        if (string.startsWith(base)) {
            return string.replace(base, "");
        }
    }
}

/**
 * @class InventoryService
 * @description A comprehensive inventory management service that handles all stock operations
 * including movements, cost calculations, batch tracking, and stock allocations. This service
 * provides a unified interface for managing both batch-tracked items (using FEFO - First-Expired,
 * First-Out) and standard items (using moving average cost). All operations are atomic and
 * wrapped in database transactions to ensure data integrity.
 *
 * Key Features:
 * - Dual inventory tracking: batch-based and average cost methods
 * - FEFO (First-Expired, First-Out) logic for batch items
 * - Moving average cost calculation for non-batch items
 * - Stock allocation and reservation system
 * - Comprehensive recalibration utilities
 * - Multi-warehouse support
 * - Transaction-safe operations
 */
class InventoryService {
    /**
     * @constructor
     * @description Initializes the InventoryService with references to all required Sequelize models.
     * This service assumes that the database connection has been established and all models
     * are properly configured with their associations.
     *
     * @throws {Error} If any required Sequelize models are not available
     *
     * Required Models:
     * - sequelize: Main database connection instance
     * - m_item: Items master table
     * - t_inventory_s_batches: Item batches with expiration tracking
     * - t_inventory_ledger: All inventory transactions log
     * - m_warehouse: Warehouses master table
     * - t_inventory_s_average: Stock summaries with average costs
     * - m_inventory_type: Transaction types (in/out multipliers)
     * - t_inventory_reservations: Stock allocation/reservation records
     */
    constructor() {
        this.sequelize = sequelize;
        this.Item = m_item;
        this.ItemBatch = t_inventory_s_batches;
        this.InventoryLedger = t_inventory_ledger;
        this.Warehouse = m_warehouse;
        this.ItemWarehouseStock = t_inventory_s_average;
        this.TransactionType = m_inventory_type;
        this.StockAllocation = t_inventory_reservations;
    }

    /**
     * @method insertStock
     * @description The primary method for recording any inventory movement (inbound or outbound).
     * This method automatically handles the complexity of different item types and maintains
     * all necessary data structures including ledger entries, batch records, and summary tables.
     *
     * **Stock-In Operations (Purchase Receipts, Adjustments In, etc.):**
     * - Creates ledger entries with positive quantities
     * - For batch items: Creates new batch records with expiration tracking
     * - For non-batch items: Updates moving average cost calculations
     * - Updates summary stock levels
     *
     * **Stock-Out Operations (Sales Issues, Adjustments Out, etc.):**
     * - Creates ledger entries with negative quantities
     * - For batch items: Issues from batches using FEFO logic (oldest expiry first)
     * - For non-batch items: Uses current average cost for valuation
     * - Validates sufficient stock availability before processing
     *
     * @param {Object} options - Stock transaction parameters
     * @param {number} options.item_id - Item identifier (must exist in m_item)
     * @param {number} options.warehouse_id - Warehouse identifier (must exist in m_warehouse)
     * @param {number} options.quantity - Transaction quantity (always positive, direction determined by transaction type)
     * @param {string} options.transactionTypeName - Transaction type name from m_inventory_type (e.g., "Purchase Receipt", "Sales Issue")
     * @param {number} [options.unitCost=null] - Cost per unit. **REQUIRED** for stock-in transactions, ignored for stock-out
     * @param {number} [options.reference_id=null] - Related document ID (e.g., Purchase Order ID, Sales Order ID)
     * @param {string} [options.reference_source=null] - Source table name for reference_id (e.g., 't_purchase_orders')
     * @param {string} [options.batchNumber=null] - Batch identifier. **REQUIRED** for batch-tracked items on stock-in
     * @param {Date} [options.expirationDate=null] - Batch expiration date. Recommended for perishable batch items
     *
     * @returns {Promise<Array<Object>>} Array of created inventory ledger entries
     *
     * @throws {Error} When required parameters are missing:
     *   - unitCost missing for stock-in operations
     *   - batchNumber missing for batch-tracked items on stock-in
     *   - Invalid item_id or transactionTypeName
     * @throws {Error} When insufficient stock available for stock-out operations
     */
    async insertStock({
        item_id,
        warehouse_id,
        quantity,
        transactionTypeName,
        unitCost = null, // Now optional
        reference_id = null,
        reference_source = null,
        batchNumber = null, // Only used for stock-in
        expirationDate = null, // Only used for stock-in
        transaction = null
    }) {
        const doTransaction = async (t) => {
            const transactionTypeId = await this.getTransactionTypeIdByName(
                transactionTypeName
            );
            const item = await this.Item.findByPk(item_id, { transaction: t });
            const transactionType = await this.TransactionType.findByPk(
                transactionTypeId,
                { transaction: t }
            );
            if (!item || !transactionType)
                throw new Error("Invalid Item or Transaction Type.");

            const createdLedgerEntries = [];
            const quantityChange = quantity * transactionType.io_multiplier;

            // Find or create the summary record for this item/warehouse
            const [stockSummary] = await this.ItemWarehouseStock.findOrCreate({
                where: { item_id, warehouse_id },
                defaults: { on_hand_quantity: 0, average_cost: 0 },
                transaction: t,
            });

            if (transactionType.io_multiplier > 0) {
                // --- STOCK IN LOGIC ---
                if (unitCost === null)
                    throw new Error(
                        "unitCost is required for stock-in transactions."
                    );

                let finalBatchId = null;
                if (item.is_batch) {
                    if (!batchNumber)
                        throw new Error(
                            "batchNumber is required when creating a new batch."
                        );
                    const newBatch = await this.ItemBatch.create(
                        {
                            item_id,
                            warehouse_id,
                            batch_number: batchNumber,
                            on_hand_quantity: quantity,
                            last_on_hand_quantity: 0,
                            purchase_cost: unitCost,
                            purchase_date: new Date(),
                            expiration_date: expirationDate,
                        },
                        { transaction: t }
                    );
                    finalBatchId = newBatch.id;
                }

                const ledgerEntry = await this.InventoryLedger.create(
                    {
                        item_id,
                        warehouse_id,
                        batch_id: finalBatchId,
                        inventory_type_id: transactionTypeId,
                        quantity,
                        cost: Math.round(unitCost),
                        reference_id,
                        reference_source,
                    },
                    { transaction: t }
                );
                createdLedgerEntries.push(ledgerEntry);

                // Update summary table for stock-in
                if (item.is_batch) {
                    await stockSummary.increment("on_hand_quantity", {
                        by: quantityChange,
                        transaction: t,
                    });
                } else {
                    const oldQuantity = stockSummary.on_hand_quantity;
                    const oldAvgCost = stockSummary.average_cost;
                    const newTotalQuantity = oldQuantity + quantity;
                    let newAverageCost =
                        newTotalQuantity > 0
                            ? (oldQuantity * oldAvgCost + quantity * unitCost) /
                            newTotalQuantity
                            : unitCost;
                    await stockSummary.update(
                        {
                            on_hand_quantity: oldQuantity + quantityChange,
                            average_cost: newAverageCost,
                        },
                        { transaction: t }
                    );
                }
            } else {
                // --- STOCK OUT LOGIC ---
                if (item.is_batch) {
                    let remainingQtyToIssue = quantity;
                    const availableBatches = await this.ItemBatch.findAll({
                        where: {
                            item_id,
                            warehouse_id,
                            on_hand_quantity: { [Op.gt]: 0 },
                        },
                        order: [
                            ["expiration_date", "ASC"],
                            ["purchase_date", "ASC"],
                        ],
                        transaction: t,
                    });

                    for (const batch of availableBatches) {
                        if (remainingQtyToIssue <= 0) break;
                        const qtyFromThisBatch = Math.min(
                            remainingQtyToIssue,
                            batch.on_hand_quantity
                        );

                        const ledgerEntry = await this.InventoryLedger.create(
                            {
                                item_id,
                                warehouse_id,
                                batch_id: batch.id,
                                inventory_type_id: transactionTypeId,
                                quantity: qtyFromThisBatch,
                                cost: Math.round(batch.purchase_cost),
                                reference_id,
                                reference_source,
                            },
                            { transaction: t }
                        );
                        createdLedgerEntries.push(ledgerEntry);

                        await batch.decrement("on_hand_quantity", {
                            by: qtyFromThisBatch,
                            transaction: t,
                        });
                        remainingQtyToIssue -= qtyFromThisBatch;
                    }

                    if (remainingQtyToIssue > 0)
                        throw new Error(
                            `Insufficient stock. Could not fulfill ${remainingQtyToIssue} out of ${quantity} units.`
                        );

                    await stockSummary.increment("on_hand_quantity", {
                        by: quantityChange,
                        transaction: t,
                    });
                } else {
                    const costOfGoodsSold = await this.getCOGS(
                        item_id,
                        warehouse_id,
                        t
                    );
                    const ledgerEntry = await this.InventoryLedger.create(
                        {
                            item_id,
                            warehouse_id,
                            batch_id: null,
                            inventory_type_id: transactionTypeId,
                            quantity,
                            cost: Math.round(costOfGoodsSold),
                            reference_id,
                            reference_source,
                        },
                        { transaction: t }
                    );
                    createdLedgerEntries.push(ledgerEntry);

                    await stockSummary.update(
                        {
                            on_hand_quantity:
                                stockSummary.on_hand_quantity + quantityChange,
                        },
                        { transaction: t }
                    );
                }
            }

            return createdLedgerEntries;
        }

        if (!!transaction && !transaction.finished) return await doTransaction(transaction)
        return this.sequelize.transaction(doTransaction);
    }

    /**
     * @method recalibrateAllStock
     * @description [ADMIN FUNCTION] Performs system-wide stock recalibration for all item-warehouse
     * combinations. This is a resource-intensive operation that should only be executed during
     * maintenance windows or off-peak hours. Use this function when you suspect widespread
     * data inconsistencies or after bulk data imports/corrections.
     *
     * **Warning:** This operation can take significant time and database resources depending on
     * the number of items and transaction history. Consider running during low-traffic periods.
     *
     * The process:
     * 1. Identifies all unique item-warehouse pairs from the ledger
     * 2. Sequentially processes each pair to avoid database overload
     * 3. Captures and reports any failures for manual review
     * 4. Provides detailed summary report
     *
     * @returns {Promise<Object>} Comprehensive operation summary
     * @returns {number} returns.total_pairs_processed - Total item-warehouse combinations processed
     * @returns {number} returns.success_count - Number of successful recalibrations
     * @returns {number} returns.failure_count - Number of failed recalibrations
     * @returns {Array<Object>} returns.errors - Detailed error information for failed recalibrations
     */
    async recalibrateAllStock() {
        // Find all unique item-warehouse combinations that have stock records.
        const allStockPairs = await this.InventoryLedger.findAll({
            attributes: ["item_id", "warehouse_id"],
            group: ["item_id", "warehouse_id"],
            raw: true,
        });

        let successCount = 0;
        let failureCount = 0;
        const errors = [];

        console.log(
            `Starting system-wide recalibration for ${allStockPairs.length} item-warehouse pairs...`
        );

        // Sequentially process each pair to avoid overwhelming the database.
        for (const pair of allStockPairs) {
            try {
                await this.recalibrateStock(pair.item_id, pair.warehouse_id);
                successCount++;
            } catch (error) {
                failureCount++;
                const errorInfo = {
                    item_id: pair.item_id,
                    warehouse_id: pair.warehouse_id,
                    error: error.message,
                };
                errors.push(errorInfo);
                console.error(
                    `Failed to recalibrate item ${pair.item_id} in warehouse ${pair.warehouse_id}:`,
                    error.message
                );
            }
        }

        const summaryReport = {
            total_pairs_processed: allStockPairs.length,
            success_count: successCount,
            failure_count: failureCount,
            errors: errors,
        };

        console.log("System-wide recalibration complete.", summaryReport);
        return summaryReport;
    }

    /**
     * @method recalibrateStock
     * @description Recalculates and synchronizes stock data for a specific item in a warehouse.
     * This method ensures that summary tables accurately reflect the ledger transaction history.
     * It's essential for maintaining data integrity, especially after manual corrections,
     * bulk imports, or system recovery scenarios.
     *
     * **When to use:**
     * - After manual database corrections
     * - When summary data appears inconsistent with transaction history
     * - After bulk data imports or migrations
     * - As part of regular maintenance routines
     * - When investigating stock discrepancies
     *
     * **Process for Batch Items:**
     * - Recalculates batch quantities based on ledger transactions
     * - Updates individual batch on_hand_quantity values
     * - Synchronizes total stock in summary table
     *
     * **Process for Non-Batch Items:**
     * - Recalculates moving average cost from transaction history
     * - Updates total on_hand_quantity
     * - Ensures cost accuracy for future COGS calculations
     *
     * @param {number} item_id - The item identifier to recalibrate
     * @param {number} warehouse_id - The warehouse identifier to recalibrate
     *
     * @returns {Promise<Object>} Operation result
     * @returns {boolean} returns.success - Whether the operation completed successfully
     * @returns {string} returns.message - Descriptive message about the operation outcome
     *
     * @throws {Error} If the specified item_id does not exist in the system
     */
    async recalibrateStock(item_id, warehouse_id) {
        const item = await this.Item.findByPk(item_id);
        if (!item) throw new Error(`Item with ID ${item_id} not found.`);
        if (item.is_batch) {
            return this._recalibrateBatchItem({ item_id, warehouse_id });
        } else {
            return this._recalibrateAverageCostItem({ item_id, warehouse_id });
        }
    }

    /**
     * @method _recalibrateAverageCostItem
     * @private
     * @description Internal method that recalculates stock levels and moving average cost for
     * non-batch items. This method processes all ledger transactions since the last recalibration
     * timestamp, maintaining a running total of quantity and recalculating the weighted average
     * cost with each stock-in transaction.
     *
     * **Moving Average Cost Logic:**
     * - Stock-in: Recalculates weighted average = (old_qty × old_cost + new_qty × new_cost) / total_qty
     * - Stock-out: Uses existing average cost, no cost recalculation needed
     * - Final values update both current and "last known good" fields for future incremental updates
     *
     * @param {Object} options - Recalibration parameters
     * @param {number} options.item_id - Item identifier
     * @param {number} options.warehouse_id - Warehouse identifier
     *
     * @returns {Promise<Object>} Operation result with success status and processing details
     */
    async _recalibrateAverageCostItem({ item_id, warehouse_id }) {
        return this.sequelize.transaction(async (t) => {
            const stockSummary = await this.ItemWarehouseStock.findOne({
                where: { item_id, warehouse_id },
                transaction: t,
                lock: true,
            });
            const startTime = stockSummary
                ? stockSummary.last_updated_at ?? 0
                : 0;
            let runningQty = stockSummary
                ? stockSummary.last_on_hand_quantity ?? 0
                : 0;
            let runningAvgCost = stockSummary
                ? stockSummary.last_average_cost ?? 0
                : 0;

            const newLedgerEntries = await this.InventoryLedger.findAll({
                where: {
                    item_id,
                    warehouse_id,
                    created_at_timestamp: { [Op.gt]: startTime },
                },
                include: [
                    {
                        model: this.TransactionType,
                        attributes: ["io_multiplier"],
                    },
                ],
                order: [
                    ["created_at_timestamp", "ASC"],
                    ["id", "ASC"],
                ],
                transaction: t,
            });

            const last_updated_at = Date.now();

            if (newLedgerEntries.length === 0)
                return {
                    success: true,
                    message: "No new transactions. Stock is up-to-date.",
                };

            for (const entry of newLedgerEntries) {
                const quantityChange =
                    entry.quantity * entry.m_inventory_type.io_multiplier;
                if (entry.m_inventory_type.io_multiplier > 0) {
                    const newTotalQty = runningQty + entry.quantity;
                    if (newTotalQty > 0) {
                        runningAvgCost =
                            (runningQty * runningAvgCost +
                                entry.quantity * entry.cost) /
                            newTotalQty;
                    }
                }
                runningQty += quantityChange;
            }

            if (stockSummary) {
                await stockSummary.update(
                    {
                        on_hand_quantity: runningQty,
                        average_cost: runningAvgCost,
                        last_on_hand_quantity: runningQty,
                        last_average_cost: runningAvgCost,
                        last_updated_at,
                    },
                    { transaction: t }
                );
            } else {
                await this.ItemWarehouseStock.create(
                    {
                        item_id,
                        warehouse_id,
                        on_hand_quantity: runningQty,
                        average_cost: runningAvgCost,
                        last_on_hand_quantity: runningQty,
                        last_average_cost: runningAvgCost,
                        last_updated_at,
                    },
                    { transaction: t }
                );
            }
            return {
                success: true,
                message: `Recalibration for average cost item complete. ${newLedgerEntries.length} new transactions processed.`,
            };
        });
    }

    /**
     * @method _recalibrateBatchItem
     * @private
     * @description Internal method that recalculates stock levels for batch-tracked items.
     * This method processes all ledger transactions since the last recalibration timestamp,
     * grouping changes by batch and applying net quantity adjustments to each batch record.
     * It also maintains the total stock summary across all batches.
     *
     * **Batch Processing Logic:**
     * - Groups ledger entries by batch_id to calculate net changes
     * - Applies quantity changes to individual batch records
     * - Updates total stock summary by summing all batch changes
     * - Maintains both current and "last known good" quantities for incremental updates
     *
     * @param {Object} options - Recalibration parameters
     * @param {number} options.item_id - Item identifier
     * @param {number} options.warehouse_id - Warehouse identifier
     *
     * @returns {Promise<Object>} Operation result with success status and processing details
     */
    async _recalibrateBatchItem({ item_id, warehouse_id }) {
        return this.sequelize.transaction(async (t) => {
            const stockSummary = await this.ItemWarehouseStock.findOne({
                where: { item_id, warehouse_id },
                transaction: t,
                lock: true,
            });
            const startTime = stockSummary
                ? stockSummary.last_updated_at ?? 0
                : 0;

            const newLedgerEntries = await this.InventoryLedger.findAll({
                where: {
                    item_id,
                    warehouse_id,
                    batch_id: { [Op.ne]: null },
                    created_at_timestamp: { [Op.gt]: startTime },
                },
                include: [
                    {
                        model: this.TransactionType,
                        attributes: ["io_multiplier"],
                    },
                ],
                order: [
                    ["created_at_timestamp", "ASC"],
                    ["id", "ASC"],
                ],
                transaction: t,
            });

            const last_updated_at = Date.now();

            if (newLedgerEntries.length === 0)
                return {
                    success: true,
                    message: "No new transactions. Batch stock is up-to-date.",
                };

            const batchChanges = new Map();
            let totalQuantityChange = 0;

            for (const entry of newLedgerEntries) {
                const quantityChange =
                    entry.quantity * entry.m_inventory_type.io_multiplier;
                const currentBatchChange = batchChanges.get(entry.batchId) || 0;
                batchChanges.set(
                    entry.batchId,
                    currentBatchChange + quantityChange
                );
                totalQuantityChange += quantityChange;
            }

            for (const [batchId, netChange] of batchChanges.entries()) {
                await this.ItemBatch.update(
                    {
                        last_on_hand_quantity: literal(
                            `last_on_hand_quantity + (${netChange})`
                        ),
                        on_hand_quantity: literal(
                            `last_on_hand_quantity + (${netChange})`
                        ),
                        last_updated_at,
                    },
                    { where: { id: batchId }, transaction: t }
                );
            }

            if (stockSummary) {
                await stockSummary.update(
                    {
                        last_on_hand_quantity: literal(
                            `last_on_hand_quantity + (${totalQuantityChange})`
                        ),
                        on_hand_quantity: literal(
                            `last_on_hand_quantity + (${totalQuantityChange})`
                        ),
                        last_updated_at,
                    },
                    { transaction: t }
                );
            } else {
                await this.ItemWarehouseStock.create(
                    {
                        item_id,
                        warehouse_id,
                        on_hand_quantity: totalQuantityChange,
                        average_cost: 0,
                        last_updated_at,
                    },
                    { transaction: t }
                );
            }
            return {
                success: true,
                message: `Recalibration for batch item complete. ${newLedgerEntries.length} new transactions processed.`,
            };
        });
    }

    /**
     * @method _updateReservedQuantity
     * @private
     * @description Internal utility method that recalculates the total reserved quantity for an
     * item-warehouse combination by summing all active stock allocations. This ensures the
     * summary table always reflects the accurate reserved amount, which is critical for
     * available stock calculations.
     *
     * This method is called automatically by allocation and release operations to maintain
     * data consistency without requiring manual intervention.
     *
     * @param {number} item_id - Item identifier
     * @param {number} warehouse_id - Warehouse identifier
     * @param {Object} transaction - Active Sequelize transaction object
     *
     * @returns {Promise<void>} No return value, updates database directly
     */
    async _updateReservedQuantity(item_id, warehouse_id, transaction) {
        // 1. Calculate the new total by summing up all active allocations
        const totalReserved = await this.StockAllocation.sum("quantity", {
            where: { item_id, warehouse_id },
            transaction,
        });

        // 2. Update the summary table with the new, correct total
        await this.ItemWarehouseStock.update(
            { reserved_quantity: totalReserved || 0 },
            { where: { item_id, warehouse_id }, transaction }
        );
    }

    /**
     * @method allocateStock
     * @description Reserves stock for future use, typically for sales orders or production
     * requirements. This creates a formal allocation record and updates the reserved quantity
     * in the summary table. Allocated stock is considered unavailable for other orders until
     * the allocation is released or converted to an actual stock movement.
     *
     * **Allocation Logic:**
     * - Validates sufficient available stock (on_hand - currently_reserved)
     * - Creates detailed allocation record with reference to source document
     * - Automatically recalculates total reserved quantity
     * - Uses row locking to prevent race conditions in concurrent environments
     *
     * **Available Stock Calculation:**
     * Available = On Hand Quantity - Reserved Quantity
     *
     * @param {Object} options - Allocation parameters
     * @param {number} options.item_id - Item identifier to allocate
     * @param {number} options.warehouse_id - Warehouse identifier where stock is allocated
     * @param {number} options.quantity - Quantity to allocate (must be positive)
     * @param {number} options.reference_id - Source document ID (e.g., Sales Order ID)
     * @param {string} options.reference_source - Source table name (e.g., 't_sales_orders')
     *
     * @returns {Promise<Object>} Created allocation record with all details
     *
     * @throws {Error} When insufficient available stock for the requested allocation
     */
    async allocateStock({
        item_id,
        warehouse_id,
        quantity,
        reference_id,
        reference_source,
    }) {
        return this.sequelize.transaction(async (t) => {
            const stockSummary = await this.ItemWarehouseStock.findOne({
                where: { item_id, warehouse_id },
                transaction: t,
                lock: true, // Lock the row to prevent race conditions
            });

            const onHand = stockSummary ? stockSummary.on_hand_quantity : 0;
            const reserved = stockSummary ? stockSummary.reserved_quantity : 0;
            const available = onHand - reserved;

            if (available < quantity) {
                throw new Error(
                    `Insufficient available stock. Available: ${available}, Requested: ${quantity}.`
                );
            }

            // Create the detailed allocation record
            const allocation = await this.StockAllocation.create(
                {
                    item_id,
                    warehouse_id,
                    quantity,
                    reference_id,
                    reference_source,
                },
                { transaction: t }
            );

            // Recalculate and update the total reserved quantity
            await this._updateReservedQuantity(item_id, warehouse_id, t);

            return allocation;
        });
    }

    /**
     * @method releaseStock
     * @description Removes stock allocations associated with a specific reference document,
     * making the previously reserved stock available for other allocations. This is typically
     * used when orders are cancelled, modified, or when allocated stock is converted to
     * actual stock movements (issues). The method handles bulk releases efficiently by
     * grouping updates by item-warehouse combinations.
     *
     * **Release Process:**
     * - Finds all allocations matching the reference document
     * - Groups affected item-warehouse pairs for efficient processing
     * - Removes allocation records in a single operation
     * - Recalculates reserved quantities for all affected summaries
     * - Handles the case where no allocations exist gracefully
     *
     * **Use Cases:**
     * - Order cancellation: Release all allocated stock back to available pool
     * - Order modification: Release old allocations before creating new ones
     * - Stock issue: Release allocations when converting to actual stock movements
     * - System cleanup: Remove stale or orphaned allocations
     *
     * @param {Object} options - Release parameters
     * @param {number} options.reference_id - Source document ID whose allocations should be released
     * @param {string} options.reference_source - Source table name for the reference document
     *
     * @returns {Promise<boolean>} True when operation completes successfully
     */
    async releaseStock({ reference_id, reference_source }) {
        return this.sequelize.transaction(async (t) => {
            const allocations = await this.StockAllocation.findAll({
                where: { reference_id, reference_source },
                transaction: t,
            });

            if (allocations.length === 0) {
                return true; // Nothing to release
            }

            // Group allocations by item and warehouse to update summaries efficiently
            const affectedSummaries = new Map();
            for (const alloc of allocations) {
                const key = `${alloc.item_id}-${alloc.warehouse_id}`;
                if (!affectedSummaries.has(key)) {
                    affectedSummaries.set(key, {
                        item_id: alloc.item_id,
                        warehouse_id: alloc.warehouse_id,
                    });
                }
            }

            // Delete the allocation records
            await this.StockAllocation.destroy({
                where: { reference_id, reference_source },
                transaction: t,
            });

            // Recalculate the reserved quantity for each affected item-warehouse pair
            for (const summary of affectedSummaries.values()) {
                await this._updateReservedQuantity(
                    summary.item_id,
                    summary.warehouse_id,
                    t
                );
            }

            return true;
        });
    }

    /**
     * @method getActualStock
     * @description Retrieves the current physical on-hand stock quantity for an item in a specific
     * warehouse. This represents the total quantity physically present, regardless of any
     * reservations or allocations. It provides fast access to stock levels directly from the
     * summary table without querying the full transaction history.
     *
     * **Important:** This returns the total physical quantity, not the available quantity.
     * For available stock (considering reservations), use getCurrentStock() instead.
     *
     * @param {number} item_id - Item identifier
     * @param {number} warehouse_id - Warehouse identifier
     *
     * @returns {Promise<number>} Physical on-hand quantity, or 0 if no stock record exists
     */
    async getActualStock(item_id, warehouse_id) {
        const stockSummary = await this.ItemWarehouseStock.findOne({
            where: { item_id, warehouse_id },
        });
        return stockSummary ? stockSummary.on_hand_quantity : 0;
    }

    /**
     * @method getCurrentStock
     * @description Calculates the currently available stock for an item in a warehouse by
     * subtracting reserved quantities from on-hand quantities. This represents the actual
     * quantity available for new allocations or immediate use.
     *
     * **Available Stock Formula:**
     * Available = On Hand Quantity - Reserved Quantity
     *
     * This is the most important method for order processing and allocation decisions.
     *
     * @param {number} item_id - Item identifier (note: parameter name differs from other methods)
     * @param {number} warehouse_id - Warehouse identifier (note: parameter name differs from other methods)
     *
     * @returns {Promise<number>} Available stock quantity (can be negative if over-allocated)
     */
    async getCurrentStock(item_id, warehouse_id) {
        const stockSummary = await this.ItemWarehouseStock.findOne({
            where: { item_id, warehouse_id },
            attributes: ["on_hand_quantity", "reserved_quantity"],
            raw: true,
        });
        if (!stockSummary) return 0;
        return stockSummary.on_hand_quantity - stockSummary.reserved_quantity;
    }

    /**
     * @method getCurrentStockByCompany
     * @description Aggregates stock quantities for a single item across all warehouses within
     * a company/business unit. This provides a company-wide view of item availability, which
     * is useful for enterprise-level inventory management and inter-warehouse transfers.
     *
     * **Aggregation Logic:**
     * - Finds all warehouses belonging to the specified business unit
     * - Sums stock quantities across all warehouses
     * - Can return either total physical stock or available stock
     * - Returns 0 if no warehouses exist or no stock records found
     *
     * @param {number} item_id - Item identifier
     * @param {number} unit_bussiness_id - Business unit/company identifier
     * @param {boolean} [getOnHand=false] - If true, returns total physical stock; if false, returns available stock (physical - reserved)
     *
     * @returns {Promise<number>} Aggregated stock quantity across all company warehouses
     */
    async getCurrentStockByCompany(
        item_id,
        unit_bussiness_id,
        getOnHand = false
    ) {
        const warehouses = await this.Warehouse.findAll({
            where: { unit_bussiness_id },
            attributes: ["id"],
            raw: true,
        });
        if (warehouses.length === 0) return 0;

        const warehouse_ids = warehouses.map((w) => w.id);
        const quantityExpression = getOnHand
            ? this.sequelize.fn("SUM", this.sequelize.col("on_hand_quantity"))
            : this.sequelize.literal(
                "SUM(on_hand_quantity - reserved_quantity)"
            );

        const result = await this.ItemWarehouseStock.findOne({
            attributes: [[quantityExpression, "total_stock"]],
            where: {
                item_id,
                warehouse_id: { [Op.in]: warehouse_ids },
            },
            raw: true,
        });

        return parseFloat(result.total_stock) || 0;
    }

    /**
     * @method getCurrentStockForItemsInWarehouse
     * @description Efficiently retrieves stock quantities for multiple items within a single
     * warehouse. This batch operation is optimized for scenarios where you need stock levels
     * for many items at once, such as order processing, inventory reports, or availability checks.
     *
     * **Performance Benefits:**
     * - Single database query instead of multiple individual calls
     * - Reduced network round trips
     * - Optimized for bulk operations
     * - Returns structured data for easy processing
     *
     * @param {Array<number>} item_ids - Array of item identifiers to query
     * @param {number} warehouse_id - Warehouse identifier
     * @param {boolean} [getOnHand=false] - If true, returns physical stock; if false, returns available stock
     *
     * @returns {Promise<Object>} Object mapping item_id to its stock quantity {item_id: quantity, ...}
     */
    async getCurrentStockForItemsInWarehouse(
        item_ids,
        warehouse_id,
        getOnHand = false
    ) {
        const results = await this.ItemWarehouseStock.findAll({
            where: {
                item_id: { [Op.in]: item_ids },
                warehouse_id,
            },
            attributes: ["item_id", "on_hand_quantity", "reserved_quantity"],
            raw: true,
        });

        return results.reduce((acc, item) => {
            acc[item.item_id] = getOnHand
                ? item.on_hand_quantity
                : item.on_hand_quantity - item.reserved_quantity;
            return acc;
        }, {});
    }

    /**
     * @method getCurrentStockForItemsByCompany
     * @description Aggregates stock quantities for multiple items across all warehouses within
     * a company. This is the most comprehensive bulk stock query method, providing company-wide
     * inventory visibility for multiple items simultaneously. Essential for enterprise reporting,
     * multi-warehouse order processing, and inventory analytics.
     *
     * **Use Cases:**
     * - Company-wide inventory reports
     * - Multi-warehouse order fulfillment planning
     * - Inventory analytics and forecasting
     * - Purchase planning across business units
     * - Stock rebalancing between warehouses
     *
     * @param {Array<number>} item_ids - Array of item identifiers to aggregate
     * @param {number} unit_bussiness_id - Business unit/company identifier
     * @param {boolean} [getOnHand=false] - If true, returns total physical stock; if false, returns total available stock
     *
     * @returns {Promise<Object>} Object mapping item_id to its total company-wide quantity {item_id: total_quantity, ...}
     */
    async getCurrentStockForItemsByCompany(
        item_ids,
        unit_bussiness_id,
        getOnHand = false
    ) {
        const warehouses = await this.Warehouse.findAll({
            where: { unit_bussiness_id },
            attributes: ["id"],
            raw: true,
        });
        if (warehouses.length === 0) return {};

        const warehouse_ids = warehouses.map((w) => w.id);

        const quantityExpression = getOnHand
            ? this.sequelize.fn("SUM", this.sequelize.col("on_hand_quantity"))
            : this.sequelize.literal(
                "SUM(on_hand_quantity - reserved_quantity)"
            );

        const results = await this.ItemWarehouseStock.findAll({
            attributes: ["item_id", [quantityExpression, "total_quantity"]],
            where: {
                item_id: { [Op.in]: item_ids },
                warehouse_id: { [Op.in]: warehouse_ids },
            },
            group: ["item_id"],
            raw: true,
        });

        return results.reduce((acc, item) => {
            acc[item.item_id] = parseFloat(item.total_quantity);
            return acc;
        }, {});
    }

    /**
     * @method getCOGS
     * @description Calculates the Cost of Goods Sold (COGS) for the next unit(s) of an item
     * to be issued from a warehouse. The calculation method depends on the item's tracking type:
     *
     * **For Batch-Tracked Items:**
     * Returns the purchase cost of the next batch to be issued according to FEFO
     * (First-Expired, First-Out) logic. This ensures accurate cost accounting and proper
     * inventory rotation for perishable or time-sensitive items.
     *
     * **For Non-Batch Items:**
     * Returns the current moving average cost maintained in the summary table. This
     * provides a smoothed cost basis that reflects the weighted average of all purchases.
     *
     * **Cost Accuracy:** This method is essential for accurate financial reporting,
     * gross margin calculations, and inventory valuation.
     *
     * @param {number} item_id - Item identifier
     * @param {number} warehouse_id - Warehouse identifier
     *
     * @returns {Promise<number>} Cost per unit for the next issuance, or 0 if no stock available
     */
    async getCOGS(item_id, warehouse_id, transaction = null) {
        const item = await this.Item.findByPk(item_id, { transaction });
        if (!item) return 0;
        if (item.is_batch) {
            const nextBatch = await this.ItemBatch.findOne({
                where: {
                    item_id,
                    warehouse_id,
                    on_hand_quantity: { [Op.gt]: 0 },
                },
                order: [["expiration_date", "ASC"]],
                transaction
            });
            return nextBatch ? nextBatch.purchase_cost : 0;
        } else {
            const stockSummary = await this.ItemWarehouseStock.findOne({
                where: { item_id, warehouse_id },
                transaction
            });
            return stockSummary ? stockSummary.average_cost : 0;
        }
    }

    /**
     * @method getTransactionTypeIdByName
     * @description Internal utility method that resolves a human-readable transaction type name
     * to its corresponding database ID. This provides a user-friendly interface for stock
     * operations while maintaining referential integrity with the transaction types master table.
     *
     * **Common Transaction Types:**
     * - "Purchase Receipt" - Stock-in from purchases
     * - "Sales Issue" - Stock-out for sales
     * - "Adjustment In" - Positive inventory adjustments
     * - "Adjustment Out" - Negative inventory adjustments
     * - "Transfer In" - Stock received from another warehouse
     * - "Transfer Out" - Stock sent to another warehouse
     * - "Production Receipt" - Stock-in from manufacturing
     * - "Material Issue" - Stock-out for production
     *
     * @param {string} name - The transaction type name as defined in m_inventory_type
     *
     * @returns {Promise<number>} The transaction type's database ID
     *
     * @throws {Error} If no transaction type exists with the specified name
     */
    async getTransactionTypeIdByName(name) {
        const transactionType = await this.TransactionType.findOne({
            where: { name },
            attributes: ["id"],
        });
        if (!transactionType)
            throw new Error(`Transaction type with name "${name}" not found.`);
        return transactionType.id;
    }
}

const inventoryService = new InventoryService()

// Registered reference
const AccountingReference = [
    // ACCOUNTING
    "CASH_DISBURSEMENT",
    "CASH_RECEIPT",

    // PURCHASING
    "PURCHASE_INVOICE",
    "PURCHASE_RETURN",

    // MARKERING
    "SURAT_JALAN",
    "SURAT_JALAN_RETURN",
    "SALES_INVOICE",
    "SALES_RETURN",
];

const JournalTypeMapping = {
    // MAREKTING
    SURAT_JALAN: "MARKETING",
    SURAT_JALAN_RETURN: "MARKETING",
    SALES_INVOICE: "MARKETING",
    SALES_RETURN: "MARKETING",

    // PURCHASING
    PURCHASE_INVOICE: "PURCHASING",
    PURCHASE_RETURN: "PURCHASING",

    // ACCOUNTING
    CASH_RECEIPT: "ACCOUNTING",
    CASH_DISBURSEMENT: "ACCOUNTING",
};

class AccountingService {
  constructor() {
    this.sequelize = sequelize;
    this.AccoutingJournal = t_accounting_journal;
    this.JournalDetail = t_accounting_journal_d;
    this.Interface = m_interface;
    this.InterfaceDetail = m_interface_d;
  }

  /**
     * Membuat jurnal baru dari modul lain
     *
     * @param {Object} payload - Data jurnal
     * @param {string} payload.unit_bussiness_id - ID unit bisnis
     * @param {string} payload.reference_id - ID transaksi sumber
     * @param {string} payload.reference_type - Jenis sumber transaksi (lihat AccountingReference)
     * @param {string} payload.reference_no - Nomor/kode transaksi
     * @param {Date} payload.date - Tanggal transaksi
     * @param {string} payload.entity_id - ID entitas (mis. customer/supplier)
     * @param {string} payload.entity_type - Nama tabel entitas (mis. m_customer, m_supplier)
     * @param {string} payload.created_by - ID user yang membuat
     * @param {Array<Object>} payload.details - Detail jurnal
     * @param {string} payload.details[].variable - Nama variable sesuai m_interface
     * @param {number} payload.details[].debit - Nilai debit
     * @param {number} payload.details[].credit - Nilai kredit
     * @param {string} [payload.details[].notes] - Catatan tambahan (opsional)
     * @param {Object} options - Opsi tambahan
     * @param {Object} options.transaction - Transaction Sequelize (opsional)
     */
    async createJournal({
        unit_bussiness_id,
        reference_id,
        reference_type,
        reference_no,
        date,
        entity_id,
        entity_type,
        created_by,
        details
    }, { transaction }) {

        const menuId = "41e359fe-9aa7-4315-bb59-3317d8fcaea1";
        const code = await getCodeStructure(this.AccoutingJournal, menuId, unit_bussiness_id);

        // 1. Validasi parameter wajib
        if (!reference_id || !reference_type || !reference_no || !date) {
            throw new Error("data wajib harus diisi");
        }

        if (!AccountingReference.includes(reference_type)) {
            throw new Error(`Reference type ${reference_type} tidak dikenal`);
        }

        if (!Array.isArray(details) || details.length < 2) {
            throw new Error("Detail jurnal minimal 2 baris (debit & credit)");
        }

        // 2. Validasi balance & resolve coa_id
        let totalDebit = 0;
        let totalCredit = 0;

        for (const line of details) {
            if (!line.variable) {
                throw new Error("variable wajib di setiap detail");
            }

            // Cari interface berdasarkan variable string
            const iface = await this.Interface.findOne({
                where: { unit_bussiness_id, status: true },
                include: [
                    {
                        model: m_gen, // relasi langsung ke m_gen
                        as: "interfaceVariable", 
                        where: { value1: line.variable }, // cocokkan dengan parameter
                    },
                    {
                        model: this.InterfaceDetail,
                        as: "m_interface_ds", // detail mapping ke coa
                        required: true,
                    },
                ],
                transaction,
            });

            if (!iface || iface.m_interface_ds.length === 0) {
                throw new Error(`Variable ${line.variable} belum dimapping ke COA`);
            }

            const coa_id = iface.m_interface_ds[0].coa_id;
            line.coa_id = coa_id; // inject biar gampang insert ke detail

            // Normalisasi amount
            const normalize = (val) => Number.parseFloat(val ?? 0).toFixed(2);
            totalDebit += Number(normalize(line.debit));
            totalCredit += Number(normalize(line.credit));
        }

        if (totalDebit !== totalCredit) {
            throw new Error(`Jurnal tidak balance: debit=${totalDebit}, credit=${totalCredit}`);
        }

        // 3. Insert header
        const journalType = JournalTypeMapping[reference_type] || "GENERAL";
        const journal = await this.AccoutingJournal.create(
            {
            reference_id,
            reference_type,
            reference_no,
            date,
            code: code.data,
            entity_id,
            entity_type,
            journal_type: journalType,
            created_by,
            posted: false,
            },
            { transaction }
        );

        // 4. Insert detail
        for (const line of details) {
            await this.JournalDetail.create(
            {
                accounting_journal_id: journal.id,
                coa_id: line.coa_id,
                variable: line.variable,
                debit: line.debit ?? 0,
                credit: line.credit ?? 0,
                notes: line.notes,
            },
            { transaction }
            );
        }

        return journal;
    }
}

const accountingService = new AccountingService();

async function calculateDPP({
    total,
    isInclude,
    ppn = 12,
}) {
    let dpp = 0;

    if (isInclude) {
        dpp = total / (1 + (ppn / 100));
    } else {
        dpp = total;
    }

    return parseFloat(dpp.toFixed(2));
}

// Helper pembulatan
function round(value, digits = 0) {
    const factor = Math.pow(10, digits);
    return Math.round(value * factor) / factor;
}

async function getUserApprovalScopes({ userId, menuId, unitBussinessId }) {
    const result = {
        canSubmit: false,
        canApprove: false,
        submit: [],
        approve: []
    };

    const setApproval = await m_set_approval.findOne({
        where: { f_menu: menuId }
    });

    if (!setApproval) {
        // Tidak ada approval → tidak bisa ajukan atau setujui
        return result;
    }

    const approvalDetails = await m_set_approval_d.findAll({
        where: {
            f_set_approval: setApproval.id,
            f_unit_bussiness: unitBussinessId,
            f_user: userId
        },
        order: [['level', 'ASC']]
    });

    for (const item of approvalDetails) {
        const scope = {
            level: item.level,
            min: item.min_trx ?? 0,
            max: item.max_trx ?? null
        };

        if (item.type === 'mengajukan') {
            result.submit.push(scope);
            result.canSubmit = true;
        }

        if (item.type === 'menyetujui') {
            result.approve.push(scope);
            result.canApprove = true;
        }
    }

    return result;
}

function parseCondition(key, rawValue) {
    if (rawValue.includes(',')) {
        // Contoh: status=1,2 → status IN (1,2)
        return { [key]: { [Op.in]: rawValue.split(',') } };
    } else if (rawValue.startsWith('~')) {
        // Contoh: name=~john → name ILIKE %john%
        const value = rawValue.slice(1);
        return { [key]: { [Op.iLike]: `%${value}%` } };
    } else {
        // Default: EQ
        return { [key]: { [Op.eq]: rawValue } };
    }
}

// parse query param with key 'where'
// use separator | to operator And (&)
// use separator || to operaor Or (||)
function parseWhereQueryParam(whereStr) {
    if (!whereStr) return {};

    const orConditions = whereStr.split('||').map(orGroup => {
        const andConditions = orGroup.split('|').map(condition => {
            const [key, value] = condition.split('=');
            if (!key || value === undefined) return null;
            return parseCondition(key, value);
        }).filter(Boolean);

        return andConditions.length === 1
            ? andConditions[0]
            : { [Op.and]: andConditions };
    });

    return orConditions.length === 1
        ? orConditions[0]
        : { [Op.or]: orConditions };
}

// this function used for calculate detail sales order
function calculateSODetail(detail, qtyField = 'qty') {
    const qty = parseFloat(detail[qtyField]) || 0;
    const price = parseFloat(detail.price) || 0;
    const disc1_percent = parseFloat(detail.disc1_percent) || 0;
    const disc2_percent = parseFloat(detail.disc2_percent) || 0;
    const discAmt = parseFloat(detail.disc_amt) || 0;

    const subtotal = qty * price;
    const nilaiDisc1 = subtotal * disc1_percent / 100;
    const nilaiDisc2 = (subtotal - nilaiDisc1) * disc2_percent / 100;
    const totalDiscPerDetail = nilaiDisc1 + nilaiDisc2 + discAmt;
    const totalAmt = subtotal - totalDiscPerDetail;

    return {
        qty_snapshot: qty,
        amount: subtotal,
        subtotal: parseFloat(subtotal.toFixed(2)),
        disc1: parseFloat(nilaiDisc1.toFixed(2)),
        disc2: parseFloat(nilaiDisc2.toFixed(2)),
        total_disc: parseFloat(totalDiscPerDetail.toFixed(2)),
        total_amt: parseFloat(totalAmt.toFixed(2)),
    };
}

// function parseCondition(key, rawValue) {
//     if (rawValue.includes(',')) {
//         return { [key]: { [Op.in]: rawValue.split(',') } };
//     } else if (rawValue.startsWith('~')) {
//         const value = rawValue.slice(1);
//         return { [key]: { [Op.iLike]: `%${value}%` } };
//     } else {
//         return { [key]: { [Op.eq]: rawValue } };
//     }
// }

// function parseWhereQueryParam(whereStr) {
//     if (!whereStr) return { where: {}, includesWhere: {} };

//     const mainWhere = {};
//     const includesWhere = {}; // key: relation name, value: object where

//     const orGroups = whereStr.split('||');

//     for (const group of orGroups) {
//         const andConditions = group.split('|');

//         for (const cond of andConditions) {
//             const [rawKey, rawValue] = cond.split('=');
//             if (!rawKey || rawValue === undefined) continue;

//             const keyParts = rawKey.split('.');

//             // Nested key: e.g. m_customer.name
//             if (keyParts.length === 2) {
//                 const [relation, field] = keyParts;
//                 if (!includesWhere[relation]) includesWhere[relation] = {};
//                 Object.assign(
//                     includesWhere[relation],
//                     parseCondition(field, rawValue)
//                 );
//             } else {
//                 Object.assign(mainWhere, parseCondition(rawKey, rawValue));
//             }
//         }
//     }

//     return { where: mainWhere, includesWhere };
// }

async function getCodeSequence(model, tempCode) {
    const last = await model.findOne({
        where: {
            code: {
                [Op.like]: `${tempCode}%`
            }
        },
        order: [['code', 'DESC']]
    })

    let sequence = '0001';
    if (last) {
        const lastCode = last.code;
        const lastSeq = parseInt(lastCode.slice(-4));
        if (!isNaN(lastSeq)) {
            sequence = (lastSeq + 1).toString().padStart(4, '0');
        }
    }

    return `${tempCode}${sequence}`;
}

async function getCodeStructure(model, menuId, unitBussinessId = null, initialPrefix = null) {
    let format = false;

    // check if there is format per company
    if (unitBussinessId !== null) {
        format = await m_format_num.findOne({
            where: {
                f_menu: menuId,
                f_comp: unitBussinessId
            }
        })
    }

    // if not found, try to get format for all company
    if (!format) {
        format = await m_format_num.findOne({
            where: {
                f_menu: menuId,
                f_comp: {
                    [Op.is]: null
                }
            }
        });
    }

    // format not found
    if (!format) {
        return { status: "err", "error": "Format not found" };
    }


    const rawDetailedFormat = await m_format_num_d.findAll({
        where: {
            f_format_num: format.id
        },
        include: [
            {
                model: m_prefix_num,
                attributes: ['name', 'f_pref_type', 'value'],
                include: [
                    {
                        model: m_gen,
                        attributes: ['code']
                    }
                ]
            }
        ],
        order: [['order', 'ASC']]
    });

    const currentYear = moment().format('YY');
    const currentMonth = moment().format('MM');

    let codeParts = [];
    if (initialPrefix) {
        codeParts.push(initialPrefix);
    }

    for (const detail of rawDetailedFormat) {
        const prefixType = detail.m_prefix_num?.m_gen?.code;
        const prefixValue = detail.m_prefix_num?.value;
        let resultValue = '';

        switch (prefixType) {
            case 'text':
                resultValue = prefixValue ?? '';
                break;
            case 'pn':
                resultValue = prefixValue ?? '';
                break;
            case 'comp':
                const unitBussiness = await m_unit_bussiness.findOne({
                    attributes: ['code'],
                    where: {
                        id: unitBussinessId
                    }
                })
                resultValue = unitBussiness ? unitBussiness.code : ''
                break;
            case 'year':
                resultValue = currentYear;
                break;
            case 'month':
                resultValue = currentMonth;
                break;
            case 'seq':
                resultValue = "__SEQ__"
                break;
            default:
                resultValue = '';
        }

        codeParts.push(resultValue);
    }

    const tempCode = codeParts.join('').split('__SEQ__')[0]
    const finalCode = await getCodeSequence(model, tempCode)

    return { status: "ok", data: finalCode };
}

// Digunakan untuk melakukan update alamat default pelanggan
async function updateCustomerDefaultAddress(models, customerId, addressId, transaction) {
    if (!addressId) {
        throw new Error("Field 'address_id' wajib diisi jika change_default = true");
    }

    // Reset semua is_default ke false
    await models.m_customer_d_address.update(
        { is_default: false },
        {
            where: { customer_id: customerId },
            transaction,
        }
    );

    // Set address tertentu jadi default
    await models.m_customer_d_address.update(
        { is_default: true },
        {
            where: {
                id: addressId,
                customer_id: customerId,
            },
            transaction,
        }
    );
}

// helper parsing untuk konversi manual string menjadi array
function toArray(val) {
    if (!val) return undefined;
    if (Array.isArray(val)) return val;
    return typeof val === 'string' ? val.split(',') : [val];
}

/**
 * Global Helper Functions
 * File ini berisi helper functions yang bisa digunakan di seluruh aplikasi
 * tanpa perlu import, karena akan di-load secara global
 */

// =====================================
// STRING HELPERS
// =====================================

/**
 * Mengubah string menjadi slug (URL-friendly)
 * @param {string} text - Text yang akan diubah menjadi slug
 * @returns {string} - Slug yang sudah dibersihkan
 */
function toSlug(text) {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')           // Replace spaces with -
        .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
        .replace(/\-\-+/g, '-')         // Replace multiple - with single -
        .replace(/^-+/, '')             // Trim - from start of text
        .replace(/-+$/, '');            // Trim - from end of text
}

/**
 * Kapitalisasi huruf pertama
 * @param {string} str - String yang akan dikapitalisasi
 * @returns {string}
 */
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Generate random string
 * @param {number} length - Panjang string yang diinginkan
 * @returns {string}
 */
function randomString(length = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// =====================================
// DATE HELPERS
// =====================================

/**
 * Format tanggal ke format Indonesia
 * @param {Date|string} date - Tanggal yang akan diformat
 * @param {string} format - Format yang diinginkan ('short', 'long', 'datetime')
 * @returns {string}
 */
function formatDate(date, format = 'short') {
    const d = new Date(date);
    const options = {
        short: { day: '2-digit', month: '2-digit', year: 'numeric' },
        long: { day: 'numeric', month: 'long', year: 'numeric' },
        datetime: {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }
    };

    return d.toLocaleDateString('id-ID', options[format] || options.short);
}

/**
 * Mendapatkan tanggal hari ini dalam format YYYY-MM-DD
 * @returns {string}
 */
function todayDate() {
    return new Date().toISOString().split('T')[0];
}

/**
 * Menambah atau mengurangi hari dari tanggal
 * @param {Date|string} date - Tanggal awal
 * @param {number} days - Jumlah hari yang akan ditambah/dikurangi
 * @returns {Date}
 */
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

// =====================================
// NUMBER HELPERS
// =====================================

/**
 * Format angka ke format rupiah
 * @param {number} amount - Jumlah yang akan diformat
 * @returns {string}
 */
function formatRupiah(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
}

/**
 * Format angka dengan separator ribuan
 * @param {number} num - Angka yang akan diformat
 * @returns {string}
 */
function formatNumber(num) {
    return new Intl.NumberFormat('id-ID').format(num);
}

/**
 * Generate angka random dalam range tertentu
 * @param {number} min - Nilai minimum
 * @param {number} max - Nilai maximum
 * @returns {number}
 */
function randomNumber(min = 0, max = 100) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// =====================================
// ARRAY HELPERS
// =====================================

/**
 * Menghapus duplikat dari array
 * @param {Array} arr - Array yang akan dibersihkan
 * @returns {Array}
 */
function uniqueArray(arr) {
    return [...new Set(arr)];
}

/**
 * Mengacak urutan array
 * @param {Array} arr - Array yang akan diacak
 * @returns {Array}
 */
function shuffleArray(arr) {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Membagi array menjadi chunks
 * @param {Array} arr - Array yang akan dibagi
 * @param {number} size - Ukuran setiap chunk
 * @returns {Array}
 */
function chunkArray(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}

// =====================================
// OBJECT HELPERS
// =====================================

/**
 * Deep clone object
 * @param {Object} obj - Object yang akan di-clone
 * @returns {Object}
 */
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Merge objects secara deep
 * @param {Object} target - Object target
 * @param {Object} source - Object source
 * @returns {Object}
 */
function deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(target[key] || {}, source[key]);
        } else {
            result[key] = source[key];
        }
    }

    return result;
}

/**
 * Mengecek apakah object kosong
 * @param {Object} obj - Object yang akan dicek
 * @returns {boolean}
 */
function isEmpty(obj) {
    return Object.keys(obj).length === 0;
}

// =====================================
// VALIDATION HELPERS
// =====================================

/**
 * Validasi email
 * @param {string} email - Email yang akan divalidasi
 * @returns {boolean}
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validasi nomor telepon Indonesia
 * @param {string} phone - Nomor telepon yang akan divalidasi
 * @returns {boolean}
 */
function isValidPhone(phone) {
    const phoneRegex = /^(\+62|62|0)8[1-9][0-9]{6,9}$/;
    return phoneRegex.test(phone);
}

/**
 * Validasi NIK Indonesia (16 digit)
 * @param {string} nik - NIK yang akan divalidasi
 * @returns {boolean}
 */
function isValidNIK(nik) {
    const nikRegex = /^[0-9]{16}$/;
    return nikRegex.test(nik);
}

// =====================================
// FILE HELPERS
// =====================================

/**
 * Mendapatkan ekstensi file
 * @param {string} filename - Nama file
 * @returns {string}
 */
function getFileExtension(filename) {
    return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
}

/**
 * Generate nama file unik
 * @param {string} originalName - Nama file asli
 * @returns {string}
 */
function generateUniqueFilename(originalName) {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000000);
    const extension = getFileExtension(originalName);
    return `${timestamp}-${random}.${extension}`;
}

/**
 * Mengecek apakah file adalah gambar
 * @param {string} filename - Nama file
 * @returns {boolean}
 */
function isImageFile(filename) {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
    const extension = getFileExtension(filename).toLowerCase();
    return imageExtensions.includes(extension);
}

// =====================================
// RESPONSE HELPERS
// =====================================

/**
 * Format response sukses
 * @param {*} data - Data yang akan dikembalikan
 * @param {string} message - Pesan sukses
 * @param {number} code - HTTP status code
 * @returns {Object}
 */
function successResponse(data = null, message = 'Success', code = 200) {
    return {
        success: true,
        code,
        message,
        data
    };
}

/**
 * Format response error
 * @param {string} message - Pesan error
 * @param {number} code - HTTP status code
 * @param {*} errors - Detail error
 * @returns {Object}
 */
function errorResponse(message = 'Error', code = 500, errors = null) {
    return {
        success: false,
        code,
        message,
        errors
    };
}

// =====================================
// ENCRYPTION HELPERS
// =====================================

/**
 * Hash password menggunakan bcrypt
 * @param {string} password - Password yang akan di-hash
 * @returns {Promise<string>}
 */
async function hashPassword(password) {
    const bcrypt = await import('bcryptjs');
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
}

/**
 * Verifikasi password dengan hash
 * @param {string} password - Password plaintext
 * @param {string} hash - Hash password
 * @returns {Promise<boolean>}
 */
async function verifyPassword(password, hash) {
    const bcrypt = await import('bcryptjs');
    return await bcrypt.compare(password, hash);
}

// =====================================
// DATABASE HELPERS
// =====================================

/**
 * Build search query
 * @param {string} searchkey - search key
 * @param {string} searchfield - search field
 * @returns {Array}
 */
function buildSearchQuery(searchkey, searchfield) {
    const search = searchkey || null;
    const searchFields = searchfield ? searchfield.split(',') : null;

    let searchConditions = [];

    if (search && searchFields.length > 0) {
        searchFields.forEach(field => {
            if (field.includes('.')) {
                const [modelAlias, attr] = field.split('.');
                searchConditions.push({
                    [`$${modelAlias}.${attr}$`]: { [Op.iLike]: `%${search}%` }
                });
            } else {
                searchConditions.push({
                    [field]: { [Op.iLike]: `%${search}%` }
                });
            }
        });
    }

    return searchConditions;
}

/**
 * Build query pagination
 * @param {number} page - Halaman
 * @param {number} limit - Limit per halaman
 * @returns {Object}
 */
function buildPagination(page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    return {
        limit: parseInt(limit),
        offset: parseInt(offset)
    };
}

/**
 * Build response pagination
 * @param {Array} data - Data hasil query
 * @param {number} total - Total data
 * @param {number} page - Halaman saat ini
 * @param {number} limit - Limit per halaman
 * @returns {Object}
 */
function buildPaginationResponse(data, total, page, limit) {
    const totalPages = Math.ceil(total / limit);
    return {
        data,
        pagination: {
            current_page: parseInt(page),
            per_page: parseInt(limit),
            total: parseInt(total),
            total_pages: totalPages,
            has_next: page < totalPages,
            has_prev: page > 1
        }
    };
}

// =====================================
// LOGGING HELPERS
// =====================================

/**
 * Log dengan format yang rapi
 * @param {string} level - Level log (info, warn, error)
 * @param {string} message - Pesan log
 * @param {*} data - Data tambahan
 */
function log(level = 'info', message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    if (data) {
        console[level](logMessage, data);
    } else {
        console[level](logMessage);
    }
}
function logInfo(message, data = null) {
    log('info', message, data);
}
function getAllRelatedModels(sequelize, targetModelName) {
    const relationships = [];
    const models = sequelize.models;
    const targetModel = models[targetModelName];

    if (!targetModel) {
        throw new Error(`Model ${targetModelName} not found`);
    }

    // Get outgoing associations (from target model to others)
    Object.keys(targetModel.associations).forEach(assocName => {
        const association = targetModel.associations[assocName];
        relationships.push({
            direction: 'outgoing',
            fromModel: targetModelName,
            toModel: association.target.name,
            associationType: association.associationType,
            associationName: assocName
        });
    });

    // Get incoming associations (from other models to target model)
    Object.keys(models).forEach(modelName => {
        if (modelName === targetModelName) return;

        const model = models[modelName];
        Object.keys(model.associations).forEach(assocName => {
            const association = model.associations[assocName];
            if (association.target.name === targetModelName) {
                relationships.push({
                    direction: 'incoming',
                    fromModel: modelName,
                    toModel: targetModelName,
                    associationType: association.associationType,
                    associationName: assocName
                });
            }
        });
    });

    return relationships;
}

// Helper function to check if related records exist
async function checkRelatedRecordsExist(sequelize, targetModelName, instance) {
    const relationships = getAllRelatedModels(sequelize, targetModelName);
    const existingRelations = [];

    for (const relation of relationships) {
        const relatedModel = sequelize.models[relation.fromModel === targetModelName ? relation.toModel : relation.fromModel];

        let whereCondition = {};
        let count = 0;

        switch (relation.associationType) {
            case 'HasMany':
                if (relation.direction === 'outgoing') {
                    // Item hasMany Orders - check if any orders exist
                    const association = instance.constructor.associations[relation.associationName];
                    whereCondition[association.foreignKey] = instance.id;
                    count = await relatedModel.count({ where: whereCondition });
                }
                break;

            case 'HasOne':
                if (relation.direction === 'outgoing') {
                    // Item hasOne Profile - check if profile exists
                    const association = instance.constructor.associations[relation.associationName];
                    whereCondition[association.foreignKey] = instance.id;
                    count = await relatedModel.count({ where: whereCondition });
                }
                break;

            case 'BelongsToMany':
                if (relation.direction === 'outgoing') {
                    // Item belongsToMany Categories - check junction table
                    const association = instance.constructor.associations[relation.associationName];
                    if (association?.through?.model) {
                        whereCondition[association.foreignKey] = instance.id;
                        count = await association.through.model.count({ where: whereCondition });
                    }
                }
                break;

            case 'BelongsTo':
                if (relation.direction === 'incoming') {
                    // Orders belongsTo Item - check if any orders reference this item
                    const association = relatedModel.associations[relation.associationName];
                    whereCondition[association.foreignKey] = instance.id;
                    count = await relatedModel.count({ where: whereCondition });
                }
                break;
        }

        if (count > 0) {
            existingRelations.push({
                model: relation.direction === 'outgoing' ? relation.toModel : relation.fromModel,
                associationType: relation.associationType,
                associationName: relation.associationName,
                count: count
            });
        }
    }

    return existingRelations;
}

// Accouting Receivable & Payable Helper
async function accoutingCreditAndDebitTypeAction(sequelize, type, source, targetId, amount, transaction) {
    if (!transaction) {
        throw new Error("Transaction is required for accoutingCreditAndDebitTypeAction");
    }

    console.log("New Credit Note Log:", type, "|", source, "|", targetId, "|", amount, "|")

    const { t_sales_invoice, t_purchase_invoice } = sequelize.models;

    let invoice;

    if (type === 'Account Receivable') {
        invoice = await t_sales_invoice.findByPk(targetId, { transaction });
        if (!invoice) throw new Error('Sales Invoice not found');

        if (source === 'debit') {
            invoice.grand_total += amount;
        } else if (source === 'credit') {
            invoice.grand_total -= amount;
            if (invoice.grand_total < 0) {
                throw new Error(`Grand total cannot be negative`);
            }
        } else {
            throw new Error('Invalid source type for AR');
        }

    } else if (type === 'Account Payable') {
        invoice = await t_purchase_invoice.findByPk(targetId, { transaction });
        if (!invoice) throw new Error('Purchase Invoice not found');

        if (source === 'debit') {
            invoice.grand_total += amount;
        } else if (source === 'credit') {
            invoice.grand_total -= amount;
            if (invoice.grand_total < 0) {
                throw new Error(`Grand total cannot be negative`);
            }
        } else {
            throw new Error('Invalid source type for AP');
        }

    } else {
        throw new Error('Invalid action type');
    }

    await invoice.save({ transaction });
    return invoice;
}


// =====================================
// EXPORT FUNCTIONS TO GLOBAL
// =====================================

// Export semua function ke global scope agar bisa diakses tanpa import
const globalHelpers = {
    // String helpers
    toSlug,
    capitalize,
    randomString,
    toArray,

    // Date helpers
    formatDate,
    todayDate,
    addDays,

    // Number helpers
    formatRupiah,
    formatNumber,
    randomNumber,

    // Array helpers
    uniqueArray,
    shuffleArray,
    chunkArray,

    // Object helpers
    deepClone,
    deepMerge,
    isEmpty,

    // Validation helpers
    isValidEmail,
    isValidPhone,
    isValidNIK,

    // File helpers
    getFileExtension,
    generateUniqueFilename,
    isImageFile,

    // Response helpers
    successResponse,
    errorResponse,

    // Encryption helpers
    hashPassword,
    verifyPassword,

    // Database helpers
    buildPagination,
    buildPaginationResponse,
    buildSearchQuery,

    // Logging helpers
    log,
    logInfo,

    // generate code helpers
    getCodeStructure,

    // user approval scopes
    getUserApprovalScopes,

    // sales marketing
    updateCustomerDefaultAddress,

    // tax helper
    calculateDPP,

    // Inventory Service
    inventoryService,

    // Accounting Service
    accountingService,

    // parse custom query param
    parseWhereQueryParam,

    calculateSODetail,
    uri,
    localPath,
    removeLocalPath,

    // models helper
    checkRelatedRecordsExist,
    getAllRelatedModels,

    // accounting
    accoutingCreditAndDebitTypeAction,
};

// Attach to global object
Object.assign(global, globalHelpers);

export default globalHelpers;