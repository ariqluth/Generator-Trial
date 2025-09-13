// Hooks for t_penerimaan_barang model
import t_penerimaan_barang from '../models/t_penerimaan_barang.js';
import t_penerimaan_barang_d from '../models/t_penerimaan_barang_d.js';

export function registert_penerimaan_barangHooks() {
  // beforeValidate
  t_penerimaan_barang.addHook('beforeValidate', async (instance, options) => {
    // Custom logic sebelum validasi
  });

  // afterValidate
  t_penerimaan_barang.addHook('afterValidate', async (instance, options) => {
    // Custom logic setelah validasi
  });

  // beforeCreate
  t_penerimaan_barang.addHook('beforeCreate', async (instance, options) => {
    // Custom logic sebelum create
  });

  // afterCreate
  t_penerimaan_barang.addHook('afterCreate', async (instance, options) => {
    // Custom logic setelah create
  });

  // beforeDestroy
  t_penerimaan_barang.addHook('beforeDestroy', async (instance, options) => {
    // Custom logic sebelum destroy
  });

  // afterDestroy
  t_penerimaan_barang.addHook('afterDestroy', async (instance, options) => {
    // Custom logic setelah destroy
    if (instance.id) {
        await t_penerimaan_barang_d.destroy({
            where: { t_penerimaan_barang_id: instance.id },
            transaction: options.transaction
        });
    }
  });

  // beforeUpdate
  t_penerimaan_barang.addHook('beforeUpdate', async (instance, options) => {
    // Custom logic sebelum update
  });

  // afterUpdate
  t_penerimaan_barang.addHook('afterUpdate', async (instance, options) => {
    // Custom logic setelah update
  });

  // beforeSave
  t_penerimaan_barang.addHook('beforeSave', async (instance, options) => {
    // Custom logic sebelum save
  });

  // afterSave
  t_penerimaan_barang.addHook('afterSave', async (instance, options) => {
    // Custom logic setelah save
  });

  // beforeBulkCreate
  t_penerimaan_barang.addHook('beforeBulkCreate', async (instances, options) => {
    // Custom logic sebelum bulk create
  });

  // afterBulkCreate
  t_penerimaan_barang.addHook('afterBulkCreate', async (instances, options) => {
    // Custom logic setelah bulk create
  });

  // beforeBulkDestroy
  t_penerimaan_barang.addHook('beforeBulkDestroy', async (options) => {
    // Custom logic sebelum bulk destroy
  });

  // afterBulkDestroy
  t_penerimaan_barang.addHook('afterBulkDestroy', async (options) => {
    // Custom logic setelah bulk destroy
  });

  // beforeBulkUpdate
  t_penerimaan_barang.addHook('beforeBulkUpdate', async (options) => {
    // Custom logic sebelum bulk update
  });

  // afterBulkUpdate
  t_penerimaan_barang.addHook('afterBulkUpdate', async (options) => {
    // Custom logic setelah bulk update
  });
}
