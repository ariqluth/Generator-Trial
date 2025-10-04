import express from 'express';
import https from 'https';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import path from 'path';
import { sequelize } from './config/database.js';
import { errorHandler } from './middleware/errorHandler.js';
import fs from 'fs';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import routes
import apiRoutes from './routes/index.js';

// Initialize environment variables
dotenv.config();

// Create Express app
const app = express();

// Konfigurasi HTTPS dari environment variable
const SSL_KEY_PATH = process.env.SSL_KEY_PATH;
const SSL_CERT_PATH = process.env.SSL_CERT_PATH;
let server;
if (SSL_KEY_PATH && SSL_CERT_PATH && fs.existsSync(SSL_KEY_PATH) && fs.existsSync(SSL_CERT_PATH)) {
  const options = {
    key: fs.readFileSync(SSL_KEY_PATH),
    cert: fs.readFileSync(SSL_CERT_PATH)
  };
  server = https.createServer(options, app);
  console.log('HTTPS enabled');
} else {
  server = createServer(app);
  console.log('HTTPS certificate not found or env not set, using HTTP');
}
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 3000;

// Set up EJS view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));

// Static files
app.use('/uploads', express.static('uploads'));

// Landing page route
app.get('/', (req, res) => {
  res.render('projects');
});

app.get('/projects', (req, res) => {
  res.render('projects');
});

app.get('/wireframe', (req, res) => {
  res.render('homepage');
});

// API Docs page (Postman-like UI)
app.get('/docs', (req, res) => {
  res.render('docs');
});


// API routes
app.use('/api', apiRoutes);
// Endpoint untuk migrasi satu model tertentu
app.post('/api/migrate-model/:modelName', async (req, res) => {
  const { modelName } = req.params;
  if (!global.models || !global.models[modelName]) {
    return res.status(404).json({ success: false, message: `Model '${modelName}' not found.` });
  }
  try {
    await global.models[modelName].sync({ alter: true });
    console.log(`Model ${modelName} synchronized successfully via API (alter: true).`);
    return res.json({ success: true, message: `Model '${modelName}' migrated successfully with alter: true.` });
  } catch (err) {
    console.error(`Failed to migrate model '${modelName}':`, err);
    return res.status(500).json({ success: false, message: `Failed to migrate model '${modelName}'.`, error: err.message });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected to logs:', socket.id);

  // Send initial log history when client connects
  socket.on('request-log-history', () => {
    const logPath = path.join(__dirname, 'logs', 'activity.log');
    if (fs.existsSync(logPath)) {
      fs.readFile(logPath, 'utf8', (err, data) => {
        if (!err && data) {
          const lines = data.split('\n').filter(Boolean);
          // Send last 100 lines
          const recentLines = lines.slice(-100);
          recentLines.forEach(line => {
            const match = line.match(/^\[(.*?)\] \[(.*?)\] (.*)$/);
            if (match) {
              const [_, iso, level, msg] = match;
              const d = new Date(iso);
              const formattedTime = d.toLocaleString('id-ID', {
                timeZone: 'Asia/Jakarta',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              });
              socket.emit('log-history', {
                timestamp: iso,
                level: level,
                message: msg,
                formattedTime: formattedTime
              });
            }
          });
        }
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected from logs:', socket.id);
  });
});

// Make io globally available for logging
global.io = io;

// Lightweight frontend hot-reload (dev only): watch public/ and views/ and signal clients
if (process.env.NODE_ENV !== 'production') {
  try {
    const watched = new Set();
    const debounceMap = new Map();
    const watchRecursive = (dir) => {
      if (!fs.existsSync(dir) || watched.has(dir)) return;
      watched.add(dir);
      // Watch current dir
      try {
        fs.watch(dir, { persistent: true }, (eventType, filename) => {
          if (!filename) return;
          const ext = path.extname(filename);
          // Debounce per file to avoid duplicate events
          const key = path.join(dir, filename);
          clearTimeout(debounceMap.get(key));
          const t = setTimeout(() => {
            if (global.io) {
              global.io.emit('hot-reload', { file: key, ext });
            }
          }, 120);
          debounceMap.set(key, t);
        });
      } catch (e) {
        console.warn('Hot-reload watcher error for', dir, e.message);
      }
      // Recurse into subdirs
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const ent of entries) {
          if (ent.isDirectory()) {
            watchRecursive(path.join(dir, ent.name));
          }
        }
      } catch {}
    };

    watchRecursive(path.join(__dirname, 'public'));
    watchRecursive(path.join(__dirname, 'views'));
  } catch (e) {
    console.warn('Hot-reload setup failed:', e.message);
  }
}

// Tambah endpoint untuk log activity
apiRoutes.get('/logs/activity', (req, res) => {
  const logDir = path.join(__dirname, 'logs');
  const logPath = path.join(logDir, 'activity.log');
  const { order = 'desc' } = req.query; // desc = terbaru di atas, asc = terbaru di bawah

  // Pastikan folder logs ada
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  // Jika file belum ada, buat file kosong
  if (!fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, '', 'utf8');
  }
  fs.readFile(logPath, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ success: false, message: 'Log not found' });
    // Split log per baris dan filter yang kosong
    const lines = data.split('\n').filter(Boolean);

    // Urutkan berdasarkan parameter order
    const sortedLines = order === 'asc' ? lines : lines.reverse();

    // Format tanggal
    const formatted = sortedLines.map(line => {
      // Format: [2025-06-28T14:30:01.123Z] [LEVEL] ...
      const match = line.match(/^\[(.*?)\] \[(.*?)\] (.*)$/);
      if (match) {
        const [_, iso, level, msg] = match;
        // Format tanggal ke YYYY-MM-DD HH:mm:ss
        const d = new Date(iso);
        const pad = n => n.toString().padStart(2, '0');
        const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        return `[${dateStr}] [${level}] ${msg}`;
      }
      return line;
    });
    res.json({ success: true, log: formatted.join('\n'), order });
  });
});

// Endpoint untuk reset log activity
apiRoutes.post('/logs/reset', (req, res) => {
  const logDir = path.join(__dirname, 'logs');
  const logPath = path.join(logDir, 'activity.log');
  try {
    // Kosongkan file log
    fs.writeFileSync(logPath, '', 'utf8');
    res.json({ success: true, message: 'Log has been reset.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to reset log.' });
  }
});

// Redirect console log/info/warn/error to file and terminal
const logFilePath = path.join(__dirname, 'logs', 'activity.log');
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

// Function to emit log to connected clients
function emitLogToClients(level, message) {
  if (global.io) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message: message,
      formattedTime: new Date().toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    };
    global.io.emit('log-activity', logEntry);
  }
}

['log', 'info', 'warn', 'error'].forEach(method => {
  const original = console[method];
  console[method] = function (...args) {
    const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ');
    const line = `[${new Date().toISOString()}] [${method.toUpperCase()}] ${msg}\n`;
    logStream.write(line);

    // Emit to Socket.IO clients
    emitLogToClients(method, msg);

    original.apply(console, args);
  };
});
// Morgan HTTP log to file (append)
app.use(morgan('combined', {
  stream: logStream,
  // Custom format for socket emission
  write: function (message) {
    logStream.write(message);
    // Emit HTTP requests to clients
    if (global.io) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        level: 'HTTP',
        message: message.trim(),
        formattedTime: new Date().toLocaleString('id-ID', {
          timeZone: 'Asia/Jakarta',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      };
      global.io.emit('log-activity', logEntry);
    }
  }
}));

// Tangkap error global Node.js dan log ke file
process.on('uncaughtException', (err) => {
  const msg = `[${new Date().toISOString()}] [UNCAUGHT_EXCEPTION] ${err.stack || err}\n`;
  logStream.write(msg);
  // Emit to Socket.IO clients
  emitLogToClients('UNCAUGHT_EXCEPTION', err.stack || err.message);
  console.error(err);
});
process.on('unhandledRejection', (reason, promise) => {
  const msg = `[${new Date().toISOString()}] [UNHANDLED_REJECTION] ${reason && reason.stack ? reason.stack : reason}\n`;
  logStream.write(msg);
  // Emit to Socket.IO clients
  emitLogToClients('UNHANDLED_REJECTION', reason && reason.stack ? reason.stack : reason);
  console.error(reason);
});

// Error handling middleware - should be after routes
app.use((err, req, res, next) => {
  const msg = `[${new Date().toISOString()}] [EXPRESS_ERROR] ${err.stack || err}\n`;
  logStream.write(msg);
  // Emit to Socket.IO clients
  emitLogToClients('EXPRESS_ERROR', err.stack || err.message);
  // Panggil errorHandler custom jika ada
  if (typeof errorHandler === 'function') {
    return errorHandler(err, req, res, next);
  }
  res.status(500).json({ error: 'Internal Server Error' });
});

// 404 handler - redirect to homepage for any unknown routes
app.use((req, res, next) => {
  res.redirect('/');
});

// Serve static files from the Vue app build directory in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath));

  // Handle any requests that don't match the above
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}
// Auto-register all hooks from hooks directory
async function autoRegisterAllHooks() {
  const fsPromises = await import('fs/promises');
  const hooksPath = path.join(__dirname, 'hooks');

  try {
    // Create hooks directory if not exists
    await fsPromises.mkdir(hooksPath, { recursive: true });

    const files = await fsPromises.readdir(hooksPath);
    const importPromises = files.filter(file => file.endsWith('Hooks.js')).map(file => {
      const filePath = `file://${path.join(hooksPath, file)}`;
      return import(filePath).then(module => {
        // Panggil semua fungsi yang diawali dengan 'register' dan diakhiri dengan 'Hooks'
        Object.keys(module).forEach(key => {
          if (key.startsWith('register') && key.endsWith('Hooks') && typeof module[key] === 'function') {
            module[key]();
          }
        });
      }).catch(err => console.error(`Error loading hooks from ${file}:`, err));
    });
    await Promise.all(importPromises);
    // console.log('All hooks registered successfully');
  } catch (error) {
    console.error('Error registering hooks:', error);
  }
}

// Jalankan auto-register hooks sebelum menjalankan server
(async () => {
  await autoRegisterAllHooks();
  startServer();
})();

// Database connection and server start
async function connectDatabase(retryCount = 0, maxRetries = 2) {
  try {
    await sequelize.authenticate();
    console.log('Database connection successfully.');
    if (process.env.MIGRATEALL === true) {
      await sequelize.sync({ alter: true });
      console.log('All models were synchronized successfully.');
    }

    return true;
  } catch (error) {
    console.error('Database connection error:', error);
    if (retryCount < maxRetries) {
      console.log(`Retrying database connection in 5 seconds... (${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      return connectDatabase(retryCount + 1, maxRetries);
    }
    return false;
  }
}

async function startServer() {
  // Start the Express/HTTPS server regardless of database status
  server.listen(PORT, () => {
    if (SSL_KEY_PATH && SSL_CERT_PATH && fs.existsSync(SSL_KEY_PATH) && fs.existsSync(SSL_CERT_PATH)) {
      console.log(`Server is running on HTTPS port ${PORT}...`);
    } else {
      console.log(`Server is running on HTTP port ${PORT}...`);
    }
    console.log(`Socket.IO server is ready for real-time logging`);
    // Kirim sinyal 'ready' ke PM2 agar restart lebih graceful
    if (process.send) {
      process.send('ready');
    }
  });

  // Try to connect to database
  const isConnected = await connectDatabase();
  if (!isConnected) {
    console.log('Server is running with limited functionality due to database connection issues');
  }
}

// Tambahkan global models agar semua model siap pakai di mana saja
import * as models from './models/index.js';
global.models = models;

// Import global helpers agar bisa digunakan di seluruh aplikasi tanpa import
import './helpers/helper.js';

// Import globalControllers agar semua controller otomatis tersedia di global
import './globalControllers.js';
