const express = require('express');
const db = require('../db');
const {
  checkSuperadminPassword,
  createAdminToken,
  getAdminSession,
  hashPassword,
  normalizePhone,
  isLocalhost,
} = require('../auth');

const router = express.Router();

function requireLocal(req, res, next) {
  if (!isLocalhost(req)) {
    return res.status(403).json({ error: 'Superadmin faqat localhost orqali' });
  }
  next();
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.headers['x-admin-token'];
  if (!getAdminSession(token)) {
    return res.status(401).json({ error: 'Superadmin avtorizatsiya kerak' });
  }
  req.adminToken = token;
  next();
}

router.use(requireLocal);

router.post('/login', (req, res) => {
  const { password } = req.body || {};
  if (!checkSuperadminPassword(password)) {
    return res.status(401).json({ error: "Noto'g'ri parol" });
  }
  const token = createAdminToken();
  res.json({ token, ok: true });
});

router.get('/me', requireAdmin, (_req, res) => {
  res.json({ ok: true, role: 'superadmin' });
});

router.get('/stats', requireAdmin, (_req, res) => {
  res.json({ stats: db.getDashboardStats() });
});

router.get('/markets', requireAdmin, (_req, res) => {
  res.json({ markets: db.getAllMarkets() });
});

router.get('/markets/:id', requireAdmin, (req, res) => {
  const market = db.getMarketById(Number(req.params.id));
  if (!market) return res.status(404).json({ error: 'Bozor topilmadi' });
  const shops = db.getShopsByMarket(market.id);
  // include inactive shops for admin view of this market
  const allShops = db.db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM products p WHERE p.shop_id = s.id) AS products_count,
      o.name AS owner_name, o.phone AS owner_login_phone,
      o.password_plain AS owner_password, o.id AS owner_account_id
    FROM shops s
    LEFT JOIN owners o ON o.id = s.owner_id
    WHERE s.market_id = ?
    ORDER BY s.name
  `).all(market.id);
  res.json({ market, shops: allShops.length ? allShops : shops });
});

router.post('/markets', requireAdmin, (req, res) => {
  try {
    const { name, description, city, address } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Bozor nomi majburiy' });
    }
    const market = db.createMarket({
      name: String(name).trim(),
      description: description ? String(description).trim() : null,
      city: city ? String(city).trim() : 'Toshkent',
      address: address ? String(address).trim() : null,
    });
    res.status(201).json({ market });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/markets/:id', requireAdmin, (req, res) => {
  const market = db.updateMarket(Number(req.params.id), {
    name: req.body.name,
    description: req.body.description,
    city: req.body.city,
    address: req.body.address,
    isActive: req.body.is_active !== undefined ? Number(req.body.is_active) : undefined,
  });
  if (!market) return res.status(404).json({ error: 'Bozor topilmadi' });
  res.json({ market });
});

router.get('/shops', requireAdmin, (_req, res) => {
  res.json({ shops: db.getAllShops() });
});

router.get('/shops/:id', requireAdmin, (req, res) => {
  const shop = db.getShopById(Number(req.params.id));
  if (!shop) return res.status(404).json({ error: "Do'kon topilmadi" });
  const products = db.getAllProductsByShop(shop.id);
  res.json({ shop, products });
});

router.get('/owners', requireAdmin, (_req, res) => {
  res.json({ owners: db.getAllOwners().map(db.publicOwner) });
});

/** Parolni yangilash (admin ko'ra olishi uchun plain ham saqlanadi) */
router.patch('/owners/:id/password', requireAdmin, (req, res) => {
  try {
    const password = req.body?.password;
    if (!password || String(password).length < 4) {
      return res.status(400).json({ error: "Parol kamida 4 belgi bo'lsin" });
    }
    const owner = db.getOwnerById(Number(req.params.id));
    if (!owner) return res.status(404).json({ error: 'Egasi topilmadi' });
    const updated = db.updateOwnerPassword(
      owner.id,
      hashPassword(password),
      String(password)
    );
    res.json({ owner: db.publicOwner(updated) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Do'kon egasi yaratish (+ ixtiyoriy do'kon)
 * body: { name, phone, password, marketId?, shopName?, shopPhone?, shopAddress?, shopDescription? }
 */
router.post('/owners', requireAdmin, (req, res) => {
  try {
    const {
      name,
      phone,
      password,
      marketId,
      shopName,
      shopPhone,
      shopAddress,
      shopDescription,
    } = req.body || {};

    if (!name || !phone || !password) {
      return res.status(400).json({ error: 'Ism, telefon va parol majburiy' });
    }
    if (String(password).length < 4) {
      return res.status(400).json({ error: "Parol kamida 4 belgi bo'lsin" });
    }

    const normPhone = normalizePhone(phone);
    if (db.getOwnerByPhone(normPhone)) {
      return res.status(400).json({ error: 'Bu telefon allaqachon ro‘yxatda' });
    }

    const owner = db.createOwner({
      phone: normPhone,
      passwordHash: hashPassword(password),
      passwordPlain: String(password),
      name: String(name).trim(),
    });

    let shop = null;
    if (marketId && shopName && shopAddress) {
      const market = db.getMarketById(Number(marketId));
      if (!market) {
        return res.status(400).json({ error: 'Bozor topilmadi', owner: db.publicOwner(owner) });
      }
      shop = db.createShop({
        marketId: Number(marketId),
        ownerId: owner.id,
        ownerTelegramId: null,
        name: String(shopName).trim(),
        phone: shopPhone ? normalizePhone(shopPhone) : normPhone,
        address: String(shopAddress).trim(),
        description: shopDescription ? String(shopDescription).trim() : null,
      });
    }

    res.status(201).json({
      owner: db.publicOwner(owner),
      shop,
      credentials: { phone: normPhone, password: String(password) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
