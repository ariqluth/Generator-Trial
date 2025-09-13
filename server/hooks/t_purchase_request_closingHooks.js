// Hooks for t_purchase_request_closing model
import t_purchase_request_closing from '../models/t_purchase_request_closing.js';
import t_purchase_request_closing_d from '../models/t_purchase_request_closing_d.js';

export function registert_purchase_request_closingHooks() {
  // beforeValidate
  t_purchase_request_closing.addHook('beforeValidate', async (instance, options) => {
    // Custom logic sebelum validasi
  });

  // afterValidate
  t_purchase_request_closing.addHook('afterValidate', async (instance, options) => {
    // Custom logic setelah validasi
  });

  // beforeCreate
  t_purchase_request_closing.addHook('beforeCreate', async (instance, options) => {
    // Custom logic sebelum create
  });

  // afterCreate
  t_purchase_request_closing.addHook('afterCreate', async (instance, options) => {
    // Custom logic setelah create
  });

  // beforeDestroy
  t_purchase_request_closing.addHook('beforeDestroy', async (instance, options) => {
    // Custom logic sebelum destroy
  });

  // afterDestroy
  t_purchase_request_closing.addHook('afterDestroy', async (instance, options) => {
    // Custom logic setelah destroy
    if (instance.id) {
        await t_purchase_request_closing_d.destroy({
            where: { purchase_request_closing_id: instance.id },
            transaction: options.transaction
        });
    }
  });

  // beforeUpdate
  t_purchase_request_closing.addHook('beforeUpdate', async (instance, options) => {
    // Custom logic sebelum update
  });

  // afterUpdate
  t_purchase_request_closing.addHook('afterUpdate', async (instance, options) => {
    // Custom logic setelah update
  });

  // beforeSave
  t_purchase_request_closing.addHook('beforeSave', async (instance, options) => {
    // Custom logic sebelum save
  });

  // afterSave
  t_purchase_request_closing.addHook('afterSave', async (instance, options) => {
    // Custom logic setelah save
  });

  // beforeBulkCreate
  t_purchase_request_closing.addHook('beforeBulkCreate', async (instances, options) => {
    // Custom logic sebelum bulk create
  });

  // afterBulkCreate
  t_purchase_request_closing.addHook('afterBulkCreate', async (instances, options) => {
    // Custom logic setelah bulk create
  });

  // beforeBulkDestroy
  t_purchase_request_closing.addHook('beforeBulkDestroy', async (options) => {
    // Custom logic sebelum bulk destroy
  });

  // afterBulkDestroy
  t_purchase_request_closing.addHook('afterBulkDestroy', async (options) => {
    // Custom logic setelah bulk destroy
  });

  // beforeBulkUpdate
  t_purchase_request_closing.addHook('beforeBulkUpdate', async (options) => {
    // Custom logic sebelum bulk update
  });

  // afterBulkUpdate
  t_purchase_request_closing.addHook('afterBulkUpdate', async (options) => {
    // Custom logic setelah bulk update
  });
}
