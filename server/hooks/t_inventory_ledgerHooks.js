// Hooks for t_inventory_ledger model
import t_inventory_ledger from '../models/t_inventory_ledger.js';
import m_warehouse from '../models/m_warehouse.js';

export function registert_inventory_ledgerHooks() {
  // beforeValidate
  t_inventory_ledger.addHook('beforeValidate', async (instance, options) => {
    // Custom logic sebelum validasi
    instance.created_at_timestamp = Date.now()
  });

  // afterValidate
  t_inventory_ledger.addHook('afterValidate', async (instance, options) => {
    // Custom logic setelah validasi
  });

  // beforeCreate
  t_inventory_ledger.addHook('beforeCreate', async (instance, options) => {
    // Custom logic sebelum create
    const warehouse = await m_warehouse.findByPk(instance.warehouse_id);
    if (warehouse) {
        instance.unit_bussiness_id = warehouse.unit_bussiness_id
    } 
  });

  // afterCreate
  t_inventory_ledger.addHook('afterCreate', async (instance, options) => {
    // Custom logic setelah create
  });

  // beforeDestroy
  t_inventory_ledger.addHook('beforeDestroy', async (instance, options) => {
    // Custom logic sebelum destroy
  });

  // afterDestroy
  t_inventory_ledger.addHook('afterDestroy', async (instance, options) => {
    // Custom logic setelah destroy
  });

  // beforeUpdate
  t_inventory_ledger.addHook('beforeUpdate', async (instance, options) => {
    // Custom logic sebelum update
  });

  // afterUpdate
  t_inventory_ledger.addHook('afterUpdate', async (instance, options) => {
    // Custom logic setelah update
  });

  // beforeSave
  t_inventory_ledger.addHook('beforeSave', async (instance, options) => {
    // Custom logic sebelum save
  });

  // afterSave
  t_inventory_ledger.addHook('afterSave', async (instance, options) => {
    // Custom logic setelah save
  });

  // beforeBulkCreate
  t_inventory_ledger.addHook('beforeBulkCreate', async (instances, options) => {
    // Custom logic sebelum bulk create
  });

  // afterBulkCreate
  t_inventory_ledger.addHook('afterBulkCreate', async (instances, options) => {
    // Custom logic setelah bulk create
  });

  // beforeBulkDestroy
  t_inventory_ledger.addHook('beforeBulkDestroy', async (options) => {
    // Custom logic sebelum bulk destroy
  });

  // afterBulkDestroy
  t_inventory_ledger.addHook('afterBulkDestroy', async (options) => {
    // Custom logic setelah bulk destroy
  });

  // beforeBulkUpdate
  t_inventory_ledger.addHook('beforeBulkUpdate', async (options) => {
    // Custom logic sebelum bulk update
  });

  // afterBulkUpdate
  t_inventory_ledger.addHook('afterBulkUpdate', async (options) => {
    // Custom logic setelah bulk update
  });
}
