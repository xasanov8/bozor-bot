require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const api = require('./routes/api');
const { createBot } = require('./bot');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const WEBAPP_URL = process.env.WEBAPP_URL || `http://localhost:${PORT}`;
const BOT_TOKEN = process.env.BOT_TOKEN || '';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use('/api', api);
app.use(express.static(path.join(__dirname, '..', 'webapp')));

// SPA fallback
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
  res.sendFile(path.join(__dirname, '..', 'webapp', 'index.html'));
});

const server = app.listen(PORT, HOST, () => {
  console.log(`[server] http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`[server] WebApp URL: ${WEBAPP_URL}`);
});

const bot = createBot(BOT_TOKEN, WEBAPP_URL);
if (bot) {
  bot.launch({ dropPendingUpdates: true })
    .then(() => console.log('[bot] Telegram bot ishga tushdi'))
    .catch((err) => console.error('[bot] ishga tushmadi:', err.message));

  process.once('SIGINT', () => {
    bot.stop('SIGINT');
    server.close();
  });
  process.once('SIGTERM', () => {
    bot.stop('SIGTERM');
    server.close();
  });
}
