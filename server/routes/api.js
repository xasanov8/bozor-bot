const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { upload } = require('../middleware/upload');

const router = express.Router();

function parseInitData(initData) {
  if (!initData || typeof initData !== 'string') return null;
  try {
    const params = new URLSearchParams(initData);
    const userRaw = params.get('user');
    if (!userRaw) return null;
    return JSON.parse(userRaw);
  } catch {
    return null;
  }
}

function verifyTelegramWebApp(initData, botToken) {
  if (!initData || !botToken) return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');

    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const calculated = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (calculated !== hash) return null;

    const userRaw = params.get('user');
    return userRaw ? JSON.parse(userRaw) : null;
  } catch {
    return null;
  }
}

function getTelegramUser(req) {
  const initData = req.headers['x-telegram-init-data'] || req.body?.initData || '';
  const botToken = process.env.BOT_TOKEN;
  if (botToken && initData) {
    const verified = verifyTelegramWebApp(initData, botToken);
    if (verified) return verified;
  }
  // Dev fallback: allow soft parse without strict verify when token missing/dev
  if (process.env.NODE_ENV !== 'production') {
    return parseInitData(initData) || (req.headers['x-dev-user']
      ? { id: req.headers['x-dev-user'], first_name: 'Dev' }
      : null);
  }
  return parseInitData(initData);
}

function requireUser(req, res, next) {
  const user = getTelegramUser(req);
  if (!user || !user.id) {
    return res.status(401).json({ error: 'Telegram foydalanuvchisi aniqlanmadi. Bot orqali oching.' });
  }
  req.tgUser = user;
  db.upsertUser({
    telegramId: user.id,
    username: user.username,
    firstName: user.first_name,
    lastName: user.last_name,
  });
  next();
}

// ——— Public ———

router.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'bozor-bot' });
});

router.get('/markets', (_req, res) => {
  res.json({ markets: db.getMarkets() });
});

router.get('/markets/:id', (req, res) => {
  const market = db.getMarketById(Number(req.params.id));
  if (!market) return res.status(404).json({ error: 'Bozor topilmadi' });
  const shops = db.getShopsByMarket(market.id);
  res.json({ market, shops });
});

router.get('/markets/:id/search', (req, res) => {
  const market = db.getMarketById(Number(req.params.id));
  if (!market) return res.status(404).json({ error: 'Bozor topilmadi' });
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ query: q, results: [] });
  const results = db.searchInMarket(market.id, q);
  res.json({ query: q, market, results });
});

router.get('/shops/:id', (req, res) => {
  const shop = db.getShopById(Number(req.params.id));
  if (!shop) return res.status(404).json({ error: "Do'kon topilmadi" });
  const products = db.getProductsByShop(shop.id);
  res.json({ shop, products });
});

router.get('/products/:id', (req, res) => {
  const product = db.getProductById(Number(req.params.id));
  if (!product) return res.status(404).json({ error: 'Mahsulot topilmadi' });
  res.json({ product });
});

// ——— Owner (auth) ———

router.get('/me', requireUser, (req, res) => {
  const shops = db.getShopsByOwner(req.tgUser.id);
  res.json({
    user: {
      id: req.tgUser.id,
      username: req.tgUser.username,
      first_name: req.tgUser.first_name,
    },
    shops,
  });
});

router.post('/shops', requireUser, upload.single('image'), (req, res) => {
  try {
    const { marketId, name, phone, address, description } = req.body;
    if (!marketId || !name || !phone || !address) {
      return res.status(400).json({
        error: "Bozor, do'kon nomi, telefon va manzil majburiy",
      });
    }
    const market = db.getMarketById(Number(marketId));
    if (!market) return res.status(404).json({ error: 'Bozor topilmadi' });

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const shop = db.createShop({
      marketId: Number(marketId),
      ownerTelegramId: req.tgUser.id,
      name: String(name).trim(),
      phone: String(phone).trim(),
      address: String(address).trim(),
      description: description ? String(description).trim() : null,
      imageUrl,
    });
    res.status(201).json({ shop });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Xatolik' });
  }
});

router.patch('/shops/:id', requireUser, upload.single('image'), (req, res) => {
  try {
    const data = {
      name: req.body.name,
      phone: req.body.phone,
      address: req.body.address,
      description: req.body.description,
      imageUrl: req.file ? `/uploads/${req.file.filename}` : undefined,
    };
    const shop = db.updateShop(Number(req.params.id), req.tgUser.id, data);
    if (!shop) return res.status(404).json({ error: "Do'kon topilmadi yoki ruxsat yo'q" });
    res.json({ shop });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Xatolik' });
  }
});

router.post('/products', requireUser, upload.single('image'), (req, res) => {
  try {
    const { shopId, name, description, price, unit } = req.body;
    if (!shopId || !name || price === undefined || price === '') {
      return res.status(400).json({ error: "Do'kon, nom va narx majburiy" });
    }
    const shop = db.getShopById(Number(shopId));
    if (!shop || String(shop.owner_telegram_id) !== String(req.tgUser.id)) {
      return res.status(403).json({ error: "Bu do'konga mahsulot qo'sha olmaysiz" });
    }
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const product = db.createProduct({
      shopId: Number(shopId),
      name: String(name).trim(),
      description: description ? String(description).trim() : null,
      price: Number(price),
      unit: unit || 'dona',
      imageUrl,
    });
    res.status(201).json({ product });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Xatolik' });
  }
});

router.patch('/products/:id', requireUser, upload.single('image'), (req, res) => {
  try {
    const data = {
      name: req.body.name,
      description: req.body.description,
      price: req.body.price !== undefined && req.body.price !== '' ? Number(req.body.price) : undefined,
      unit: req.body.unit,
      imageUrl: req.file ? `/uploads/${req.file.filename}` : undefined,
      isAvailable: req.body.isAvailable !== undefined ? Number(req.body.isAvailable) : undefined,
    };
    const product = db.updateProduct(Number(req.params.id), req.tgUser.id, data);
    if (!product) return res.status(404).json({ error: "Mahsulot topilmadi yoki ruxsat yo'q" });
    res.json({ product });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Xatolik' });
  }
});

router.delete('/products/:id', requireUser, (req, res) => {
  const ok = db.deleteProduct(Number(req.params.id), req.tgUser.id);
  if (!ok) return res.status(404).json({ error: "Mahsulot topilmadi yoki ruxsat yo'q" });
  res.json({ ok: true });
});

// Error handler for multer
router.use((err, _req, res, _next) => {
  if (err instanceof Error) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Server xatosi' });
});

module.exports = router;
