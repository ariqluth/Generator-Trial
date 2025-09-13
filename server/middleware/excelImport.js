import ExcelJS from 'exceljs';

// Middleware untuk parsing file Excel (xlsx/xls) dari upload
export default async function excelImport(req, res, next) {
    // Cek apakah ada file upload (dari req.files)
    if (!req.files || req.files.length === 0) {
        return next(); // Tidak ada file, lanjut
    }

    // Cari file Excel (berdasarkan mimetype atau ekstensi)
    const excelFile = req.files.find(
        f => f.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            f.mimetype === 'application/vnd.ms-excel' ||
            f.originalname.match(/\.(xlsx|xls)$/i)
    );
    if (!excelFile) return next(); // Tidak ada file Excel, lanjut

    try {
        const workbook = new ExcelJS.Workbook();
        // Jika pakai uploadMemory (buffer)
        if (excelFile.buffer) {
            await workbook.xlsx.load(excelFile.buffer);
        } else if (excelFile.path) { // Jika pakai upload (disk)
            await workbook.xlsx.readFile(excelFile.path);
        }
        // Ambil data dari sheet pertama
        const worksheet = workbook.worksheets[0];
        const rows = [];
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            rows.push(row.values);
        });
        req.excelData = rows;
    } catch (err) {
        return res.status(400).json({ error: 'Gagal parsing file Excel', detail: err.message });
    }
    next();
}
