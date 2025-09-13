// Controller for tes
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.tes
//
// Tambahkan custom function di bawah ini

export const tesController = {
  // Contoh: Upload gambar ke database (kolom image: Buffer/BLOB)
  async uploadImage(req, res) {
    const fileFields = Object.keys(req.models.tes.rawAttributes).filter(
      key => req.models.tes.rawAttributes[key].type && req.models.tes.rawAttributes[key].type.key === 'STRING'
    );
    let data = req.body;
    console.log('req.files:', req.files);
    if (fileFields.length > 0 && req.files && req.files.length > 0) {
      for (const field of fileFields) {
        const fileObj = req.files.find(f => f.fieldname === field);
        if (fileObj && fileObj.path) {
          const relativePath = fileObj.path.replace(/\\/g, '/').replace(/^.*uploads\//, 'uploads/');
          data[field] = relativePath;
        }
      }
    }
    try {
      const inserted = await req.models.tes.create(data);
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
      const inserted = await req.models.tes.bulkCreate(records);
      res.json({ message: 'Excel imported', data: inserted });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Contoh: Custom function
  async customFunction(req, res) {
    res.json({ message: 'Custom functiasdsaon untuk tes', body: req.body, query: req.query });
  }
};
