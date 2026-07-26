const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { upload } = require('../middleware/upload');
const {
  getOwnerSession,
  createOwnerToken,
  verifyPassword,
  normalizePhone,
} = require('../auth');

const router = express.Router();

function getAppVersion() {
  const files = [
    path.join(__dirname, '..', '..', 'webapp', 'js', 'app.js'),
    path.join(__dirname, '..', '..', 'webapp', 'css', 'style.css'),
    path.join(__dirname, '..', '..', 'webapp', 'index.html'),
    path.join(__dirname, '..', '..', 'webapp', 'admin', 'admin.js'),
    path.join(__dirname, '..', '..', 'webapp', 'admin', 'admin.css'),
    path.join(__dirname, '..', '..', 'webapp', 'admin', 'index.html'),
    path.join(__dirname, '..', 'bot.js'),
    path.join(__dirname, '..', 'index.js'),
  ];
  try {
    return files
      .map((f) => {
        try {
          return String(fs.statSync(f).mtimeMs);
        } catch {
          return '0';
        }
      })
      .join('-');
  } catch {
    return String(Date.now());
  }
}

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
  if (process.env.NODE_ENV !== 'production') {
    return parseInitData(initData) || (req.headers['x-dev-user']
      ? { id: req.headers['x-dev-user'], first_name: 'Dev' }
      : null);
  }
  return parseInitData(initData);
}

function getBearer(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return req.headers['x-owner-token'] || null;
}

/** Owner token OR telegram (linked owner / legacy shop owner) */
function requireOwner(req, res, next) {
  const token = getBearer(req);
  const session = getOwnerSession(token);
  if (session) {
    const owner = db.getOwnerById(session.ownerId);
    if (!owner || !owner.is_active) {
      return res.status(401).json({ error: 'Sessiya yaroqsiz' });
    }
    req.owner = owner;
    req.identity = { ownerId: owner.id, telegramId: owner.telegram_id };
    return next();
  }

  const user = getTelegramUser(req);
  if (user?.id) {
    db.upsertUser({
      telegramId: user.id,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
    });
    const owner = db.getOwnerByTelegramId(user.id);
    if (owner) {
      req.owner = owner;
      req.identity = { ownerId: owner.id, telegramId: String(user.id) };
      req.tgUser = user;
      return next();
    }
    // legacy: shops by telegram without owner account
    const shops = db.getShopsByOwnerTelegram(user.id);
    if (shops.length) {
      req.tgUser = user;
      req.identity = { ownerId: null, telegramId: String(user.id) };
      req.legacyOwner = true;
      return next();
    }
  }

  return res.status(401).json({
    error: "Do'kon egasi sifatida kiring (bot orqali telefon va parol).",
  });
}

// ——— Public ———

router.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'bozor-bot' });
});

/** Live update: app (kod) + data (DB) versiyalari */
router.get('/version', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    app: getAppVersion(),
    data: db.getDataRevision(),
    ts: Date.now(),
  });
});

router.get('/markets', (_req, res) => {
  res.json({ markets: db.getMarkets() });
});

router.get('/markets/:id', (req, res) => {
  const market = db.getMarketById(Number(req.params.id));
  if (!market || !market.is_active) return res.status(404).json({ error: 'Bozor topilmadi' });
  const shops = db.getShopsByMarket(market.id);
  res.json({ market, shops });
});

router.get('/markets/:id/search', (req, res) => {
  const market = db.getMarketById(Number(req.params.id));
  if (!market || !market.is_active) return res.status(404).json({ error: 'Bozor topilmadi' });
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ query: q, results: [] });
  const results = db.searchInMarket(market.id, q);
  res.json({ query: q, market, results });
});

router.get('/shops/:id', (req, res) => {
  const shop = db.getShopById(Number(req.params.id));
  if (!shop || !shop.is_active) return res.status(404).json({ error: "Do'kon topilmadi" });
  const products = db.getProductsByShop(shop.id);
  res.json({ shop, products });
});

router.get('/products/:id', (req, res) => {
  const product = db.getProductById(Number(req.params.id));
  if (!product) return res.status(404).json({ error: 'Mahsulot topilmadi' });
  res.json({ product });
});

// ——— Owner login (phone + password) — also used by bot backend logic ———

router.post('/owner/login', (req, res) => {
  try {
    const phone = normalizePhone(req.body?.phone);
    const password = req.body?.password;
    const telegramId = req.body?.telegramId ? String(req.body.telegramId) : null;

    if (!phone || !password) {
      return res.status(400).json({ error: 'Telefon va parol majburiy' });
    }

    const owner = db.getOwnerByPhone(phone);
    if (!owner || !verifyPassword(password, owner.password_hash)) {
      return res.status(401).json({ error: "Telefon yoki parol noto'g'ri" });
    }

    if (telegramId) {
      db.linkOwnerTelegram(owner.id, telegramId);
      db.upsertUser({
        telegramId,
        role: 'owner',
        firstName: owner.name,
      });
    }

    const fresh = db.getOwnerById(owner.id);
    const token = createOwnerToken(fresh);
    const shops = db.getShopsByOwnerId(fresh.id);

    res.json({
      token,
      owner: db.publicOwner(fresh),
      shops,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ——— Owner panel ———

router.get('/me', requireOwner, (req, res) => {
  let shops = [];
  if (req.owner) {
    shops = db.getShopsByOwnerId(req.owner.id);
  } else if (req.tgUser) {
    shops = db.getShopsByOwnerTelegram(req.tgUser.id);
  }

  res.json({
    user: req.owner
      ? { id: req.owner.id, name: req.owner.name, phone: req.owner.phone, role: 'owner' }
      : {
          id: req.tgUser?.id,
          first_name: req.tgUser?.first_name,
          username: req.tgUser?.username,
          role: 'owner',
        },
    shops,
  });
});

router.post('/shops', requireOwner, upload.single('image'), (req, res) => {
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
      ownerId: req.owner?.id || null,
      ownerTelegramId: req.identity.telegramId || req.tgUser?.id || null,
      name: String(name).trim(),
      phone: normalizePhone(phone),
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

router.patch('/shops/:id', requireOwner, upload.single('image'), (req, res) => {
  try {
    const data = {
      name: req.body.name,
      phone: req.body.phone ? normalizePhone(req.body.phone) : undefined,
      address: req.body.address,
      description: req.body.description,
      imageUrl: req.file ? `/uploads/${req.file.filename}` : undefined,
    };
    const shop = db.updateShop(Number(req.params.id), req.identity, data);
    if (!shop) return res.status(404).json({ error: "Do'kon topilmadi yoki ruxsat yo'q" });
    res.json({ shop });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Xatolik' });
  }
});

router.post('/products', requireOwner, upload.single('image'), (req, res) => {
  try {
    const { shopId, name, description, price, unit } = req.body;
    if (!shopId || !name || price === undefined || price === '') {
      return res.status(400).json({ error: "Do'kon, nom va narx majburiy" });
    }
    const shop = db.getShopById(Number(shopId));
    if (!shop || !db.shopOwnedBy(shop, req.identity.telegramId, req.identity.ownerId)) {
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

router.patch('/products/:id', requireOwner, upload.single('image'), (req, res) => {
  try {
    const data = {
      name: req.body.name,
      description: req.body.description,
      price: req.body.price !== undefined && req.body.price !== '' ? Number(req.body.price) : undefined,
      unit: req.body.unit,
      imageUrl: req.file ? `/uploads/${req.file.filename}` : undefined,
      isAvailable: req.body.isAvailable !== undefined ? Number(req.body.isAvailable) : undefined,
    };
    const product = db.updateProduct(Number(req.params.id), req.identity, data);
    if (!product) return res.status(404).json({ error: "Mahsulot topilmadi yoki ruxsat yo'q" });
    res.json({ product });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Xatolik' });
  }
});

router.delete('/products/:id', requireOwner, (req, res) => {
  const ok = db.deleteProduct(Number(req.params.id), req.identity);
  if (!ok) return res.status(404).json({ error: "Mahsulot topilmadi yoki ruxsat yo'q" });
  res.json({ ok: true });
});

router.use((err, _req, res, _next) => {
  if (err instanceof Error) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Server xatosi' });
});

module.exports = router;
