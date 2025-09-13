// Hooks for t_inventory_transform_item model
import t_inventory_transform_item from '../models/t_inventory_transform_item.js';
import t_inventory_ledger from '../models/t_inventory_ledger.js';
import m_item from '../models/m_item.js';
import m_gen from '../models/m_gen.js';

// Hardcoded generateItemCode function
export async function generateItemCode(item_division_id = '4adf8e11-deae-429e-ac8b-284872ddf9ae', item_kind_id = 'dddde2b7-cb42-4433-b07b-5e71515500f7', item_group_id = '02fae1a6-2faa-4019-b5e3-0b343b29cd83') {
    const params = {
        menu_id: 'e89672f3-82ea-4a9e-b8dd-50bd2a9b6b7d',
        item_division_id,
        item_kind_id,
        item_group_id
    };

    let prefix = '';

    if (params.item_division_id) {
        const itemDivision = await m_gen.findOne({
            attributes: ['code'],
            where: {
                id: params.item_division_id,
                group: 'm_item_division'
            }
        });
        prefix += itemDivision.code ? itemDivision.code.substring(0, 2) : '00';
    }

    if (params.item_kind_id) {
        const itemKind = await m_gen.findOne({
            attributes: ['code'],
            where: {
                id: params.item_kind_id,
                group: 'm_item_kind'
            }
        });
        prefix += itemKind.code ? itemKind.code.substring(0, 2) : '00';
    }

    if (params.item_group_id) {
        const itemGroup = await m_gen.findOne({
            attributes: ['code'],
            where: {
                id: params.item_group_id,
                group: 'm_item_group'
            }
        });
        prefix += itemGroup.code ? itemGroup.code.substring(0, 2) : '00';
    }

    const code = await getCodeStructure(m_item, params.menu_id, params.unit_bussiness_id, prefix);

    if (code.status === 'err') {
        throw new Error(code.error);
    }

    return code.data;
}

export function registert_inventory_transform_itemHooks() {
    // beforeValidate
    t_inventory_transform_item.addHook('beforeValidate', async (instance, options) => {
        // Custom logic sebelum validasi
    });

    // afterValidate
    t_inventory_transform_item.addHook('afterValidate', async (instance, options) => {
        // Custom logic setelah validasi
    });

    // beforeCreate
    t_inventory_transform_item.addHook('beforeCreate', async (instance, options) => {
        // Custom logic sebelum create
        instance.submitted_by = options.user.id
    });

    // afterCreate
    t_inventory_transform_item.addHook('afterCreate', async (instance, options) => {
        // Custom logic setelah create
    });

    // beforeDestroy
    t_inventory_transform_item.addHook('beforeDestroy', async (instance, options) => {
        // Custom logic sebelum destroy
    });

    // afterDestroy
    t_inventory_transform_item.addHook('afterDestroy', async (instance, options) => {
        // Custom logic setelah destroy
    });

    // beforeUpdate
    t_inventory_transform_item.addHook('beforeUpdate', async (instance, options) => {
        // Custom logic sebelum update
    });

    // afterUpdate
    t_inventory_transform_item.addHook('afterUpdate', async (instance, options) => {
    });

    // beforeSave
    t_inventory_transform_item.addHook('beforeSave', async (instance, options) => {
        // Custom logic sebelum save
    });

    // afterSave
    t_inventory_transform_item.addHook('afterSave', async (instance, options) => {
        const { transaction, user } = options;
        if (instance.status == "POSTED" && instance.tipe == "REPACK") {
            try {
                let details = [];
                if (!!instance.t_inventory_transform_item_ds) {
                    details = instance.t_inventory_transform_item_ds
                } else {
                    details = instance.t_inventory_transform_item_d
                }
                // Find the transform_item_skeleton to get the item code
                const skeleton = await m_gen.findOne({
                    attributes: ['code'],
                    where: {
                        group: 'transform_item_skeleton'
                    }
                });
                
                if (!skeleton) {
                    throw new Error('Transform item skeleton not found');
                }
                
                // Find the original record based on the skeleton item code
                const original = await m_item.findOne({
                    where: {
                        code: skeleton.code
                    }
                });
                
                if (!original) {
                    throw new Error(`Original item not found with code: ${skeleton.code}`);
                }

                // Remove id and timestamps, keep other data
                const { id: originalId, createdAt, updatedAt, actual_weight, ...dataToClone } = original.dataValues;

                // Generate new item code using generateItemCode function with original item params
                const newItemCode = await generateItemCode(original.item_division_id, original.item_kind_id, original.item_group_id);

                const duplicate = await m_item.create({ ...dataToClone, code: newItemCode, name: instance.item_name, actual_weight: parseFloat(instance.actual_weight) * instance.qty, is_bundle: true, status: true }, {
                    transaction,
                    user
                });

                console.log("created bundle item", duplicate);
                const warehouse_id = instance.warehouse_id;

                let totalUnitCost = 0;
                for (const detail of details) {
                    const item_id = detail.item_id;
                    const transactionTypeName = "ASSEMBLY_INPUT";
                    const quantity = detail.qty * instance.qty;
                    let unitCost = 0;

                    try {
                        // For both positive and negative adjustments, using the current COGS is a safe default.
                        unitCost = await inventoryService.getCOGS(item_id, warehouse_id);

                        // Call the main inventory inventoryService function to record the transaction
                        await inventoryService.insertStock({
                            item_id,
                            warehouse_id,
                            quantity: quantity,
                            transactionTypeName,
                            unitCost,
                            batchNumber: instance.code,
                            reference_id: instance.id,
                            reference_source: 'transform_item_detail',
                            transaction
                        });

                        totalUnitCost = totalUnitCost + (unitCost * detail.qty)
                        console.log(`Successfully processed bundling for item ${item_id}.`);

                    } catch (error) {
                        console.error(`Failed to process bundling for item ${item_id}:`, error.message);
                        console.error(`Error Stack:`, error.stack);
                        throw new Error(`Failed on item ${item_id}. Halting bundling process.`);
                    }
                }

                const item_id = duplicate.id;
                console.log("item", await m_item.findByPk(item_id, { transaction }))
                const transactionTypeName = "ASSEMBLY_OUTPUT";
                const quantity = instance.qty;

                try {
                    // Call the main inventory inventoryService function to record the transaction
                    await inventoryService.insertStock({
                        item_id,
                        warehouse_id,
                        quantity,
                        transactionTypeName,
                        unitCost: totalUnitCost,
                        batchNumber: instance.code,
                        reference_id: instance.id,
                        reference_source: 'transform_item',
                        transaction
                    });

                    console.log(`Successfully processed bundling for item ${item_id}.`);

                } catch (error) {
                    console.error(`Failed to process bundling for item ${item_id}:`, error.message);
                    throw new Error(`Failed on item ${item_id}. Halting bundling process.`);
                }


            } catch (error) {
                throw error
            }
        } else if (instance.status == "POSTED" && instance.tipe == "UNPACK") {
            try {
                let details = [];
                if (!!instance.t_inventory_transform_item_ds) {
                    details = instance.t_inventory_transform_item_ds
                } else {
                    details = instance.t_inventory_transform_item_d
                }

                const warehouse_id = instance.warehouse_id;

                // First, get the bundled item ID from the original REPACK transaction
                // Find the inventory ledger entry for the original bundle creation
                const bundleTransaction = await t_inventory_ledger.findOne({
                    where: {
                        reference_id: instance.item_id,
                        reference_source: 'transform_item',
                    },
                    transaction
                });

                if (!bundleTransaction) {
                    throw new Error(`Bundle transaction not found for item ${instance.item_id}`);
                }

                const bundledItemId = bundleTransaction.item_id;
                const bundledQuantity = instance.qty;

                let bundledUnitCost = 0;
                try {
                    bundledUnitCost = await inventoryService.getCOGS(bundledItemId, warehouse_id);

                    // Remove bundled item from inventory
                    await inventoryService.insertStock({
                        item_id: bundledItemId,
                        warehouse_id,
                        quantity: bundledQuantity,
                        transactionTypeName: "ASSEMBLY_INPUT",
                        unitCost: bundledUnitCost,
                        batchNumber: instance.code,
                        reference_id: instance.id,
                        reference_source: 'transform_item_unpack',
                        transaction
                    });

                    console.log(`Successfully removed bundled item ${bundledItemId} from inventory.`);
                } catch (error) {
                    console.error(`Failed to remove bundled item ${bundledItemId}:`, error.message);
                    throw new Error(`Failed to remove bundled item ${bundledItemId}. Halting unpacking process.`);
                }

                // Then, add individual component items back to inventory (ASSEMBLY_OUTPUT)
                for (const detail of details) {
                    const item_id = detail.item_id;
                    const transactionTypeName = "ASSEMBLY_OUTPUT";
                    const quantity = detail.qty * bundledQuantity; // Multiply by the bundle quantity being unpacked
                    let unitCost = 0;

                    try {
                        // Get the original unit cost from the inventory ledger when this item was used in the REPACK
                        const originalTransaction = await t_inventory_ledger.findOne({
                            where: {
                                reference_id: instance.item_id,
                                reference_source: 'transform_item_detail',
                                item_id: item_id
                            },
                            transaction
                        });

                        if (originalTransaction) {
                            unitCost = originalTransaction.cost;
                        } else {
                            // Fallback to proportional cost from the bundle if original transaction not found
                            unitCost = (bundledUnitCost * detail.qty) / details.reduce((sum, d) => sum + d.qty, 0);
                        }

                        // Call the main inventory service function to record the transaction
                        await inventoryService.insertStock({
                            item_id,
                            warehouse_id,
                            quantity,
                            transactionTypeName,
                            unitCost,
                            batchNumber: instance.code,
                            reference_id: instance.id,
                            reference_source: 'transform_item_detail_unpack',
                            transaction
                        });

                        console.log(`Successfully processed unpacking for item ${item_id}.`);

                    } catch (error) {
                        console.error(`Failed to process unpacking for item ${item_id}:`, error.message);
                        throw new Error(`Failed on item ${item_id}. Halting unpacking process.`);
                    }
                }

            } catch (error) {
                throw error
            }
        }
    });

    // beforeBulkCreate
    t_inventory_transform_item.addHook('beforeBulkCreate', async (instances, options) => {
        // Custom logic sebelum bulk create
    });

    // afterBulkCreate
    t_inventory_transform_item.addHook('afterBulkCreate', async (instances, options) => {
        // Custom logic setelah bulk create
    });

    // beforeBulkDestroy
    t_inventory_transform_item.addHook('beforeBulkDestroy', async (options) => {
        // Custom logic sebelum bulk destroy
    });

    // afterBulkDestroy
    t_inventory_transform_item.addHook('afterBulkDestroy', async (options) => {
        // Custom logic setelah bulk destroy
    });

    // beforeBulkUpdate
    t_inventory_transform_item.addHook('beforeBulkUpdate', async (options) => {
        // Custom logic sebelum bulk update
    });

    // afterBulkUpdate
    t_inventory_transform_item.addHook('afterBulkUpdate', async (options) => {
        // Custom logic setelah bulk update
    });
}
