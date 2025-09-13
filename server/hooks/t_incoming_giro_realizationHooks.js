// Hooks for t_incoming_giro_realization model
import t_incoming_giro_realization from '../models/t_incoming_giro_realization.js';

const menuId = '6c74ad88-b80e-4569-b981-847e1b2fafef';

export function registert_incoming_giro_realizationHooks() {
  // beforeValidate
  t_incoming_giro_realization.addHook('beforeValidate', async (instance, options) => {
    // Custom logic sebelum validasi
    if (instance.isNewRecord) {
        const code = await getCodeStructure(t_incoming_giro_realization, menuId, instance.unit_bussiness_id);
        instance.code = code.data;
    }
  });

  // afterValidate
  t_incoming_giro_realization.addHook('afterValidate', async (instance, options) => {
    // Custom logic setelah validasi
  });

  // beforeCreate
  t_incoming_giro_realization.addHook('beforeCreate', async (instance, options) => {
    // Custom logic sebelum create
  });

  // afterCreate
  t_incoming_giro_realization.addHook('afterCreate', async (instance, options) => {
    // Custom logic setelah create
  });

  // beforeDestroy
  t_incoming_giro_realization.addHook('beforeDestroy', async (instance, options) => {
    // Custom logic sebelum destroy
  });

  // afterDestroy
  t_incoming_giro_realization.addHook('afterDestroy', async (instance, options) => {
    // Custom logic setelah destroy
  });

  // beforeUpdate
  t_incoming_giro_realization.addHook('beforeUpdate', async (instance, options) => {
    // Custom logic sebelum update
  });

  // afterUpdate
  t_incoming_giro_realization.addHook('afterUpdate', async (instance, options) => {
    // Custom logic setelah update
  });

  // beforeSave
  t_incoming_giro_realization.addHook('beforeSave', async (instance, options) => {
    // Custom logic sebelum save
  });

  // afterSave
  t_incoming_giro_realization.addHook('afterSave', async (instance, options) => {
    // Custom logic setelah save
  });

  // beforeBulkCreate
  t_incoming_giro_realization.addHook('beforeBulkCreate', async (instances, options) => {
    // Custom logic sebelum bulk create
  });

  // afterBulkCreate
  t_incoming_giro_realization.addHook('afterBulkCreate', async (instances, options) => {
    // Custom logic setelah bulk create
  });

  // beforeBulkDestroy
  t_incoming_giro_realization.addHook('beforeBulkDestroy', async (options) => {
    // Custom logic sebelum bulk destroy
  });

  // afterBulkDestroy
  t_incoming_giro_realization.addHook('afterBulkDestroy', async (options) => {
    // Custom logic setelah bulk destroy
  });

  // beforeBulkUpdate
  t_incoming_giro_realization.addHook('beforeBulkUpdate', async (options) => {
    // Custom logic sebelum bulk update
  });

  // afterBulkUpdate
  t_incoming_giro_realization.addHook('afterBulkUpdate', async (options) => {
    // Custom logic setelah bulk update
  });
}
