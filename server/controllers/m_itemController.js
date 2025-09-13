// Controller for m_item
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.m_item
//
// Tambahkan custom function di bawah ini

import m_item from '../models/m_item.js';
import m_gen from '../models/m_gen.js';

import m_pricelist from '../models/m_pricelist.js';
import { Op } from 'sequelize';

export const m_itemController = {
    // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
    async patchFileById(req, res) {
        try {
            const file = req.files[0]

            const data = {}
            data[file.fieldname] = removeLocalPath(file.path)

            await req.models.m_item.update(data, { where: { id: req.body.id } });
            res.status(200).json({ status: 'success' })
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async uploadImage(req, res) {
        const imageFile = req.files?.find(f => f.mimetype.startsWith('image/'));
        if (!imageFile) return res.status(400).json({ error: 'No image file found' });
        try {
            const inserted = await req.models.m_item.create({ image: imageFile.buffer });
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
            const inserted = await req.models.m_item.bulkCreate(records);
            res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async generateCode(req, res) {
        const params = req.query;
        let prefix = '';
        if (params.item_division_id) {
            const itemDivision = await m_gen.findOne({
                attributes: ['code'],
                where: {
                    id: params.item_division_id,
                    group: 'm_item_division'
                }
            })
            prefix += itemDivision.code ? itemDivision.code.substring(0, 2) : '00'
        }
        if (params.item_kind_id) {
            const itemKind = await m_gen.findOne({
                attributes: ['code'],
                where: {
                    id: params.item_kind_id,
                    group: 'm_item_kind'
                }
            })
            prefix += itemKind.code ? itemKind.code.substring(0, 2) : '00'
        }
        if (params.item_group_id) {
            const itemGroup = await m_gen.findOne({
                attributes: ['code'],
                where: {
                    id: params.item_group_id,
                    group: 'm_item_group'
                }
            })
            prefix += itemGroup.code ? itemGroup.code.substring(0, 2) : '00'
        }
        const code = await getCodeStructure(m_item, params.menu_id, params.unit_bussiness_id, prefix)
        if (code.status === 'err') {
            res.json(errorResponse(code.error))
        }
        res.json(successResponse(code.data))
    },

    // custom function for get item with price
    async getItemWithPrice(req, res) {
        const {
            group_id,
            item_type_id,
            item_kind_id,
            item_division_id,
            item_group_id,
            unit_bussiness_id,
            filter_column_code,
            filter_column_name,
            filter_column_alias,
            filter_column_uom_name
        } = req.query;

        const itemWhere = {};
        if (group_id) itemWhere.group_id = group_id;
        if (item_type_id) itemWhere.item_type_id = item_type_id;
        if (item_kind_id) itemWhere.item_kind_id = item_kind_id;
        if (item_division_id) itemWhere.item_division_id = item_division_id;
        if (item_group_id) itemWhere.item_group_id = item_group_id;

        // Filter dinamis berdasarkan field tertentu
        const searchConditions = [];

        if (filter_column_code) {
            searchConditions.push({ code: { [Op.iLike]: `%${filter_column_code}%` } });
        }

        if (filter_column_name) {
            searchConditions.push({ name: { [Op.iLike]: `%${filter_column_name}%` } });
        }

        if (filter_column_alias) {
            searchConditions.push({ alias: { [Op.iLike]: `%${filter_column_alias}%` } });
        }

        if (filter_column_uom_name) {
            searchConditions.push({ alias: { [Op.iLike]: `%${filter_column_uom_name}%` } });
        }

        if (searchConditions.length > 0) {
            itemWhere[Op.and] = [...(itemWhere[Op.and] || []), { [Op.and]: searchConditions }];
        }

        // Step 1: Ambil item
        const items = await m_item.findAll({
            where: itemWhere,
            attributes: ['id', 'code', 'name', 'alias', 'item_uom_id'],
            order: [['name', 'ASC']]
        });

        const itemIds = items.map(i => i.id);
        const uomIds = [...new Set(items.map(i => i.item_uom_id).filter(Boolean))];

        if (itemIds.length === 0) return res.json(successResponse([]));

        // Step 2: Ambil semua pricelist
        const pricelists = await m_pricelist.findAll({
            where: {
                item_id: { [Op.in]: itemIds }
            },
            attributes: ['id', 'item_id', 'unit_bussiness_id', 'price']
        });

        // Step 3: Ambil data UOM dari m_gen
        const uoms = await m_gen.findAll({
            where: {
                group: 'm_item_uom',
                id: { [Op.in]: uomIds }
            },
            attributes: ['id', 'value1']
        });

        // Mapping UOM
        const uomMap = {};
            uoms.forEach(u => {
            uomMap[u.id] = u.value1;
        });

        // Mapping pricelist
        const pricelistMap = {};
        for (const pl of pricelists) {
            const key = pl.item_id;
            if (!pricelistMap[key]) pricelistMap[key] = [];
            pricelistMap[key].push({
                id: pl.id,
                item_id: pl.item_id,
                unit_bussiness_id: pl.unit_bussiness_id,
                price: pl.price
            });
        }

        // Bangun response akhir
        const result = items.map(item => {
            const plist = pricelistMap[item.id] || [];

            let selectedPrice = null;
            if (unit_bussiness_id && unit_bussiness_id !== 'all') {
                const specific = plist.find(p => p.unit_bussiness_id === unit_bussiness_id);
                if (specific) {
                    selectedPrice = specific;
                } else {
                    const general = plist.find(p => p.unit_bussiness_id === null);
                    if (general) selectedPrice = general;
                }
            } else {
                const general = plist.find(p => p.unit_bussiness_id === null);
                if (general) selectedPrice = general;
            }

            return {
                id: item.id,
                code: item.code,
                name: item.name,
                alias: item.alias,
                item_uom_id: item.item_uom_id,
                uom_name: uomMap[item.item_uom_id] || null,
                price: selectedPrice
                ? {
                    price_id: selectedPrice.id,
                    item_id: selectedPrice.item_id,
                    unit_bussiness_id: selectedPrice.unit_bussiness_id,
                    price: selectedPrice.price
                    }
                : null
            };
        });

        res.json(successResponse(result));
    },

    // Untuk SQ
    async getItemsWithStockOnHand(req, res) {
        const { unit_bussiness_id } = req.query;
        if (!unit_bussiness_id) {
            res.status(500).json({ error: "Company ID is required" });
        }

        try {
            const items = await req.models.m_item.findAll({
                include: [
                    {
                        model: req.models.m_gen,
                        as: 'itemType'
                    },
                    {
                        model: req.models.m_gen,
                        as: 'itemDivision'
                    },
                    {
                        model: req.models.m_gen,
                        as: 'itemKind'
                    },
                    {
                        model: req.models.m_gen,
                        as: 'itemGroup'
                    },
                    {
                        model: req.models.m_gen,
                        as: 'itemGenGroup'
                    },
                    {
                        model: req.models.m_gen,
                        as: 'itemUom'
                    },
                    {
                        model: req.models.m_item_conversion,
                        as: 'itemConversionDetails',
                        include: [
                            {
                                model: req.models.m_gen,
                                as: 'itemConversionUom',
                                attributes: ['id', 'group', 'value1']
                            }
                        ]
                    }
                ]
            });

            if (!items) {
                throw new Error("Tidak ada data item");
            }

            const warehouse = await req.models.m_warehouse.findOne({
                where: { unit_bussiness_id: unit_bussiness_id }
            });
            if (!warehouse) {
                throw new Error('Gudang tidak ditemukan');
            }

            const itemsWithStock = [];

            for (const item of items) {
                const stockResult = await inventoryService.getCurrentStock(item.id, warehouse.id);
                const plainItem = item.toJSON();
                plainItem.stock_on_hand = stockResult ?? 0;

                itemsWithStock.push(plainItem);
            }

            res.json(successResponse(itemsWithStock));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async getStockOnHand(req, res) {
        const { item_id, unit_bussiness_id } = req.query;

        if (!item_id || !unit_bussiness_id) {
            return res.status(400).json({ error: 'Missing required fields.' });
        }

        try {
            const warehouse = await req.models.m_warehouse.findOne({
                where: { unit_bussiness_id: unit_bussiness_id }
            });
            if (!warehouse) {
                throw new Error('Gudang tidak ditemukan');
            }

            const stockResult = await inventoryService.getCurrentStock(item_id, warehouse.id);
            if (!stockResult) {
                throw new Error(stockResult.error || 'Gagal mendapatkan data stock on hand item');
            }
            res.json(successResponse(stockResult));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async getItemConversionOptions(req, res) {
        const { item_ids } = req.query;
        const { m_item, m_item_conversion, m_gen } = req.models;

        let whereConditions = {
            status: true,
        };

        if (item_ids) {
            whereConditions.id = {
                [Op.in]: item_ids.split(',')
            };
        }
        
        const items = await m_item.findAll({
            where: whereConditions,
            include: [
                {
                    model: m_item_conversion,
                    as: 'itemConversionDetails',
                    include: [
                        {
                            model: m_gen,
                            as: 'itemConversionUom',
                            required: true,
                            attributes: ['id', 'value1']
                        }
                    ]
                }
            ]
        });

        const mappedData = {};
        items.forEach(item => {
            mappedData[item.id] = item.itemConversionDetails.map(conv => ({
                label: conv.itemConversionUom?.value1 || '',
                value: conv.itemConversionUom?.id || ''
            }));
        });

        return res.json(successResponse(mappedData));
    }

};
