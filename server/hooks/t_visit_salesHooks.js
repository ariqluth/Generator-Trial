// Hooks for t_visit_sales model
import t_visit_sales from '../models/t_visit_sales.js';

const menuId = '173c6485-37e5-45a7-8887-b1faccbb73ab';

export function registert_visit_salesHooks() {
  // beforeValidate
  t_visit_sales.addHook('beforeValidate', async (instance, options) => {
        // auto generate code
        if (instance.isNewRecord) {
            const code = await getCodeStructure(t_visit_sales, menuId, instance.unit_bussiness_id);
            instance.code = code.data;
        }
  });

  // afterValidate
  t_visit_sales.addHook('afterValidate', async (instance, options) => {
    // Custom logic setelah validasi
  });

  // beforeCreate
  t_visit_sales.addHook('beforeCreate', async (instance, options) => {
    // Custom logic sebelum create
  });

  // afterCreate
  t_visit_sales.addHook('afterCreate', async (instance, options) => {
    // Custom logic setelah create
  });

  // beforeDestroy
  t_visit_sales.addHook('beforeDestroy', async (instance, options) => {
    // Custom logic sebelum destroy
  });

  // afterDestroy
  t_visit_sales.addHook('afterDestroy', async (instance, options) => {
    // Custom logic setelah destroy
  });

  // beforeUpdate
  t_visit_sales.addHook('beforeUpdate', async (instance, options) => {
    // Custom logic sebelum update
  });

  // afterUpdate
  t_visit_sales.addHook('afterUpdate', async (instance, options) => {
    // Custom logic setelah update
  });

  // beforeSave
  t_visit_sales.addHook('beforeSave', async (instance, options) => {
    // Custom logic sebelum save
  });

  // afterSave
  t_visit_sales.addHook('afterSave', async (instance, options) => {
    // Custom logic setelah save
  });

  // beforeBulkCreate
  t_visit_sales.addHook('beforeBulkCreate', async (instances, options) => {
    // Custom logic sebelum bulk create
  });

  // afterBulkCreate
  t_visit_sales.addHook('afterBulkCreate', async (instances, options) => {
    // Custom logic setelah bulk create
  });

  // beforeBulkDestroy
  t_visit_sales.addHook('beforeBulkDestroy', async (options) => {
    // Custom logic sebelum bulk destroy
  });

  // afterBulkDestroy
  t_visit_sales.addHook('afterBulkDestroy', async (options) => {
    // Custom logic setelah bulk destroy
  });

  // beforeBulkUpdate
  t_visit_sales.addHook('beforeBulkUpdate', async (options) => {
    // Custom logic sebelum bulk update
  });

  // afterBulkUpdate
  t_visit_sales.addHook('afterBulkUpdate', async (options) => {
    // Custom logic setelah bulk update
  });
}
