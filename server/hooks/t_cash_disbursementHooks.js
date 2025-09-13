// Hooks for t_cash_disbursement model
import t_cash_disbursement from '../models/t_cash_disbursement.js';
import m_gen from '../models/m_gen.js';

const menuId = 'a67c2bc6-13b0-49a0-80c1-01e6b17009a9';

export function registert_cash_disbursementHooks() {
  // beforeValidate
  t_cash_disbursement.addHook('beforeValidate', async (instance, options) => {
    // Custom logic sebelum validasi
    if (instance.isNewRecord) {
        const code = await getCodeStructure(t_cash_disbursement, menuId, instance.unit_bussiness_id);
        instance.code = code.data;

        const type = await m_gen.findOne({ where: { id: instance.type_id, group: 'm_accounting_type' } })

        const cashMenuId = type.value1 === 'KAS'
            ? '030f31e4-f82f-4bef-abb1-cbc0838068e6'
            : '54487cbc-0e27-4531-8906-81e07f29d94a';

        const cash_code = await getCodeStructure(t_cash_disbursement, cashMenuId, instance.unit_bussiness_id);
        instance.cash_code = cash_code.data;
    }
  });

  // afterValidate
  t_cash_disbursement.addHook('afterValidate', async (instance, options) => {
    // Custom logic setelah validasi
  });

  // beforeCreate
  t_cash_disbursement.addHook('beforeCreate', async (instance, options) => {
    // Custom logic sebelum create
  });

  // afterCreate
  t_cash_disbursement.addHook('afterCreate', async (instance, options) => {
    // Custom logic setelah create
  });

  // beforeDestroy
  t_cash_disbursement.addHook('beforeDestroy', async (instance, options) => {
    // Custom logic sebelum destroy
  });

  // afterDestroy
  t_cash_disbursement.addHook('afterDestroy', async (instance, options) => {
    // Custom logic setelah destroy
  });

  // beforeUpdate
  t_cash_disbursement.addHook('beforeUpdate', async (instance, options) => {
    // Custom logic sebelum update
  });

  // afterUpdate
  t_cash_disbursement.addHook('afterUpdate', async (instance, options) => {
    // Custom logic setelah update
  });

  // beforeSave
  t_cash_disbursement.addHook('beforeSave', async (instance, options) => {
    // Custom logic sebelum save
  });

  // afterSave
  t_cash_disbursement.addHook('afterSave', async (instance, options) => {
    // Custom logic setelah save
  });

  // beforeBulkCreate
  t_cash_disbursement.addHook('beforeBulkCreate', async (instances, options) => {
    // Custom logic sebelum bulk create
  });

  // afterBulkCreate
  t_cash_disbursement.addHook('afterBulkCreate', async (instances, options) => {
    // Custom logic setelah bulk create
  });

  // beforeBulkDestroy
  t_cash_disbursement.addHook('beforeBulkDestroy', async (options) => {
    // Custom logic sebelum bulk destroy
  });

  // afterBulkDestroy
  t_cash_disbursement.addHook('afterBulkDestroy', async (options) => {
    // Custom logic setelah bulk destroy
  });

  // beforeBulkUpdate
  t_cash_disbursement.addHook('beforeBulkUpdate', async (options) => {
    // Custom logic sebelum bulk update
  });

  // afterBulkUpdate
  t_cash_disbursement.addHook('afterBulkUpdate', async (options) => {
    // Custom logic setelah bulk update
  });
}
