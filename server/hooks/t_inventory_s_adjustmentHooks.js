// Hooks for t_inventory_s_adjustment model
import t_inventory_s_adjustment from '../models/t_inventory_s_adjustment.js';
import t_inventory_s_adjustment_d from '../models/t_inventory_s_adjustment_d.js';

const TRX_APPROVAL_STATUS = {
    DRAFT: 'DRAFT',
    REVISED: 'REVISED',
    IN_APPROVAL: 'IN_APPROVAL',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED'
};

/**
 * Processes a stock adjustment, creating the necessary inventory ledger entries.
 * Designed to be called from a hook where details are not pre-loaded.
 *
 * @param {object} stockAdjustment - The main adjustment instance from the hook.
 * @param {object} StockAdjustmentDetailModel - The Sequelize model for details.
 * @param {object} inventoryService - An instance of your InventoryService class.
 */
async function postStockAdjustment(stockAdjustment, StockAdjustmentDetailModel, service, transaction) {
    const { id, warehouse_id, code } = stockAdjustment;

    // 1. Manually fetch the details associated with the parent
    const details = await StockAdjustmentDetailModel.findAll({
        where: { t_inventory_s_adjustment_id: id },
        transaction // Or whatever your foreign key is named
    });

    if (!details || details.length === 0) {
        console.log("No details to process for this adjustment.");
        return;
    }

    if (!transaction || transaction.finished) {
        transaction == null;
    }

    for (const detail of details) {
        const { item_id, qty_after, qty_before } = detail;
        const adjustmentQuantity = qty_after - qty_before;

        if (adjustmentQuantity === 0) {
            continue; // Skip if there's no change
        }

        const isPositive = adjustmentQuantity > 0;
        const transactionTypeName = isPositive ? "ADJUSTMENT_POSITIVE" : "ADJUSTMENT_NEGATIVE";
        const quantity = Math.abs(adjustmentQuantity);
        let unitCost = 0;

        try {
            if (!!detail.cost && detail.cost != null) {
                unitCost = detail.cost
            } else {
                // For both positive and negative adjustments, using the current COGS is a safe default.
                unitCost = await service.getCOGS(item_id, warehouse_id);
            }

            // Call the main inventory service function to record the transaction
            await service.insertStock({
                item_id,
                warehouse_id,
                quantity: quantity,
                transactionTypeName,
                batchNumber: code,
                unitCost,
                reference_id: id,
                reference_source: 'stock_adjustments',
                transaction
            });

            console.log(`Successfully processed adjustment for item ${item_id}.`);

        } catch (error) {
            console.error(`Failed to process adjustment for item ${item_id}:`, (!transaction || transaction.finished ? "halo" : "heh"));
            console.error(error.stack);
            console.error(error.message);
            //   throw new Error(`Failed on item ${item_id}. Halting adjustment process.`);
        }
    }

    console.log(`Stock adjustment ${id} processed successfully.`);
}

export function registert_inventory_s_adjustmentHooks() {
    // beforeValidate
    t_inventory_s_adjustment.addHook('beforeValidate', async (instance, options) => {
        // Custom logic sebelum validasi
    });

    // afterValidate
    t_inventory_s_adjustment.addHook('afterValidate', async (instance, options) => {
        // Custom logic setelah validasi
    });

    // beforeCreate
    t_inventory_s_adjustment.addHook('beforeCreate', async (instance, options) => {
        // Custom logic sebelum create
        instance.submitted_by = options.user.id
    });

    // afterCreate
    t_inventory_s_adjustment.addHook('afterCreate', async (instance, options) => {
        // Custom logic setelah create
    });

    // beforeDestroy
    t_inventory_s_adjustment.addHook('beforeDestroy', async (instance, options) => {
        // Custom logic sebelum destroy
    });

    // afterDestroy
    t_inventory_s_adjustment.addHook('afterDestroy', async (instance, options) => {
        // Custom logic setelah destroy
    });

    // beforeUpdate
    t_inventory_s_adjustment.addHook('beforeUpdate', async (instance, options) => {
        // Custom logic sebelum update
    });

    // afterUpdate
    t_inventory_s_adjustment.addHook('afterUpdate', async (instance, options) => {
        const { transaction, user } = options;
        if (instance.status == TRX_APPROVAL_STATUS.APPROVED) postStockAdjustment(instance, t_inventory_s_adjustment_d, inventoryService, transaction)
    });

    // beforeSave
    t_inventory_s_adjustment.addHook('beforeSave', async (instance, options) => {
        // Custom logic sebelum save
    });

    // afterSave
    t_inventory_s_adjustment.addHook('afterSave', async (instance, options) => {
        // Custom logic setelah save
    });

    // beforeBulkCreate
    t_inventory_s_adjustment.addHook('beforeBulkCreate', async (instances, options) => {
        // Custom logic sebelum bulk create
    });

    // afterBulkCreate
    t_inventory_s_adjustment.addHook('afterBulkCreate', async (instances, options) => {
        // Custom logic setelah bulk create
    });

    // beforeBulkDestroy
    t_inventory_s_adjustment.addHook('beforeBulkDestroy', async (options) => {
        // Custom logic sebelum bulk destroy
    });

    // afterBulkDestroy
    t_inventory_s_adjustment.addHook('afterBulkDestroy', async (options) => {
        // Custom logic setelah bulk destroy
    });

    // beforeBulkUpdate
    t_inventory_s_adjustment.addHook('beforeBulkUpdate', async (options) => {
        // Custom logic sebelum bulk update
    });

    // afterBulkUpdate
    t_inventory_s_adjustment.addHook('afterBulkUpdate', async (options) => {
        // Custom logic setelah bulk update
    });
}
