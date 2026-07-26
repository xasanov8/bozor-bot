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
const features = require('../features');

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

router.get('/categories', (_req, res) => {
  res.json({ categories: features.CATEGORIES });
});

router.get('/markets/:id', (req, res) => {
  const market = db.getMarketById(Number(req.params.id));
  if (!market || !market.is_active) return res.status(404).json({ error: 'Bozor topilmadi' });
  const shops = db.getShopsByMarket(market.id).map(features.enrichShop);
  res.json({ market, shops });
});

router.get('/markets/:id/search', (req, res) => {
  const rawId = req.params.id;
  const allMarkets = rawId === 'all' || req.query.allMarkets === '1' || req.query.allMarkets === 'true';
  let market = null;
  if (!allMarkets) {
    market = db.getMarketById(Number(rawId));
    if (!market || !market.is_active) return res.status(404).json({ error: 'Bozor topilmadi' });
  }
  const q = String(req.query.q || '').trim();
  const filters = {
    category: req.query.category || 'all',
    minPrice: req.query.minPrice,
    maxPrice: req.query.maxPrice,
    minRating: req.query.minRating,
    promoOnly: req.query.promoOnly === '1' || req.query.promoOnly === 'true',
    openNow: req.query.openNow === '1' || req.query.openNow === 'true',
    sort: req.query.sort || 'relevance',
    allMarkets,
  };
  const results = features.searchInMarketFiltered(allMarkets ? 'all' : market.id, q, filters);
  res.json({ query: q, market, filters, results, all_markets: allMarkets });
});

// Global search (barcha bozorlar)
router.get('/search', (req, res) => {
  const q = String(req.query.q || '').trim();
  const filters = {
    category: req.query.category || 'all',
    minPrice: req.query.minPrice,
    maxPrice: req.query.maxPrice,
    minRating: req.query.minRating,
    promoOnly: req.query.promoOnly === '1' || req.query.promoOnly === 'true',
    openNow: req.query.openNow === '1' || req.query.openNow === 'true',
    sort: req.query.sort || 'relevance',
    allMarkets: true,
  };
  const results = features.searchInMarketFiltered('all', q, filters);
  res.json({ query: q, filters, results, all_markets: true });
});

router.get('/shops/:id', (req, res) => {
  const shop = db.getShopById(Number(req.params.id));
  if (!shop || !shop.is_active) return res.status(404).json({ error: "Do'kon topilmadi" });
  features.trackEvent(shop.id, 'view_shop');
  const products = features.getProductsByShopPublic(shop.id);
  const reviews = features.getReviewsForShop(shop.id, 20);
  res.json({ shop: features.enrichShop(shop), products, reviews });
});

router.get('/products/:id', (req, res) => {
  const product = db.getProductById(Number(req.params.id));
  if (!product) return res.status(404).json({ error: 'Mahsulot topilmadi' });
  if (product.moderation_status && product.moderation_status !== 'approved' && product.moderation_status !== null) {
    // egasi o'zi ko'ra olishi uchun keyinroq — public faqat approved
    if (product.moderation_status !== 'approved') {
      return res.status(404).json({ error: 'Mahsulot topilmadi' });
    }
  }
  features.trackEvent(product.shop_id || product.shopId, 'view_product', product.id);
  const reviews = features.getReviewsForProduct(product.id);
  res.json({ product: features.enrichProduct(product), reviews });
});

router.post('/events', (req, res) => {
  try {
    const { shopId, productId, type } = req.body || {};
    if (!shopId || !type) return res.status(400).json({ error: 'shopId va type majburiy' });
    features.trackEvent(Number(shopId), String(type), productId ? Number(productId) : null);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ——— Buyurtma + sharx (xaridor) ———

function getBuyerId(req) {
  const user = getTelegramUser(req);
  if (user?.id) return String(user.id);
  if (req.headers['x-dev-user']) return String(req.headers['x-dev-user']);
  if (req.body?.buyerTelegramId) return String(req.body.buyerTelegramId);
  return null;
}

router.post('/orders', (req, res) => {
  try {
    const buyerId = getBuyerId(req);
    if (!buyerId) return res.status(401).json({ error: 'Xaridor aniqlanmadi' });
    const { shopId, items, note, buyerName } = req.body || {};
    if (!shopId || !items?.length) {
      return res.status(400).json({ error: "Do'kon va mahsulotlar majburiy" });
    }
    const order = features.createOrder({
      buyerTelegramId: buyerId,
      buyerName: buyerName || getTelegramUser(req)?.first_name || null,
      shopId: Number(shopId),
      items,
      note,
    });
    res.status(201).json({ order });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/orders/mine', (req, res) => {
  const buyerId = getBuyerId(req);
  if (!buyerId) return res.status(401).json({ error: 'Xaridor aniqlanmadi' });
  res.json({ orders: features.getOrdersByBuyer(buyerId) });
});

router.get('/reviews/can/:productId', (req, res) => {
  const buyerId = getBuyerId(req);
  if (!buyerId) return res.json({ ok: false, reason: 'Kirish kerak' });
  res.json(features.canReviewProduct(buyerId, Number(req.params.productId)));
});

router.post('/reviews', (req, res) => {
  try {
    const buyerId = getBuyerId(req);
    if (!buyerId) return res.status(401).json({ error: 'Xaridor aniqlanmadi' });
    const { productId, rating, comment } = req.body || {};
    const review = features.createReview({
      productId: Number(productId),
      buyerTelegramId: buyerId,
      buyerName: getTelegramUser(req)?.first_name || req.body?.buyerName || null,
      rating,
      comment,
    });
    res.status(201).json({ review });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/products/:id/reviews', (req, res) => {
  res.json({ reviews: features.getReviewsForProduct(Number(req.params.id)) });
});

// ——— Chat (xaridor ↔ do'kon egasi) ———

router.get('/chats', (req, res) => {
  const buyerId = getBuyerId(req);
  if (!buyerId) return res.status(401).json({ error: 'Xaridor aniqlanmadi' });
  res.json({ threads: features.getBuyerThreads(buyerId) });
});

router.get('/chats/thread/:id', (req, res) => {
  const buyerId = getBuyerId(req);
  if (!buyerId) return res.status(401).json({ error: 'Xaridor aniqlanmadi' });
  const thread = features.getThreadById(Number(req.params.id));
  if (!thread) return res.status(404).json({ error: 'Chat topilmadi' });
  if (String(thread.buyer_telegram_id) !== String(buyerId)) {
    return res.status(403).json({ error: "Ruxsat yo'q" });
  }
  const messages = features.getThreadMessages(thread.id);
  res.json({ thread, messages });
});

router.post('/chats/send', (req, res) => {
  try {
    const buyerId = getBuyerId(req);
    if (!buyerId) return res.status(401).json({ error: 'Xaridor aniqlanmadi' });
    const { shopId, body } = req.body || {};
    if (!shopId || !body) return res.status(400).json({ error: "Do'kon va xabar majburiy" });
    const msg = features.sendChatMessage({
      shopId: Number(shopId),
      buyerTelegramId: buyerId,
      buyerName: getTelegramUser(req)?.first_name || req.body?.buyerName || null,
      senderRole: 'buyer',
      senderId: buyerId,
      body,
    });
    const thread = features.getOrCreateThread(
      Number(shopId),
      buyerId,
      getTelegramUser(req)?.first_name || null
    );
    res.status(201).json({ message: msg, thread });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/owner/chats', requireOwner, (req, res) => {
  res.json({
    threads: features.getOwnerThreads(req.owner?.id, req.identity?.telegramId || req.tgUser?.id),
  });
});

router.get('/owner/chats/:id', requireOwner, (req, res) => {
  const thread = features.getThreadById(Number(req.params.id));
  if (!thread) return res.status(404).json({ error: 'Chat topilmadi' });
  const shop = db.getShopById(thread.shop_id);
  if (!shop || !db.shopOwnedBy(shop, req.identity.telegramId, req.identity.ownerId)) {
    return res.status(403).json({ error: "Ruxsat yo'q" });
  }
  res.json({ thread, messages: features.getThreadMessages(thread.id) });
});

router.post('/owner/chats/:id/reply', requireOwner, (req, res) => {
  try {
    const thread = features.getThreadById(Number(req.params.id));
    if (!thread) return res.status(404).json({ error: 'Chat topilmadi' });
    const shop = db.getShopById(thread.shop_id);
    if (!shop || !db.shopOwnedBy(shop, req.identity.telegramId, req.identity.ownerId)) {
      return res.status(403).json({ error: "Ruxsat yo'q" });
    }
    const msg = features.sendChatMessage({
      shopId: thread.shop_id,
      buyerTelegramId: thread.buyer_telegram_id,
      buyerName: thread.buyer_name,
      senderRole: 'owner',
      senderId: req.identity.telegramId || String(req.owner?.id || ''),
      body: req.body?.body,
    });
    res.status(201).json({ message: msg });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/owner/reviews', requireOwner, (req, res) => {
  res.json({
    reviews: features.getOwnerReviews(req.owner?.id, req.identity?.telegramId || req.tgUser?.id),
  });
});

router.post('/owner/reviews/:id/reply', requireOwner, (req, res) => {
  try {
    const review = features.replyToReview(Number(req.params.id), req.identity, req.body?.reply);
    res.json({ review });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
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
    shops = db.getShopsByOwnerId(req.owner.id).map(features.enrichShop);
  } else if (req.tgUser) {
    shops = db.getShopsByOwnerTelegram(req.tgUser.id).map(features.enrichShop);
  }

  const stats = features.getOwnerStats(req.owner?.id, req.identity?.telegramId || req.tgUser?.id);

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
    stats,
  });
});

router.get('/owner/stats', requireOwner, (req, res) => {
  res.json(features.getOwnerStats(req.owner?.id, req.identity?.telegramId || req.tgUser?.id));
});

router.get('/owner/shops/:id', requireOwner, (req, res) => {
  const shop = db.getShopById(Number(req.params.id));
  if (!shop || !db.shopOwnedBy(shop, req.identity.telegramId, req.identity.ownerId)) {
    return res.status(404).json({ error: "Do'kon topilmadi yoki ruxsat yo'q" });
  }
  const products = features.getAllProductsByShopOwner(shop.id);
  res.json({ shop: features.enrichShop(shop), products });
});

router.patch('/shops/:id/hours', requireOwner, (req, res) => {
  try {
    const shop = features.updateShopHours(Number(req.params.id), req.identity, {
      workOpen: req.body.work_open || req.body.workOpen,
      workClose: req.body.work_close || req.body.workClose,
      workDays: req.body.work_days || req.body.workDays,
    });
    if (!shop) return res.status(404).json({ error: "Do'kon topilmadi yoki ruxsat yo'q" });
    res.json({ shop });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/products/:id/promo', requireOwner, (req, res) => {
  try {
    const product = features.setProductPromo(Number(req.params.id), req.identity, {
      isPromo: req.body.is_promo ?? req.body.isPromo,
      discountPercent: req.body.discount_percent ?? req.body.discountPercent,
      oldPrice: req.body.old_price ?? req.body.oldPrice,
    });
    if (!product) return res.status(404).json({ error: "Mahsulot topilmadi yoki ruxsat yo'q" });
    res.json({ product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
    const { shopId, name, description, price, unit, category } = req.body;
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
      category: category || 'boshqa',
      moderationStatus: 'pending', // superadmin tasdiqlaydi
    });
    res.status(201).json({
      product: features.enrichProduct(product),
      message: "Mahsulot moderatsiyaga yuborildi. Tasdiqlangach xaridorlarga ko'rinadi.",
    });
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
