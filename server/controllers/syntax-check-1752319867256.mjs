// Controller for t_inventory_ledger
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_inventory_ledger
//
// Tambahkan custom function di bawah ini

import { readdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { sequelize } from '../config/database.js';
import t_inventory_ledger from '../models/t_inventory_ledger.js';
import m_item from '../models/m_item.js';
import m_warehouse from '../models/m_warehouse.js';
import t_inventory_s_batches from '../models/t_inventory_s_batches.js';
import t_inventory_s_average from '../models/t_inventory_s_average.js';
import m_inventory_type from '../models/m_inventory_type.js';

class InventoryService {
    constructor() {
        this.sequelize = sequelize;
        this.Item = m_item;
        this.Warehouse = m_warehouse;
        this.ItemBatch = t_inventory_s_batches;
        this.InventoryLedger = t_inventory_ledger;
        this.ItemWarehouseStock = t_inventory_s_average;
        this.TransactionType = m_inventory_type;
    }

    /**
     * Records a stock movement atomically and updates summary tables.
     * This is the primary method for all inventory changes.
     */
    async insertStock({
        item_id,
        warehouse_id,
        quantity, // Always positive
        inventory_type_id,
        unitCost,
        reference_id = null,
        reference_source = null,
        batchId = null
    }) {
        // Sequelize's managed transactions automatically commit on success or rollback on error.
        return this.sequelize.transaction(async (t) => {
            // 1. Fetch essential data within the transaction
            const item = await this.Item.findByPk(item_id, { transaction: t });
            const transactionType = await this.TransactionType.findByPk(inventory_type_id, { transaction: t });

            if (!item || !transactionType) {
                throw new Error('Invalid Item or Transaction Type.');
            }

            const options = {
                transaction: t
            };

            // 2. Create the immutable historical record in the ledger
            const ledgerEntry = await this.InventoryLedger.create({
                item_id,
                warehouse_id,
                batchId,
                inventory_type_id,
                quantity,
                cost: unitCost,
                reference_id,
                reference_source,
            }, options);

            // 3. Find or create the summary record for this item/warehouse
            const [stockSummary, isNewRecord] = await this.ItemWarehouseStock.findOrCreate({
                where: { item_id, warehouse_id },
                defaults: { on_hand_quantity: 0, average_cost: 0 },
                transaction: t
            });

            const quantityChange = quantity * transactionType.io_multiplier;

            // 4. Update the summary record based on item type
            if (item.is_batch) {
                // --- BATCH ITEM LOGIC ---
                // For batch items, just update the quantity. Average cost is irrelevant.
                await stockSummary.increment('on_hand_quantity', { by: quantityChange, transaction: t });
            } else {
                // --- NON-BATCH (AVERAGE COST) LOGIC ---
                const oldQuantity = stockSummary.on_hand_quantity;
                const oldAvgCost = stockSummary.average_cost;
                let newAverageCost = oldAvgCost;

                // Recalculate average cost only on STOCK IN
                if (transactionType.io_multiplier > 0) {
                    const newTotalQuantity = oldQuantity + quantity;
                    if (newTotalQuantity > 0) {
                        const totalOldValue = oldQuantity * oldAvgCost;
                        const totalNewValue = quantity * unitCost;
                        newAverageCost = (totalOldValue + totalNewValue) / newTotalQuantity;
                    } else {
                        newAverageCost = unitCost;
                    }
                }

                // Update both quantity and average cost
                await stockSummary.update({
                    on_hand_quantity: oldQuantity + quantityChange,
                    average_cost: newAverageCost
                }, options);
            }

            return ledgerEntry; // Return the created ledger entry on success
        });
    }

    /**
     * Gets the current on-hand stock for an item in a specific warehouse.
     */
    async getCurrentStock(item_id, warehouse_id) {
        const stockSummary = await this.ItemWarehouseStock.findOne({
            where: { item_id, warehouse_id }
        });
        return stockSummary ? stockSummary.on_hand_quantity : 0;
    }

    /**
     * Gets the current Cost of Goods Sold for an item in a warehouse.
     */
    async getCOGS(item_id, warehouse_id) {
        const item = await this.Item.findByPk(item_id);
        if (!item) return 0;

        if (item.is_batch) {
            // Find the next available batch based on FEFO (First-Expired, First-Out)
            const nextBatch = await this.ItemBatch.findOne({
                where: { item_id, warehouse_id, on_hand_quantity: { [this.sequelize.Op.gt]: 0 } },
                order: [['expiration_date', 'ASC']],
            });
            return nextBatch ? nextBatch.purchase_cost : 0;
        } else {
            // For non-batch items, get the specific average cost for that warehouse
            const stockSummary = await this.ItemWarehouseStock.findOne({
                where: { item_id, warehouse_id }
            });
            return stockSummary ? stockSummary.average_cost : 0;
        }
    }


    /**
     * Main recalibration function. Determines the item type and calls the appropriate
     * private helper method to perform the recalibration.
     * @param {object} options
     * @param {number} options.itemId - The ID of the item to recalibrate.
     * @param {number} options.warehouseId - The ID of the warehouse to recalibrate.
     */
    async recalibrateStock({ itemId, warehouseId }) {
        const item = await this.Item.findByPk(itemId);
        if (!item) {
            throw new Error(`Item with ID ${itemId} not found.`);
        }

        // This is the router logic. It calls the correct private method.
        if (item.is_batch) {
            return this._recalibrateBatchItem({ itemId, warehouseId });
        } else {
            return this._recalibrateAverageCostItem({ itemId, warehouseId });
        }
    }

    /**
     * [PRIVATE] Incrementally recalibrates a non-batch (average cost) item.
     * @private
     */
    async _recalibrateAverageCostItem({ itemId, warehouseId }) {
        return this.sequelize.transaction(async (t) => {
            // 1. Fetch the starting point (the last known good state)
            const stockSummary = await this.ItemWarehouseStock.findOne({
                where: { itemId, warehouseId },
                transaction: t
            });

            const startTime = stockSummary ? stockSummary.updatedAt.getTime() : 0;
            let runningQty = stockSummary ? stockSummary.on_hand_quantity : 0;
            let runningAvgCost = stockSummary ? stockSummary.average_cost : 0;

            // 2. Fetch only new ledger entries since the last update
            const newLedgerEntries = await this.InventoryLedger.findAll({
                where: {
                    itemId,
                    warehouseId,
                    created_at: { [this.sequelize.Op.gt]: new Date(startTime) }
                },
                include: [{ model: this.TransactionType, attributes: ['io_multiplier'] }],
                order: [['created_at', 'ASC'], ['id', 'ASC']],
                transaction: t,
            });

            if (newLedgerEntries.length === 0) {
                return { success: true, message: 'No new transactions to process. Stock is up-to-date.' };
            }

            // 3. Process only the new transactions to calculate the final state
            for (const entry of newLedgerEntries) {
                const quantityChange = entry.quantity * entry.TransactionType.io_multiplier;

                // Recalculate running average cost on stock-in
                if (entry.TransactionType.io_multiplier > 0) {
                    const newTotalQty = runningQty + entry.quantity;
                    if (newTotalQty > 0) {
                        const totalOldValue = runningQty * runningAvgCost;
                        const totalNewValue = entry.quantity * entry.cost;
                        runningAvgCost = (totalOldValue + totalNewValue) / newTotalQty;
                    }
                }

                runningQty += quantityChange;
            }

            // 4. Update the summary record with the final calculated state
            if (stockSummary) {
                await stockSummary.update({
                    on_hand_quantity: runningQty,
                    average_cost: runningAvgCost,
                }, { transaction: t });
            } else {
                await this.ItemWarehouseStock.create({
                    itemId,
                    warehouseId,
                    on_hand_quantity: runningQty,
                    average_cost: runningAvgCost,
                }, { transaction: t });
            }

            return { success: true, message: `Recalibration for average cost item complete. ${newLedgerEntries.length} new transactions processed.` };
        });
    }

    /**
     * [PRIVATE] Placeholder for recalibrating a batch-tracked item.
     * @private
     */
    async _recalibrateBatchItem({ itemId, warehouseId }) {
        // The logic for recalibrating batch items will go here.
        // For now, we'll just return a message indicating it's not implemented.
        console.log(`Recalibration for batch item ${itemId} in warehouse ${warehouseId} needs to be implemented.`);
        return { success: false, message: 'Batch item recalibration is not yet implemented.' };
    }
}

const inv = new InventoryService

export const t_inventory_ledgerController = {
    // Contoh: Upload gambar ke database (kolom image: Buffer/BLOB)
    async uploadImage(req, res) {
        const imageFile = req.files?.find(f => f.mimetype.startsWith('image/'));
        if (!imageFile) return res.status(400).json({ error: 'No image file found' });
        try {
            const inserted = await req.models.t_inventory_ledger.create({ image: imageFile.buffer });
            res.json({ message: 'Image uploaded', data: inserted });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    // Contoh: Import Excel ke database
    async importExcel(req, res) {
        if (!req.excelData) return res.status(400).json({ error: 'No Excel data' });
        const [header, ...rows] = req.excelData;
        const records = rows.map(row => Object.fromEntries(header.map((h, i) => [h, row[i]])));
        try {
            const inserted = await req.models.t_inventory_ledger.bulkCreate(records);
            res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    // Contoh: Custom function
    async customFunction(req, res) {
        const __dirname = fileURLToPath(new URL('.', import.meta.url));
        const filePath = join(__dirname, '../controllers/wireframeController.min.js'); // Path to your file
        //  res.json({ message: 'Custom function untuk t_inventory_ledger', body: req.body, query: req.query, filePath });
        res.download(filePath, (err) => {
            if (err) {
                if (!res.headersSent) {
                    res.status(404).send('Error: File not found.');
                }
            }
        });

        // const filePath = './server/routes/'; // Or use an absolute path
        // try {
        //     const files = await readdir(filePath);
        //     res.json({
        //         message: 'Custom function untuk t_inventory_ledger', body: req.body, query: req.query,
        //         files,
        //         env: {
        //             NAME: process.env.DB_NAME,
        //             USER: process.env.DB_USER,
        //             PASSWORD: process.env.DB_PASSWORD,
        //             detail: {
        //                 host: process.env.DB_HOST,
        //                 port: process.env.DB_PORT,
        //             }
        //         }
        //     });
        // } catch (err) {
        //     res.json({ message: 'Custom function untuk t_inventory_ledger', body: req.body, query: req.query, err });
        // }

    },

    async insertDummyStock(req, res) {
        try {
            // 2. Call the master function to record the stock out
            // const result = await t_inventory_ledger.create({
            //     item_id: "f9acbeed-3f74-46cf-a77e-68bbaa641b60",
            //     warehouse_id: "e117d860-8a78-4fa0-afc0-33c2ddb69187",
            //     quantity: 5,
            //     inventory_type_id: "8284f86a-6d75-4e01-86a1-4bcfbf51f635",
            //     cost: 100000,
            // });
            const result = await inv.insertStock({
                item_id: "f9acbeed-3f74-46cf-a77e-68bbaa641b60",
                warehouse_id: "e117d860-8a78-4fa0-afc0-33c2ddb69187",
                quantity: 5,
                inventory_type_id: "8284f86a-6d75-4e01-86a1-4bcfbf51f635",
                unitCost: 100000,
            });
            res.json({
                result
            });
        } catch (error) {
            res.json({ message: 'Custom function untuk t_inventory_ledger', body: req.body, query: req.query, error: error.message });
        }
    },

    async getTransactionTypeIdByName(req, res) {
        const getTransactionTypeIdByName = async (name) => {
            // const transactionType = await m_inventory_type.findOne({
            //     where: { name },
            //     attributes: ['id'], // Only select the 'id' for efficiency
            //     raw: true, // Returns a plain object instead of a model instance
            // });

            // if (!transactionType) {
            //     throw new Error(`Transaction type with name "${name}" not found.`);
            // }

            // return transactionType.id;
        }

        res.json({ message: 'Custom function untuk t_inventory_ledger', body: req.body, query: req.query, response: await getTransactionTypeIdByName("PURCHASE_RECEIPT") });
    },

    async test(req, res) {
        const getTransactionTypeIdByName = async (name) => {
            const transactionType = await m_inventory_type.findOne({
                where: { name },
                attributes: ['id'], // Only select the 'id' for efficiency
                raw: true, // Returns a plain object instead of a model instance
            });

            if (!transactionType) {
                throw new Error(`Transaction type with name "${name}" not found.`);
            }

            return transactionType.id;
        }

        res.json({ message: 'Custom function untuk t_inventory_ledger', body: req.body, query: req.query, response: await getTransactionTypeIdByName("PURCHASE_RECEIPT") });
    },
};
