// Hooks for t_surat_jalan_return model
import t_surat_jalan_return from '../models/t_surat_jalan_return.js';
// import t_surat_jalan_return_d from '../models/t_surat_jalan_return_d.js';

const menuId = '6c41d4bf-a27a-4d31-95e2-d13e87598301';

// const TRX_STATUS = {
//     DRAFT: 1,
//     POSTED: 2,
// };

/**
 * Processes a stock adjustment, creating the necessary inventory ledger entries.
 * Designed to be called from a hook where details are not pre-loaded.
 *
 * @param {object} stockAdjustment - The main adjustment instance from the hook.
 * @param {object} StockAdjustmentDetailModel - The Sequelize model for details.
 * @param {object} inventoryService - An instance of your InventoryService class.
 */
// async function postStockAdjustment(instance, StockAdjustmentDetailModel, service) {
//     const { id, unit_bussiness_id } = instance;

//     console.log("id:", id);
//     console.log("unit_bussiness_id:", unit_bussiness_id);
//     const details = await StockAdjustmentDetailModel.findAll({
//         where: { surat_jalan_return_id: id } // Or whatever your foreign key is named
//     });

//     if (!details || details.length === 0) {
//         console.log("No details to process for this adjustment.");
//         return;
//     }

//         warehouse = await m_warehouse.findOne({
//             where: { unit_bussiness_id: unit_bussiness_id }
//         });
//         if (!warehouse) {
//             throw new Error('Gudang tidak ditemukan');
//         }

//     for (const detail of details) {
//         const { item_id, qty_return } = detail;

//         try {
//             const resultCOGS = await inventoryService.getCOGS(item.item_id, warehouse.id);

//             if (resultCOGS.status === 'err') {
//                 throw new Error(`COGS error: ${resultCOGS.error}`);
//             }

//             const resultInsert = await inventoryService.insertStock({
//                 item_id: item_id,
//                 warehouse_id: warehouse.id,
//                 quantity: qty_return,
//                 transactionTypeName: "SALES_RETURN",
//                 unitCost: resultCOGS.data || null,
//                 reference_id: id,
//                 reference_source: 't_surat_jalan_return'
//             });

//             if (resultInsert.status === 'err') {
//                 throw new Error(`Insert stock error: ${resultInsert.error}`);
//             }
//         } catch (error) {
//         console.error(`Failed to process adjustment for item ${item_id}:`, error.message);
//         //   throw new Error(`Failed on item ${item_id}. Halting adjustment process.`);
//         }
//     }

//     console.log(`Stock adjustment ${id} processed successfully.`);
// }

export function registert_surat_jalan_returnHooks() {
  // beforeValidate
  t_surat_jalan_return.addHook('beforeValidate', async (instance, options) => {
    // Custom logic sebelum validasi
    if (instance.isNewRecord) {
        const code = await getCodeStructure(t_surat_jalan_return, menuId, instance.unit_bussiness_id);
        instance.code = code.data;
    }
  });

  // afterValidate
  t_surat_jalan_return.addHook('afterValidate', async (instance, options) => {
    // Custom logic setelah validasi
  });

  // beforeCreate
  t_surat_jalan_return.addHook('beforeCreate', async (instance, options) => {
    // Custom logic sebelum create
  });

  // afterCreate
  t_surat_jalan_return.addHook('afterCreate', async (instance, options) => {
    // Custom logic setelah create
    // if (instance.status == TRX_STATUS.POSTED) postStockAdjustment(instance, t_surat_jalan_return_d, inventoryService)
  });

  // beforeDestroy
  t_surat_jalan_return.addHook('beforeDestroy', async (instance, options) => {
    // Custom logic sebelum destroy
  });

  // afterDestroy
  t_surat_jalan_return.addHook('afterDestroy', async (instance, options) => {
    // Custom logic setelah destroy
  });

  // beforeUpdate
  t_surat_jalan_return.addHook('beforeUpdate', async (instance, options) => {
    // Custom logic sebelum update
  });

  // afterUpdate
  t_surat_jalan_return.addHook('afterUpdate', async (instance, options) => {
    // Custom logic setelah update
  });

  // beforeSave
  t_surat_jalan_return.addHook('beforeSave', async (instance, options) => {
    // Custom logic sebelum save
  });

  // afterSave
  t_surat_jalan_return.addHook('afterSave', async (instance, options) => {
    // if (instance.status == TRX_STATUS.POSTED) postStockAdjustment(instance, t_surat_jalan_return_d, inventoryService)
  });

  // beforeBulkCreate
  t_surat_jalan_return.addHook('beforeBulkCreate', async (instances, options) => {
    // Custom logic sebelum bulk create
  });

  // afterBulkCreate
  t_surat_jalan_return.addHook('afterBulkCreate', async (instances, options) => {
    // Custom logic setelah bulk create
  });

  // beforeBulkDestroy
  t_surat_jalan_return.addHook('beforeBulkDestroy', async (options) => {
    // Custom logic sebelum bulk destroy
  });

  // afterBulkDestroy
  t_surat_jalan_return.addHook('afterBulkDestroy', async (options) => {
    // Custom logic setelah bulk destroy
  });

  // beforeBulkUpdate
  t_surat_jalan_return.addHook('beforeBulkUpdate', async (options) => {
    // Custom logic sebelum bulk update
  });

  // afterBulkUpdate
  t_surat_jalan_return.addHook('afterBulkUpdate', async (options) => {
    // Custom logic setelah bulk update
  });
}
