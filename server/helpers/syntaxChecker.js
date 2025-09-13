import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Cek sintaks & runtime error JS/ESM
 * @param {string} code - kode JS yang akan dicek
 * @param {string} [originalFilePath] - path file asli (untuk menentukan direktori dan nama file temp)
 * @returns {{valid: boolean, error?: string}}
 */
export function checkJsSyntax(code, originalFilePath) {
    // Validasi awal untuk statement import
    console.log('Checking JavaScript syntax...' + originalFilePath);
    const importRegex = /import\s+(?:[\w*{},\s]+\s+from\s+)?["']([^"']+)["']/g;
    let match;
    while ((match = importRegex.exec(code)) !== null) {
        const importPath = match[1];
        // Hanya cek import relatif (./ atau ../)
        if (importPath.startsWith('.') && originalFilePath) {
            const baseDir = path.dirname(originalFilePath);
            let resolvedPath = path.resolve(baseDir, importPath);
            // Cek ekstensi jika tidak ada
            if (!fs.existsSync(resolvedPath)) {
                if (fs.existsSync(resolvedPath + '.js')) {
                    resolvedPath += '.js';
                } else if (fs.existsSync(resolvedPath + '.mjs')) {
                    resolvedPath += '.mjs';
                } else if (fs.existsSync(resolvedPath + '/index.js')) {
                    resolvedPath = path.join(resolvedPath, 'index.js');
                } else if (fs.existsSync(resolvedPath + '/index.mjs')) {
                    resolvedPath = path.join(resolvedPath, 'index.mjs');
                } else {
                    const fileInfo = originalFilePath ? `File: ${originalFilePath}\n` : '';
                    return { valid: false, error: fileInfo + `Import path not found: ${importPath}`, message: fileInfo + `Import path not found: ${importPath}` };
                }
            }
        }
    }
    // Selalu gunakan file temporary untuk pengecekan
    let tmpFile;
    let ext;
    // Selalu gunakan .mjs agar Node.js treat sebagai ESM
    ext = '.mjs';
    // Buat file temp di folder file asli jika originalFilePath ada, agar import relatif valid
    let tmpDir;
    if (originalFilePath) {
        tmpDir = path.dirname(originalFilePath);
    } else {
        tmpDir = os.tmpdir();
    }
    tmpFile = path.join(tmpDir, `syntax-check-${Date.now()}${ext}`);
    fs.writeFileSync(tmpFile, code);
    // 1. Cek syntax
    try {
        const execOptions = { stdio: 'pipe' };
        if (originalFilePath) {
            execOptions.cwd = path.dirname(originalFilePath);
        }
        execSync(`node --check "${tmpFile}"`, execOptions);
    } catch (err) {
        let errorMsg = err.stderr ? err.stderr.toString() : err.message;
        if (originalFilePath) {
            errorMsg = errorMsg.split(tmpFile).join(originalFilePath);
            errorMsg = errorMsg.split('file:///' + tmpFile.replace(/\\/g, '/')).join(originalFilePath);
        }
        // Ambil baris error utama dan lokasi file
        const lines = errorMsg.split('\n').filter(Boolean);
        let mainError = lines.find(l => l.match(/Error:/)) || lines[0];
        let fileLine = lines.find(l => l.match(/:\d+:\d+/)) || '';
        let info = `${fileLine}\n${mainError}`.trim();
        if (originalFilePath) {
            info = `File: ${originalFilePath}\n` + info;
        }
        fs.unlinkSync(tmpFile);
        return { valid: false, error: info, message: info };
    }
    // 2. Cek runtime error
    try {
        const execOptions = { stdio: 'pipe' };
        if (originalFilePath) {
            execOptions.cwd = path.dirname(originalFilePath);
        }
        execSync(`node "${tmpFile}"`, execOptions);
    } catch (err) {
        let errorMsg = err.stderr ? err.stderr.toString() : err.message;
        if (originalFilePath) {
            errorMsg = errorMsg.split(tmpFile).join(originalFilePath);
            errorMsg = errorMsg.split('file:///' + tmpFile.replace(/\\/g, '/')).join(originalFilePath);
        }
        // Ambil baris error utama dan lokasi file
        const lines = errorMsg.split('\n').filter(Boolean);
        let mainError = lines.find(l => l.match(/Error:/)) || lines[0];
        let fileLine = lines.find(l => l.match(/:\d+:\d+/)) || '';
        let info = `${fileLine}\n${mainError}`.trim();
        if (originalFilePath) {
            info = `File: ${originalFilePath}\n` + info;
        }
        fs.unlinkSync(tmpFile);
        return { valid: false, error: info, message: info };
    }
    fs.unlinkSync(tmpFile);
    return { valid: true };
}
