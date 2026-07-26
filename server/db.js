const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'bozor.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT UNIQUE NOT NULL,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      phone TEXT,
      role TEXT DEFAULT 'buyer',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS markets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      city TEXT DEFAULT 'Toshkent',
      address TEXT,
      image_url TEXT,
      shops_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS owners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      telegram_id TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      market_id INTEGER NOT NULL,
      owner_telegram_id TEXT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      description TEXT,
      image_url TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      unit TEXT DEFAULT 'dona',
      image_url TEXT,
      is_available INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
    );
  `);

  // Migrate older DBs missing columns
  const shopCols = db.prepare('PRAGMA table_info(shops)').all().map((c) => c.name);
  if (!shopCols.includes('owner_id')) {
    db.exec('ALTER TABLE shops ADD COLUMN owner_id INTEGER');
  }
  const ownerCols = db.prepare('PRAGMA table_info(owners)').all().map((c) => c.name);
  if (!ownerCols.includes('password_plain')) {
    db.exec('ALTER TABLE owners ADD COLUMN password_plain TEXT');
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_shops_market ON shops(market_id);
    CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shop_id);
    CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
    CREATE INDEX IF NOT EXISTS idx_shops_owner ON shops(owner_telegram_id);
    CREATE INDEX IF NOT EXISTS idx_shops_owner_id ON shops(owner_id);
    CREATE INDEX IF NOT EXISTS idx_owners_phone ON owners(phone);
    CREATE INDEX IF NOT EXISTS idx_owners_tg ON owners(telegram_id);
  `);
}

function refreshMarketShopCount(marketId) {
  db.prepare(`
    UPDATE markets SET shops_count = (
      SELECT COUNT(*) FROM shops WHERE market_id = ? AND is_active = 1
    ) WHERE id = ?
  `).run(marketId, marketId);
}

function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[''`ʻ’]/g, '')
    .replace(/[^a-z0-9\u0400-\u04FF]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || `market-${Date.now()}`;
}

function upsertUser({ telegramId, username, firstName, lastName, role }) {
  const existing = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(String(telegramId));
  if (existing) {
    db.prepare(`
      UPDATE users SET username = ?, first_name = ?, last_name = ?,
        role = COALESCE(?, role)
      WHERE telegram_id = ?
    `).run(username || null, firstName || null, lastName || null, role || null, String(telegramId));
    return db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(String(telegramId));
  }
  db.prepare(`
    INSERT INTO users (telegram_id, username, first_name, last_name, role)
    VALUES (?, ?, ?, ?, ?)
  `).run(String(telegramId), username || null, firstName || null, lastName || null, role || 'buyer');
  return db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(String(telegramId));
}

// ——— Markets ———

function getMarkets() {
  return db.prepare(`SELECT * FROM markets WHERE is_active = 1 ORDER BY name ASC`).all();
}

function getAllMarkets() {
  return db.prepare(`SELECT * FROM markets ORDER BY name ASC`).all();
}

function getMarketById(id) {
  return db.prepare('SELECT * FROM markets WHERE id = ?').get(id);
}

function getMarketBySlug(slug) {
  return db.prepare('SELECT * FROM markets WHERE slug = ?').get(slug);
}

function ensureBozoriName(name) {
  let n = String(name || '').trim();
  if (!n) return n;
  if (!/bozori$/i.test(n)) {
    n = `${n.replace(/\s*bozor$/i, '').trim()} bozori`;
  }
  return n;
}

function createMarket({ name, slug, description, city, address, imageUrl }) {
  const displayName = ensureBozoriName(name);
  let s = slug || slugify(displayName);
  let n = 1;
  while (getMarketBySlug(s)) {
    s = `${slugify(displayName)}-${n++}`;
  }
  const result = db.prepare(`
    INSERT INTO markets (name, slug, description, city, address, image_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(displayName, s, description || null, city || 'Toshkent', address || null, imageUrl || null);
  return getMarketById(result.lastInsertRowid);
}

function updateMarket(id, data) {
  const m = getMarketById(id);
  if (!m) return null;
  db.prepare(`
    UPDATE markets SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      city = COALESCE(?, city),
      address = COALESCE(?, address),
      image_url = COALESCE(?, image_url),
      is_active = COALESCE(?, is_active)
    WHERE id = ?
  `).run(
    data.name ?? null,
    data.description ?? null,
    data.city ?? null,
    data.address ?? null,
    data.imageUrl ?? null,
    data.isActive ?? null,
    id
  );
  return getMarketById(id);
}

// ——— Owners ———

function getOwnerById(id) {
  return db.prepare('SELECT * FROM owners WHERE id = ?').get(id);
}

function getOwnerByPhone(phone) {
  return db.prepare('SELECT * FROM owners WHERE phone = ? AND is_active = 1').get(phone);
}

function getOwnerByTelegramId(telegramId) {
  return db.prepare('SELECT * FROM owners WHERE telegram_id = ? AND is_active = 1').get(String(telegramId));
}

function getAllOwners() {
  return db.prepare(`
    SELECT o.*,
      (SELECT COUNT(*) FROM shops s WHERE s.owner_id = o.id) AS shops_count
    FROM owners o
    ORDER BY o.created_at DESC
  `).all();
}

function createOwner({ phone, passwordHash, passwordPlain, name, telegramId }) {
  const result = db.prepare(`
    INSERT INTO owners (phone, password_hash, password_plain, name, telegram_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    phone,
    passwordHash,
    passwordPlain != null ? String(passwordPlain) : null,
    name,
    telegramId ? String(telegramId) : null
  );
  return getOwnerById(result.lastInsertRowid);
}

function updateOwnerPassword(ownerId, passwordHash, passwordPlain) {
  db.prepare(`
    UPDATE owners SET password_hash = ?, password_plain = ? WHERE id = ?
  `).run(passwordHash, passwordPlain != null ? String(passwordPlain) : null, ownerId);
  return getOwnerById(ownerId);
}

function linkOwnerTelegram(ownerId, telegramId) {
  db.prepare('UPDATE owners SET telegram_id = ? WHERE id = ?').run(String(telegramId), ownerId);
  // sync shops owner_telegram_id
  db.prepare('UPDATE shops SET owner_telegram_id = ? WHERE owner_id = ?').run(String(telegramId), ownerId);
  return getOwnerById(ownerId);
}

function publicOwner(o) {
  if (!o) return null;
  return {
    id: o.id,
    phone: o.phone,
    name: o.name,
    password: o.password_plain || null,
    telegram_id: o.telegram_id,
    is_active: o.is_active,
    created_at: o.created_at,
    shops_count: o.shops_count,
  };
}

// ——— Shops ———

function getShopsByMarket(marketId) {
  return db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM products p WHERE p.shop_id = s.id AND p.is_available = 1) AS products_count
    FROM shops s
    WHERE s.market_id = ? AND s.is_active = 1
    ORDER BY s.name ASC
  `).all(marketId);
}

function getAllShops() {
  return db.prepare(`
    SELECT s.*, m.name AS market_name,
      o.name AS owner_name, o.phone AS owner_login_phone,
      o.password_plain AS owner_password,
      o.id AS owner_account_id,
      (SELECT COUNT(*) FROM products p WHERE p.shop_id = s.id) AS products_count
    FROM shops s
    JOIN markets m ON m.id = s.market_id
    LEFT JOIN owners o ON o.id = s.owner_id
    ORDER BY m.name, s.name
  `).all();
}

function getShopById(id) {
  return db.prepare(`
    SELECT s.*, m.name AS market_name, m.slug AS market_slug,
      o.name AS owner_name, o.phone AS owner_login_phone,
      o.password_plain AS owner_password,
      o.id AS owner_account_id
    FROM shops s
    JOIN markets m ON m.id = s.market_id
    LEFT JOIN owners o ON o.id = s.owner_id
    WHERE s.id = ?
  `).get(id);
}

function getShopsByOwnerTelegram(telegramId) {
  return db.prepare(`
    SELECT s.*, m.name AS market_name
    FROM shops s
    JOIN markets m ON m.id = s.market_id
    WHERE s.owner_telegram_id = ? OR s.owner_id IN (
      SELECT id FROM owners WHERE telegram_id = ?
    )
    ORDER BY s.created_at DESC
  `).all(String(telegramId), String(telegramId));
}

function getShopsByOwnerId(ownerId) {
  return db.prepare(`
    SELECT s.*, m.name AS market_name
    FROM shops s
    JOIN markets m ON m.id = s.market_id
    WHERE s.owner_id = ?
    ORDER BY s.created_at DESC
  `).all(ownerId);
}

// alias used by api
function getShopsByOwner(telegramId) {
  return getShopsByOwnerTelegram(telegramId);
}

function createShop({ marketId, ownerTelegramId, ownerId, name, phone, address, description, imageUrl }) {
  const result = db.prepare(`
    INSERT INTO shops (market_id, owner_telegram_id, owner_id, name, phone, address, description, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    marketId,
    ownerTelegramId ? String(ownerTelegramId) : null,
    ownerId || null,
    name,
    phone,
    address,
    description || null,
    imageUrl || null
  );
  refreshMarketShopCount(marketId);
  return getShopById(result.lastInsertRowid);
}

function shopOwnedBy(shop, telegramId, ownerId) {
  if (!shop) return false;
  if (ownerId && shop.owner_id && Number(shop.owner_id) === Number(ownerId)) return true;
  if (telegramId && shop.owner_telegram_id && String(shop.owner_telegram_id) === String(telegramId)) return true;
  if (telegramId) {
    const owner = getOwnerByTelegramId(telegramId);
    if (owner && shop.owner_id === owner.id) return true;
  }
  return false;
}

function updateShop(id, identity, data) {
  const shop = getShopById(id);
  if (!shop) return null;
  const ok = shopOwnedBy(shop, identity.telegramId, identity.ownerId);
  if (!ok) return null;

  db.prepare(`
    UPDATE shops SET
      name = COALESCE(?, name),
      phone = COALESCE(?, phone),
      address = COALESCE(?, address),
      description = COALESCE(?, description),
      image_url = COALESCE(?, image_url)
    WHERE id = ?
  `).run(
    data.name ?? null,
    data.phone ?? null,
    data.address ?? null,
    data.description ?? null,
    data.imageUrl ?? null,
    id
  );
  return getShopById(id);
}

// ——— Products ———

function getProductsByShop(shopId) {
  return db.prepare(`
    SELECT * FROM products
    WHERE shop_id = ? AND is_available = 1
    ORDER BY name ASC
  `).all(shopId);
}

function getAllProductsByShop(shopId) {
  return db.prepare(`
    SELECT * FROM products WHERE shop_id = ? ORDER BY name ASC
  `).all(shopId);
}

function getProductById(id) {
  return db.prepare(`
    SELECT p.*, s.name AS shop_name, s.phone AS shop_phone, s.address AS shop_address,
           s.market_id, s.owner_id, s.owner_telegram_id, m.name AS market_name
    FROM products p
    JOIN shops s ON s.id = p.shop_id
    JOIN markets m ON m.id = s.market_id
    WHERE p.id = ?
  `).get(id);
}

function createProduct({ shopId, name, description, price, unit, imageUrl, category, moderationStatus }) {
  const result = db.prepare(`
    INSERT INTO products (shop_id, name, description, price, unit, image_url, category, moderation_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    shopId,
    name,
    description || null,
    price,
    unit || 'dona',
    imageUrl || null,
    category || 'boshqa',
    moderationStatus || 'pending'
  );
  return getProductById(result.lastInsertRowid);
}

function updateProduct(id, identity, data) {
  const product = getProductById(id);
  if (!product) return null;
  const shop = getShopById(product.shop_id);
  if (!shopOwnedBy(shop, identity.telegramId, identity.ownerId)) return null;

  db.prepare(`
    UPDATE products SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      price = COALESCE(?, price),
      unit = COALESCE(?, unit),
      image_url = COALESCE(?, image_url),
      is_available = COALESCE(?, is_available),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    data.name ?? null,
    data.description ?? null,
    data.price ?? null,
    data.unit ?? null,
    data.imageUrl ?? null,
    data.isAvailable ?? null,
    id
  );
  return getProductById(id);
}

function deleteProduct(id, identity) {
  const product = getProductById(id);
  if (!product) return false;
  const shop = getShopById(product.shop_id);
  if (!shopOwnedBy(shop, identity.telegramId, identity.ownerId)) return false;
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  return true;
}

function searchInMarket(marketId, query) {
  const q = (query || '').trim();
  if (!q) return [];

  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const like = `%${q}%`;

  const products = db.prepare(`
    SELECT
      p.id, p.name, p.description, p.price, p.unit, p.image_url,
      s.id AS shop_id, s.name AS shop_name, s.phone AS shop_phone,
      s.address AS shop_address, s.image_url AS shop_image
    FROM products p
    JOIN shops s ON s.id = p.shop_id
    WHERE s.market_id = ?
      AND s.is_active = 1
      AND p.is_available = 1
      AND (
        LOWER(p.name) LIKE LOWER(?)
        OR LOWER(COALESCE(p.description, '')) LIKE LOWER(?)
        OR LOWER(s.name) LIKE LOWER(?)
      )
    ORDER BY
      CASE WHEN LOWER(p.name) LIKE LOWER(?) THEN 0 ELSE 1 END,
      p.price ASC
    LIMIT 80
  `).all(marketId, like, like, like, `%${words[0]}%`);

  const byShop = new Map();
  for (const p of products) {
    if (!byShop.has(p.shop_id)) {
      byShop.set(p.shop_id, {
        shop_id: p.shop_id,
        shop_name: p.shop_name,
        shop_phone: p.shop_phone,
        shop_address: p.shop_address,
        shop_image: p.shop_image,
        products: [],
      });
    }
    byShop.get(p.shop_id).products.push({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      unit: p.unit,
      image_url: p.image_url,
    });
  }
  return Array.from(byShop.values());
}

function getDashboardStats() {
  return {
    markets: db.prepare('SELECT COUNT(*) AS c FROM markets').get().c,
    shops: db.prepare('SELECT COUNT(*) AS c FROM shops').get().c,
    products: db.prepare('SELECT COUNT(*) AS c FROM products').get().c,
    owners: db.prepare('SELECT COUNT(*) AS c FROM owners').get().c,
  };
}

/** UI avtomatik yangilanish uchun ma'lumot "versiyasi" */
function getDataRevision() {
  const row = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM markets) AS markets,
      (SELECT COUNT(*) FROM shops) AS shops,
      (SELECT COUNT(*) FROM products) AS products,
      (SELECT COUNT(*) FROM owners) AS owners,
      (SELECT COALESCE(MAX(id),0) FROM markets) AS mid,
      (SELECT COALESCE(MAX(id),0) FROM shops) AS sid,
      (SELECT COALESCE(MAX(id),0) FROM products) AS pid,
      (SELECT COALESCE(MAX(id),0) FROM owners) AS oid,
      (SELECT COALESCE(MAX(updated_at), '') FROM products) AS pupd,
      (SELECT COALESCE(MAX(created_at), '') FROM products) AS pcr,
      (SELECT COALESCE(MAX(created_at), '') FROM shops) AS scr,
      (SELECT COALESCE(MAX(created_at), '') FROM markets) AS mcr,
      (SELECT COALESCE(SUM(price),0) FROM products) AS psum,
      (SELECT COALESCE(SUM(shops_count),0) FROM markets) AS scsum
  `).get();
  return [
    row.markets, row.shops, row.products, row.owners,
    row.mid, row.sid, row.pid, row.oid,
    row.pupd, row.pcr, row.scr, row.mcr,
    row.psum, row.scsum,
  ].join('|');
}

initDb();

module.exports = {
  db,
  initDb,
  upsertUser,
  getMarkets,
  getAllMarkets,
  getMarketById,
  getMarketBySlug,
  createMarket,
  updateMarket,
  getOwnerById,
  getOwnerByPhone,
  getOwnerByTelegramId,
  getAllOwners,
  createOwner,
  updateOwnerPassword,
  linkOwnerTelegram,
  publicOwner,
  getShopsByMarket,
  getAllShops,
  getShopById,
  getShopsByOwner,
  getShopsByOwnerTelegram,
  getShopsByOwnerId,
  createShop,
  updateShop,
  shopOwnedBy,
  getProductsByShop,
  getAllProductsByShop,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  searchInMarket,
  refreshMarketShopCount,
  getDashboardStats,
  getDataRevision,
  slugify,
};
