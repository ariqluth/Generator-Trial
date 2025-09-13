// Hooks for t_ap_payment model
import t_ap_payment from '../models/t_ap_payment.js';
import t_ap_payment_d from '../models/t_ap_payment_d.js';

export function registert_ap_paymentHooks() {
  // beforeValidate
  t_ap_payment.addHook('beforeValidate', async (instance, options) => {
    // Custom logic sebelum validasi
  });

  // afterValidate
  t_ap_payment.addHook('afterValidate', async (instance, options) => {
    // Custom logic setelah validasi
  });

  // beforeCreate
  t_ap_payment.addHook('beforeCreate', async (instance, options) => {
    // Custom logic sebelum create
  });

  // afterCreate
  t_ap_payment.addHook('afterCreate', async (instance, options) => {
    // Custom logic setelah create
  });

  // beforeDestroy
  t_ap_payment.addHook('beforeDestroy', async (instance, options) => {
    // Custom logic sebelum destroy
  });

  // afterDestroy
  t_ap_payment.addHook('afterDestroy', async (instance, options) => {
    // Custom logic setelah destroy
    if (instance.id) {
        await t_ap_payment_d.destroy({
            where: { ap_payment_id: instance.id },
            transaction: options.transaction
        });
    }
  });

  // beforeUpdate
  t_ap_payment.addHook('beforeUpdate', async (instance, options) => {
    // Custom logic sebelum update
  });

  // afterUpdate
  t_ap_payment.addHook('afterUpdate', async (instance, options) => {
    // Custom logic setelah update
  });

  // beforeSave
  t_ap_payment.addHook('beforeSave', async (instance, options) => {
    // Custom logic sebelum save
  });

  // afterSave
  t_ap_payment.addHook('afterSave', async (instance, options) => {
    // Custom logic setelah save
  });

  // beforeBulkCreate
  t_ap_payment.addHook('beforeBulkCreate', async (instances, options) => {
    // Custom logic sebelum bulk create
  });

  // afterBulkCreate
  t_ap_payment.addHook('afterBulkCreate', async (instances, options) => {
    // Custom logic setelah bulk create
  });

  // beforeBulkDestroy
  t_ap_payment.addHook('beforeBulkDestroy', async (options) => {
    // Custom logic sebelum bulk destroy
  });

  // afterBulkDestroy
  t_ap_payment.addHook('afterBulkDestroy', async (options) => {
    // Custom logic setelah bulk destroy
  });

  // beforeBulkUpdate
  t_ap_payment.addHook('beforeBulkUpdate', async (options) => {
    // Custom logic sebelum bulk update
  });

  // afterBulkUpdate
  t_ap_payment.addHook('afterBulkUpdate', async (options) => {
    // Custom logic setelah bulk update
  });
}
