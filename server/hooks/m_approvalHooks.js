// Hooks for m_approval model
import m_approval from '../models/m_approval.js';
import { Op } from 'sequelize';

export function registerm_approvalHooks() {
  // beforeValidate
  m_approval.addHook('beforeValidate', async (instance, options) => {
    // Custom logic sebelum validasi
  });

  // afterValidate
  m_approval.addHook('afterValidate', async (instance, options) => {
    // Custom logic setelah validasi
  });

  // beforeCreate
  m_approval.addHook('beforeCreate', async (instance, options) => {
    // Custom logic sebelum create
    const overlapApproval = await m_approval.findOne({
      where: {
        unit_bussiness_id: instance.unit_bussiness_id,
        menu_id: instance.menu_id,
        min_trx: { [Op.lte]: instance.max_trx },
        max_trx: { [Op.gte]: instance.min_trx },
      },
    });
    if (overlapApproval) {
        throw new Error("Approval pada rentang transaksi tersebut sudah ada.");
    }
  });

  // afterCreate
  m_approval.addHook('afterCreate', async (instance, options) => {
    // Custom logic setelah create
  });

  // beforeDestroy
  m_approval.addHook('beforeDestroy', async (instance, options) => {
    // Custom logic sebelum destroy
  });

  // afterDestroy
  m_approval.addHook('afterDestroy', async (instance, options) => {
    // Custom logic setelah destroy
  });

  // beforeUpdate
  m_approval.addHook('beforeUpdate', async (instance, options) => {
    // Custom logic sebelum update
  });

  // afterUpdate
  m_approval.addHook('afterUpdate', async (instance, options) => {
    // Custom logic setelah update
  });

  // beforeSave
  m_approval.addHook('beforeSave', async (instance, options) => {
    // Custom logic sebelum save
  });

  // afterSave
  m_approval.addHook('afterSave', async (instance, options) => {
    // Custom logic setelah save
  });

  // beforeBulkCreate
  m_approval.addHook('beforeBulkCreate', async (instances, options) => {
    // Custom logic sebelum bulk create
  });

  // afterBulkCreate
  m_approval.addHook('afterBulkCreate', async (instances, options) => {
    // Custom logic setelah bulk create
  });

  // beforeBulkDestroy
  m_approval.addHook('beforeBulkDestroy', async (options) => {
    // Custom logic sebelum bulk destroy
  });

  // afterBulkDestroy
  m_approval.addHook('afterBulkDestroy', async (options) => {
    // Custom logic setelah bulk destroy
  });

  // beforeBulkUpdate
  m_approval.addHook('beforeBulkUpdate', async (options) => {
    // Custom logic sebelum bulk update
  });

  // afterBulkUpdate
  m_approval.addHook('afterBulkUpdate', async (options) => {
    // Custom logic setelah bulk update
  });
}
