// Hooks for t_surat_jalan model
import t_surat_jalan from '../models/t_surat_jalan.js';
import t_delivery_plan from '../models/t_delivery_plan.js';

export function registert_surat_jalanHooks() {
  // beforeValidate
  t_surat_jalan.addHook('beforeValidate', async (instance, options) => {
    // Custom logic sebelum validasi
  });

  // afterValidate
  t_surat_jalan.addHook('afterValidate', async (instance, options) => {
    // Custom logic setelah validasi
  });

  // beforeCreate
  t_surat_jalan.addHook('beforeCreate', async (instance, options) => {
    // Custom logic sebelum create
  });

  // afterCreate
  t_surat_jalan.addHook('afterCreate', async (instance, options) => {
    // Custom logic setelah create
  });

  // beforeDestroy
  t_surat_jalan.addHook('beforeDestroy', async (instance, options) => {
    // Custom logic sebelum destroy
  });

  // afterDestroy
  t_surat_jalan.addHook('afterDestroy', async (instance, options) => {
    // Custom logic setelah destroy
    await t_delivery_plan.update(
        { sj_used: false },
        {
            where: { id: instance.delivery_plan_id },
        }
    );
  });

  // beforeUpdate
  t_surat_jalan.addHook('beforeUpdate', async (instance, options) => {
    // Custom logic sebelum update
  });

  // afterUpdate
  t_surat_jalan.addHook('afterUpdate', async (instance, options) => {
    // Custom logic setelah update
  });

  // beforeSave
  t_surat_jalan.addHook('beforeSave', async (instance, options) => {
    // Custom logic sebelum save
  });

  // afterSave
  t_surat_jalan.addHook('afterSave', async (instance, options) => {
    // Custom logic setelah save
  });

  // beforeBulkCreate
  t_surat_jalan.addHook('beforeBulkCreate', async (instances, options) => {
    // Custom logic sebelum bulk create
  });

  // afterBulkCreate
  t_surat_jalan.addHook('afterBulkCreate', async (instances, options) => {
    // Custom logic setelah bulk create
  });

  // beforeBulkDestroy
  t_surat_jalan.addHook('beforeBulkDestroy', async (options) => {
    // Custom logic sebelum bulk destroy
  });

  // afterBulkDestroy
  t_surat_jalan.addHook('afterBulkDestroy', async (options) => {
    // Custom logic setelah bulk destroy
  });

  // beforeBulkUpdate
  t_surat_jalan.addHook('beforeBulkUpdate', async (options) => {
    // Custom logic sebelum bulk update
  });

  // afterBulkUpdate
  t_surat_jalan.addHook('afterBulkUpdate', async (options) => {
    // Custom logic setelah bulk update
  });
}
