require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const api = require('./routes/api');
const admin = require('./routes/admin');
const { createBot } = require('./bot');
const { isLocalhost } = require('./auth');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const WEBAPP_URL = process.env.WEBAPP_URL || `http://localhost:${PORT}`;
const BOT_TOKEN = process.env.BOT_TOKEN || '';

const app = express();
app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  next();
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use('/api/admin', admin);
app.use('/api', api);

// Superadmin panel — faqat localhost
app.use('/admin', (req, res, next) => {
  if (!isLocalhost(req)) {
    return res.status(403).send('Superadmin faqat localhost orqali ochiladi.');
  }
  next();
}, express.static(path.join(__dirname, '..', 'webapp', 'admin'), {
  etag: false,
  setHeaders(res) {
    res.setHeader('Cache-Control', 'no-store');
  },
}));

app.use(
  express.static(path.join(__dirname, '..', 'webapp'), {
    etag: false,
    lastModified: false,
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
      }
    },
  })
);

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/admin')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '..', 'webapp', 'index.html'));
});

const server = app.listen(PORT, HOST, () => {
  console.log(`[server] http://localhost:${PORT}`);
  console.log(`[server] Superadmin: http://localhost:${PORT}/admin`);
  console.log(`[server] Superadmin parol: ${process.env.SUPERADMIN_PASSWORD || 'bozorAdmin2026'}`);
  console.log(`[server] WebApp URL: ${WEBAPP_URL}`);
});

const bot = createBot(BOT_TOKEN, WEBAPP_URL);
if (bot) {
  bot.launch({ dropPendingUpdates: true }).catch((err) => {
    console.error('[bot] ishga tushmadi:', err.message);
  });
  console.log('[bot] Telegram bot polling boshlandi');

  setTimeout(() => {
    if (typeof bot.setupMenuButton === 'function') {
      bot.setupMenuButton().catch((e) => console.error('[bot] menu:', e.message));
    }
  }, 1500);

  process.once('SIGINT', () => {
    bot.stop('SIGINT');
    server.close();
  });
  process.once('SIGTERM', () => {
    bot.stop('SIGTERM');
    server.close();
  });
}
