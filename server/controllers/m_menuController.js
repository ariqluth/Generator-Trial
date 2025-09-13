// Controller for m_menu
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.m_menu
//
// Tambahkan custom function di bawah ini
import { Op } from "sequelize";

export const m_menuController = {
    // Contoh: Upload gambar ke database (kolom image: Buffer/BLOB)
    async uploadImage(req, res) {
        const imageFile = req.files?.find(f => f.mimetype.startsWith('image/'));
        if (!imageFile) return res.status(400).json({ error: 'No image file found' });
        try {
            const inserted = await req.models.m_menu.create({ image: imageFile.buffer });
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
            const inserted = await req.models.m_menu.bulkCreate(records);
            res.json({ message: 'Excel imported', data: inserted });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    // Get Access menu for user
    async accessUser(req, res) {
        const { user_id, responsibility_id } = req.query;

        const {
            user_detail,
            m_responsibility,
            m_responsibility_d,
            m_role,
            m_role_d,
            m_menu,
            m_gen,
            m_unit_bussiness,
            m_approval,
            m_approval_d,
        } = req.models;

        if (!user_id) {
            return res.status(400).json({ message: "Missing user_id" });
        }

        // Step 0: get master module urutan
        const mModules = await m_gen.findAll({
            attributes: [['value1', 'module'], ['value2', 'seq'], ['value3', 'icon']],
            where: { group: 'm_module' },
            order: [['value2', 'ASC']],
        });

        const modules = {};
        for (const mod of mModules) {
            const module = mod.get('module');
            const seq = parseInt(mod.get('seq')) || 0;
            const icon = mod.get('icon');
            modules[module] = { seq, icon: icon && icon.trim() !== '' ? icon : null };
        }

        // Step 1: ambil responsibility user
        const responsibility = await user_detail.findOne({
            where: {
                f_user_default: user_id,
                ...(responsibility_id ? {} : { is_primary: true }),
            },
            include: {
                model: m_responsibility,
                as: "m_responsibility",
                where: responsibility_id ? { id: responsibility_id } : undefined,
                required: true,
                include: [
                    {
                        model: m_unit_bussiness,
                    }
                ]
            },
        });

        if (!responsibility) {
            return res.status(404).json({ message: "Responsibility not found" });
        }


        // Step 2: ambil semua role dari responsibility tsb
        const roles = await m_responsibility_d.findAll({
            where: { f_responsibility: responsibility.f_responsibility },
            include: [
                {
                    model: m_role,
                    include: [
                        {
                            model: m_role_d,
                            include: [
                                {
                                    model: m_menu,
                                    where: {
                                        status: true
                                    }
                                }
                            ],
                        },
                    ],
                },
            ],
        });


        const resUnitBusinessId = responsibility.m_responsibility.f_comp;

        // Ambil semua approval yang relevan
        const approvalMenus = await m_approval.findAll({
            where: {
                status: true,
                ...(resUnitBusinessId ? { unit_bussiness_id: resUnitBusinessId } : {}),
            },
            include: [
                {
                    model: m_menu,
                    required: true,
                    where: { sub_modul: 'Transaction' },
                },
            ],
        });

        // Ambil semua m_approval_id dari hasil di atas
        const approvalIds = approvalMenus.map(a => a.id);
        const menuIdByApprovalId = Object.fromEntries(
            approvalMenus.map(a => [a.id, a.menu_id])
        );
        const menuIdsWithApproval = new Set(approvalMenus.map(a => a.menu_id));

        // Ambil semua entry user sekarang (jika ada)
        const userApprovals = await m_approval_d.findAll({
            where: {
                user_id,
                approval_id: { [Op.in]: approvalIds },
                status: true,
            },
            include: [
                {
                    model: m_approval,
                    required: true, // hanya ambil jika ada relasi
                },
            ],
        });

        // Ambil semua user lain yang mengajukan untuk approval yang sama
        const otherSubmitters = await m_approval_d.findAll({
            where: {
                user_id: { [Op.ne]: user_id },
                approval_id: { [Op.in]: approvalIds },
                type: "mengajukan",
                status: true,
            },
            include: [
                {
                    model: m_approval,
                    required: true, // hanya ambil jika ada relasi
                },
            ],
        });


        const approvalAccess = {};

        // Isi akses dari data user sendiri
        for (const entry of userApprovals) {
            const menuId = menuIdByApprovalId[entry.approval_id];
            if (!approvalAccess[menuId]) {
                approvalAccess[menuId] = { can_submit: false, can_approve: false };
            }
            if (entry.type === "mengajukan") approvalAccess[menuId].can_submit = true;
            if (entry.type === "menyetujui") approvalAccess[menuId].can_approve = true;
        }

        // Kalau user tidak punya akses submit, cek apakah tidak ada submitter lain
        const submitterMap = new Set(otherSubmitters.map(d => d.approval_id));

        for (const approval of userApprovals) {
            const menuId = approval.m_approval.menu_id;
            const approvalId = approval.approval_id;

            if (!approvalAccess[menuId]) {
                approvalAccess[menuId] = { can_submit: false, can_approve: false };
            }

            const alreadySet = approvalAccess[menuId].can_submit;
            const hasOtherSubmitter = submitterMap.has(approvalId);

            // Jika user belum bisa submit dan tidak ada user lain yang mengajukan
            if (!alreadySet && !hasOtherSubmitter) {
                approvalAccess[menuId].can_submit = true;
            }
        }

        // for (const approval of approvalMenus) {
        //     const menuId = approval.menu_id;
        //     const approvalId = approval.id;

        //     if (!approvalAccess[menuId]) {
        //         approvalAccess[menuId] = { can_submit: false, can_approve: false };
        //     }

        //     const alreadySet = approvalAccess[menuId].can_submit;
        //     const hasOtherSubmitter = submitterMap.has(approvalId);

        //     // Jika user belum bisa submit dan tidak ada user lain yang mengajukan
        //     if (!alreadySet && !hasOtherSubmitter) {
        //         approvalAccess[menuId].can_submit = true;
        //     }
        // }

        // Cek jika punya akses mengajukan atau menyetujui - END

        // Step 3: bangun rawMenus
        const rawMenus = [];
        for (const role of roles) {
            for (const rd of role.m_role.m_role_ds || []) {
                if (rd.m_menu) {
                    let seq = parseInt(rd.m_menu.seq) || 999;
                    if (rd.m_menu.modul && modules[rd.m_menu.modul]) {
                        seq = parseInt(`${modules[rd.m_menu.modul].seq}${seq.toString().padStart(2, '0')}`) || 999;
                    }

                    rawMenus.push({
                        id: rd.m_menu.id,
                        modul: rd.m_menu.modul,
                        sub_modul: rd.m_menu.sub_modul,
                        label: rd.m_menu.name,
                        icon: rd.m_menu.icon,
                        path: rd.m_menu.path,
                        seq: seq,
                        access: {
                            read: rd.read,
                            create: rd.create,
                            show: rd.show,
                            update: rd.update,
                            delete: rd.delete,
                            print: rd.print,
                            has_approval: menuIdsWithApproval.has(rd.m_menu.id),
                            can_submit: approvalAccess[rd.m_menu.id]?.can_submit || false,
                            can_approve: approvalAccess[rd.m_menu.id]?.can_approve || false,
                        },
                    });
                }
            }
        }

        // Step 4: Grouping
        const rootMenus = [];
        const groupedByModul = {};

        for (const menu of rawMenus) {
            const hasModul = !!menu.modul;
            const hasSubModul = !!menu.sub_modul;

            if (!hasModul && !hasSubModul) {
                rootMenus.push({
                    id: menu.id,
                    label: menu.label,
                    icon: menu.icon || "file",
                    isOpen: false,
                    path: menu.path,
                    seq: menu.seq,
                    access: menu.access,
                });
                continue;
            }

            // Init modul
            if (!groupedByModul[menu.modul]) {
                groupedByModul[menu.modul] = {
                    label: menu.modul,
                    icon: modules[menu.modul].icon || "folder",
                    seq: modules[menu.modul].seq || 999,
                    isOpen: false,
                    childrenRaw: [],
                    subModules: {},
                };
            }

            // No sub_modul → langsung dimasukkan ke childrenRaw
            if (!hasSubModul) {
                groupedByModul[menu.modul].childrenRaw.push({
                    id: menu.id,
                    label: menu.label,
                    icon: menu.icon || "file",
                    isOpen: false,
                    path: menu.path,
                    seq: menu.seq,
                    access: menu.access,
                });
            } else {
                const subLabel = menu.sub_modul;
                if (!groupedByModul[menu.modul].subModules[subLabel]) {
                    groupedByModul[menu.modul].subModules[subLabel] = {
                        label: subLabel,
                        icon: "book",
                        isOpen: false,
                        children: [],
                    };
                }

                groupedByModul[menu.modul].subModules[subLabel].children.push({
                    id: menu.id,
                    label: menu.label,
                    icon: menu.icon || "file",
                    isOpen: false,
                    path: menu.path,
                    seq: menu.seq,
                    access: menu.access,
                });
            }
        }

        // Step 5: konversi object ke array dan gabungkan
        const finalMenu = [];

        // root menus
        finalMenu.push(...rootMenus.sort((a, b) => a.seq - b.seq));

        const subModuleOrder = ['master', 'transaction', 'report'];

        for (const [modulName, modulItem] of Object.entries(groupedByModul)) {
            // urutkan menu langsung
            const childrenRawSorted = modulItem.childrenRaw.sort((a, b) => a.seq - b.seq);

            // urutkan submodul dan isinya
            const subModulArray = Object.values(modulItem.subModules).map((subItem) => ({
                ...subItem,
                children: subItem.children.sort((a, b) => a.seq - b.seq),
            }));

            // subModulArray.sort((a, b) => a.label.localeCompare(b.label));

            subModulArray.sort((a, b) => {
                const indexA = subModuleOrder.indexOf(a.label.toLowerCase());
                const indexB = subModuleOrder.indexOf(b.label.toLowerCase());
                return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
            });

            finalMenu.push({
                label: modulItem.label,
                icon: modulItem.icon,
                seq: modulItem.seq,
                isOpen: false,
                children: [...childrenRawSorted, ...subModulArray],
            });
        }

        // urutkan berdasarkan seq modul
        finalMenu.sort((a, b) => a.seq - b.seq);

        return res.json({
            message: 'Menu successfully obtained',
            data: {
                responsibility: {
                    id: responsibility.m_responsibility.id,
                    name: responsibility.m_responsibility.name,
                    unit_bussiness_id: responsibility.m_responsibility.m_unit_bussiness?.id || null,
                    unit_bussiness_name: responsibility.m_responsibility.m_unit_bussiness?.name || 'All Company',

                },
                menu: finalMenu,
            }
        });
    }


};
