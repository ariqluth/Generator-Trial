// Hooks for t_purchase_return model
import t_purchase_return from '../models/t_purchase_return.js';
import t_purchase_return_d from '../models/t_purchase_return_d.js';
import t_purchase_return_approval from '../models/t_purchase_return_approval.js';

export function registert_purchase_returnHooks() {
  // beforeValidate
  t_purchase_return.addHook('beforeValidate', async (instance, options) => {
    // Custom logic sebelum validasi
  });

  // afterValidate
  t_purchase_return.addHook('afterValidate', async (instance, options) => {
    // Custom logic setelah validasi
  });

  // beforeCreate
  t_purchase_return.addHook('beforeCreate', async (instance, options) => {
    // Custom logic sebelum create
  });

  // afterCreate
  t_purchase_return.addHook('afterCreate', async (instance, options) => {
    // Custom logic setelah create
  });

  // beforeDestroy
  t_purchase_return.addHook('beforeDestroy', async (instance, options) => {
    // Custom logic sebelum destroy
  });

  // afterDestroy
  t_purchase_return.addHook('afterDestroy', async (instance, options) => {
    // Custom logic setelah destroy

    if (instance.id) {
        await t_purchase_return_d.destroy({
            where: { t_purchase_return_id: instance.id },
            transaction: options.transaction
        });
        await t_purchase_return_approval.destroy({
            where: { purchase_return_id: instance.id },
            transaction: options.transaction
        });
    }
  });

  // beforeUpdate
  t_purchase_return.addHook('beforeUpdate', async (instance, options) => {
    // Custom logic sebelum update
  });

  // afterUpdate
  t_purchase_return.addHook('afterUpdate', async (instance, options) => {
    // Custom logic setelah update
  });

  // beforeSave
  t_purchase_return.addHook('beforeSave', async (instance, options) => {
    // Custom logic sebelum save
  });

  // afterSave
  t_purchase_return.addHook('afterSave', async (instance, options) => {
    // Custom logic setelah save
  });

  // beforeBulkCreate
  t_purchase_return.addHook('beforeBulkCreate', async (instances, options) => {
    // Custom logic sebelum bulk create
  });

  // afterBulkCreate
  t_purchase_return.addHook('afterBulkCreate', async (instances, options) => {
    // Custom logic setelah bulk create
  });

  // beforeBulkDestroy
  t_purchase_return.addHook('beforeBulkDestroy', async (options) => {
    // Custom logic sebelum bulk destroy
  });

  // afterBulkDestroy
  t_purchase_return.addHook('afterBulkDestroy', async (options) => {
    // Custom logic setelah bulk destroy
  });

  // beforeBulkUpdate
  t_purchase_return.addHook('beforeBulkUpdate', async (options) => {
    // Custom logic sebelum bulk update
  });

  // afterBulkUpdate
  t_purchase_return.addHook('afterBulkUpdate', async (options) => {
    // Custom logic setelah bulk update
  });
}
