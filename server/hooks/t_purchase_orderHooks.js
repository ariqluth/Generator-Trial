// Hooks for t_purchase_order model
import t_purchase_order from '../models/t_purchase_order.js';
import t_purchase_order_d from '../models/t_purchase_order_d.js';
import t_purchase_order_approval from '../models/t_purchase_order_approval.js';

export function registert_purchase_orderHooks() {
  // beforeValidate
  t_purchase_order.addHook('beforeValidate', async (instance, options) => {
    // Custom logic sebelum validasi
    // Custom logic sebelum create
  });

  // afterValidate
  t_purchase_order.addHook('afterValidate', async (instance, options) => {
    // Custom logic setelah validasi
  });

  // beforeCreate
  t_purchase_order.addHook('beforeCreate', async (instance, options) => {
    // Custom logic sebelum create
  });

  // afterCreate
  t_purchase_order.addHook('afterCreate', async (instance, options) => {
    // Custom logic setelah create
  });

  // beforeDestroy
  t_purchase_order.addHook('beforeDestroy', async (instance, options) => {
    // Custom logic sebelum destroy
  });

  // afterDestroy
  t_purchase_order.addHook('afterDestroy', async (instance, options) => {
    // Custom logic setelah destroy
    if (instance.id) {
        await t_purchase_order_d.destroy({
            where: { purchase_order_id: instance.id },
            transaction: options.transaction
        });
        await t_purchase_order_approval.destroy({
            where: { purchase_order_id: instance.id },
            transaction: options.transaction
        });
    }
  });

  // beforeUpdate
  t_purchase_order.addHook('beforeUpdate', async (instance, options) => {
    // Custom logic sebelum update
  });

  // afterUpdate
  t_purchase_order.addHook('afterUpdate', async (instance, options) => {
    // Custom logic setelah update
  });

  // beforeSave
  t_purchase_order.addHook('beforeSave', async (instance, options) => {
    // Custom logic sebelum save
  });

  // afterSave
  t_purchase_order.addHook('afterSave', async (instance, options) => {
    // Custom logic setelah save
  });

  // beforeBulkCreate
  t_purchase_order.addHook('beforeBulkCreate', async (instances, options) => {
    // Custom logic sebelum bulk create
  });

  // afterBulkCreate
  t_purchase_order.addHook('afterBulkCreate', async (instances, options) => {
    // Custom logic setelah bulk create
  });

  // beforeBulkDestroy
  t_purchase_order.addHook('beforeBulkDestroy', async (options) => {
    // Custom logic sebelum bulk destroy
  });

  // afterBulkDestroy
  t_purchase_order.addHook('afterBulkDestroy', async (options) => {
    // Custom logic setelah bulk destroy
  });

  // beforeBulkUpdate
  t_purchase_order.addHook('beforeBulkUpdate', async (options) => {
    // Custom logic sebelum bulk update
  });

  // afterBulkUpdate
  t_purchase_order.addHook('afterBulkUpdate', async (options) => {
    // Custom logic setelah bulk update
  });
}
