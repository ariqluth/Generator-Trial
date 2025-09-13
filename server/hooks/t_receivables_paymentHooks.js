// Hooks for t_receivables_payment model
import t_receivables_payment from '../models/t_receivables_payment.js';
import m_gen from '../models/m_gen.js';

const menuId = '4f569637-db8c-4303-9548-a5c76b2b73ca';

export function registert_receivables_paymentHooks() {
  // beforeValidate
  t_receivables_payment.addHook('beforeValidate', async (instance, options) => {
    // Custom logic sebelum validasi
    if (instance.isNewRecord) {
        const code = await getCodeStructure(t_receivables_payment, menuId, instance.unit_bussiness_id);
        instance.code = code.data;

        const type = await m_gen.findOne({ where: { id: instance.type_id, group: 'm_accounting_type' } })

        const cashMenuId = type.value1 === 'KAS'
            ? '7fa05212-ecdd-4123-9478-5091185fda7b'
            : 'cd51c1da-48eb-4ed2-a7b4-9b2bdd50bc7d';

        const cash_code = await getCodeStructure(t_receivables_payment, cashMenuId, instance.unit_bussiness_id);
        instance.cash_code = cash_code.data;
    }
  });

  // afterValidate
  t_receivables_payment.addHook('afterValidate', async (instance, options) => {
    // Custom logic setelah validasi
  });

  // beforeCreate
  t_receivables_payment.addHook('beforeCreate', async (instance, options) => {
    // Custom logic sebelum create
  });

  // afterCreate
  t_receivables_payment.addHook('afterCreate', async (instance, options) => {
    // Custom logic setelah create
  });

  // beforeDestroy
  t_receivables_payment.addHook('beforeDestroy', async (instance, options) => {
    // Custom logic sebelum destroy
  });

  // afterDestroy
  t_receivables_payment.addHook('afterDestroy', async (instance, options) => {
    // Custom logic setelah destroy
  });

  // beforeUpdate
  t_receivables_payment.addHook('beforeUpdate', async (instance, options) => {
    // Custom logic sebelum update
  });

  // afterUpdate
  t_receivables_payment.addHook('afterUpdate', async (instance, options) => {
    // Custom logic setelah update
  });

  // beforeSave
  t_receivables_payment.addHook('beforeSave', async (instance, options) => {
    // Custom logic sebelum save
  });

  // afterSave
  t_receivables_payment.addHook('afterSave', async (instance, options) => {
    // Custom logic setelah save
  });

  // beforeBulkCreate
  t_receivables_payment.addHook('beforeBulkCreate', async (instances, options) => {
    // Custom logic sebelum bulk create
  });

  // afterBulkCreate
  t_receivables_payment.addHook('afterBulkCreate', async (instances, options) => {
    // Custom logic setelah bulk create
  });

  // beforeBulkDestroy
  t_receivables_payment.addHook('beforeBulkDestroy', async (options) => {
    // Custom logic sebelum bulk destroy
  });

  // afterBulkDestroy
  t_receivables_payment.addHook('afterBulkDestroy', async (options) => {
    // Custom logic setelah bulk destroy
  });

  // beforeBulkUpdate
  t_receivables_payment.addHook('beforeBulkUpdate', async (options) => {
    // Custom logic sebelum bulk update
  });

  // afterBulkUpdate
  t_receivables_payment.addHook('afterBulkUpdate', async (options) => {
    // Custom logic setelah bulk update
  });
}
