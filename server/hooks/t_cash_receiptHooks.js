// Hooks for t_cash_receipt model
import t_cash_receipt from '../models/t_cash_receipt.js';
import m_gen from '../models/m_gen.js';

const menuId = 'e1b9f686-2fa2-4017-aab6-11d807674cee';

export function registert_cash_receiptHooks() {
  // beforeValidate
  t_cash_receipt.addHook('beforeValidate', async (instance, options) => {
    // Custom logic sebelum validasi
    if (instance.isNewRecord) {
        const code = await getCodeStructure(t_cash_receipt, menuId, instance.unit_bussiness_id);
        instance.code = code.data;

        const type = await m_gen.findOne({ where: { id: instance.type_id, group: 'm_accounting_type' } })

        const cashMenuId = type.value1 === 'KAS'
            ? '7fa05212-ecdd-4123-9478-5091185fda7b'
            : 'cd51c1da-48eb-4ed2-a7b4-9b2bdd50bc7d';

        const cash_code = await getCodeStructure(t_cash_receipt, cashMenuId, instance.unit_bussiness_id);
        instance.cash_code = cash_code.data;
    }
  });

  // afterValidate
  t_cash_receipt.addHook('afterValidate', async (instance, options) => {
    // Custom logic setelah validasi
  });

  // beforeCreate
  t_cash_receipt.addHook('beforeCreate', async (instance, options) => {
    // Custom logic sebelum create
  });

  // afterCreate
  t_cash_receipt.addHook('afterCreate', async (instance, options) => {
    // Custom logic setelah create
  });

  // beforeDestroy
  t_cash_receipt.addHook('beforeDestroy', async (instance, options) => {
    // Custom logic sebelum destroy
  });

  // afterDestroy
  t_cash_receipt.addHook('afterDestroy', async (instance, options) => {
    // Custom logic setelah destroy
  });

  // beforeUpdate
  t_cash_receipt.addHook('beforeUpdate', async (instance, options) => {
    // Custom logic sebelum update
  });

  // afterUpdate
  t_cash_receipt.addHook('afterUpdate', async (instance, options) => {
    // Custom logic setelah update
  });

  // beforeSave
  t_cash_receipt.addHook('beforeSave', async (instance, options) => {
    // Custom logic sebelum save
  });

  // afterSave
  t_cash_receipt.addHook('afterSave', async (instance, options) => {
    // Custom logic setelah save
  });

  // beforeBulkCreate
  t_cash_receipt.addHook('beforeBulkCreate', async (instances, options) => {
    // Custom logic sebelum bulk create
  });

  // afterBulkCreate
  t_cash_receipt.addHook('afterBulkCreate', async (instances, options) => {
    // Custom logic setelah bulk create
  });

  // beforeBulkDestroy
  t_cash_receipt.addHook('beforeBulkDestroy', async (options) => {
    // Custom logic sebelum bulk destroy
  });

  // afterBulkDestroy
  t_cash_receipt.addHook('afterBulkDestroy', async (options) => {
    // Custom logic setelah bulk destroy
  });

  // beforeBulkUpdate
  t_cash_receipt.addHook('beforeBulkUpdate', async (options) => {
    // Custom logic sebelum bulk update
  });

  // afterBulkUpdate
  t_cash_receipt.addHook('afterBulkUpdate', async (options) => {
    // Custom logic setelah bulk update
  });
}
