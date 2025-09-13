// Hooks for m_delivery_area model
import m_delivery_area from '../models/m_delivery_area.js';

const menuId = 'e6b34dcf-96a7-4e27-a055-74aa716b2d39';

export function registerm_delivery_areaHooks() {
  // beforeValidate
  m_delivery_area.addHook('beforeValidate', async (instance, options) => {
    // Custom logic sebelum validasi
    if (instance.isNewRecord) {
        const code = await getCodeStructure(m_delivery_area, menuId);
        instance.code = code.data;
    }
  });

  // afterValidate
  m_delivery_area.addHook('afterValidate', async (instance, options) => {
    // Custom logic setelah validasi
  });

  // beforeCreate
  m_delivery_area.addHook('beforeCreate', async (instance, options) => {
    // Custom logic sebelum create
  });

  // afterCreate
  m_delivery_area.addHook('afterCreate', async (instance, options) => {
    // Custom logic setelah create
  });

  // beforeDestroy
  m_delivery_area.addHook('beforeDestroy', async (instance, options) => {
    // Custom logic sebelum destroy
  });

  // afterDestroy
  m_delivery_area.addHook('afterDestroy', async (instance, options) => {
    // Custom logic setelah destroy
  });

  // beforeUpdate
  m_delivery_area.addHook('beforeUpdate', async (instance, options) => {
    // Custom logic sebelum update
  });

  // afterUpdate
  m_delivery_area.addHook('afterUpdate', async (instance, options) => {
    // Custom logic setelah update
  });

  // beforeSave
  m_delivery_area.addHook('beforeSave', async (instance, options) => {
    // Custom logic sebelum save
  });

  // afterSave
  m_delivery_area.addHook('afterSave', async (instance, options) => {
    // Custom logic setelah save
  });

  // beforeBulkCreate
  m_delivery_area.addHook('beforeBulkCreate', async (instances, options) => {
    // Custom logic sebelum bulk create
  });

  // afterBulkCreate
  m_delivery_area.addHook('afterBulkCreate', async (instances, options) => {
    // Custom logic setelah bulk create
  });

  // beforeBulkDestroy
  m_delivery_area.addHook('beforeBulkDestroy', async (options) => {
    // Custom logic sebelum bulk destroy
  });

  // afterBulkDestroy
  m_delivery_area.addHook('afterBulkDestroy', async (options) => {
    // Custom logic setelah bulk destroy
  });

  // beforeBulkUpdate
  m_delivery_area.addHook('beforeBulkUpdate', async (options) => {
    // Custom logic sebelum bulk update
  });

  // afterBulkUpdate
  m_delivery_area.addHook('afterBulkUpdate', async (options) => {
    // Custom logic setelah bulk update
  });
}
