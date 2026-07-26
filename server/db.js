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

    CREATE TABLE IF NOT EXISTS shops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      market_id INTEGER NOT NULL,
      owner_telegram_id TEXT NOT NULL,
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

    CREATE INDEX IF NOT EXISTS idx_shops_market ON shops(market_id);
    CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shop_id);
    CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
    CREATE INDEX IF NOT EXISTS idx_shops_owner ON shops(owner_telegram_id);
  `);
}

function refreshMarketShopCount(marketId) {
  db.prepare(`
    UPDATE markets SET shops_count = (
      SELECT COUNT(*) FROM shops WHERE market_id = ? AND is_active = 1
    ) WHERE id = ?
  `).run(marketId, marketId);
}

function upsertUser({ telegramId, username, firstName, lastName }) {
  const existing = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(String(telegramId));
  if (existing) {
    db.prepare(`
      UPDATE users SET username = ?, first_name = ?, last_name = ?
      WHERE telegram_id = ?
    `).run(username || null, firstName || null, lastName || null, String(telegramId));
    return db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(String(telegramId));
  }
  db.prepare(`
    INSERT INTO users (telegram_id, username, first_name, last_name)
    VALUES (?, ?, ?, ?)
  `).run(String(telegramId), username || null, firstName || null, lastName || null);
  return db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(String(telegramId));
}

function getMarkets() {
  return db.prepare(`
    SELECT * FROM markets WHERE is_active = 1 ORDER BY name ASC
  `).all();
}

function getMarketById(id) {
  return db.prepare('SELECT * FROM markets WHERE id = ? AND is_active = 1').get(id);
}

function getMarketBySlug(slug) {
  return db.prepare('SELECT * FROM markets WHERE slug = ? AND is_active = 1').get(slug);
}

function getShopsByMarket(marketId) {
  return db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM products p WHERE p.shop_id = s.id AND p.is_available = 1) AS products_count
    FROM shops s
    WHERE s.market_id = ? AND s.is_active = 1
    ORDER BY s.name ASC
  `).all(marketId);
}

function getShopById(id) {
  return db.prepare(`
    SELECT s.*, m.name AS market_name, m.slug AS market_slug
    FROM shops s
    JOIN markets m ON m.id = s.market_id
    WHERE s.id = ? AND s.is_active = 1
  `).get(id);
}

function getShopsByOwner(telegramId) {
  return db.prepare(`
    SELECT s.*, m.name AS market_name
    FROM shops s
    JOIN markets m ON m.id = s.market_id
    WHERE s.owner_telegram_id = ?
    ORDER BY s.created_at DESC
  `).all(String(telegramId));
}

function createShop({ marketId, ownerTelegramId, name, phone, address, description, imageUrl }) {
  const result = db.prepare(`
    INSERT INTO shops (market_id, owner_telegram_id, name, phone, address, description, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    marketId,
    String(ownerTelegramId),
    name,
    phone,
    address,
    description || null,
    imageUrl || null
  );
  refreshMarketShopCount(marketId);
  return getShopById(result.lastInsertRowid);
}

function updateShop(id, ownerTelegramId, data) {
  const shop = db.prepare('SELECT * FROM shops WHERE id = ? AND owner_telegram_id = ?')
    .get(id, String(ownerTelegramId));
  if (!shop) return null;

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

function getProductsByShop(shopId) {
  return db.prepare(`
    SELECT * FROM products
    WHERE shop_id = ? AND is_available = 1
    ORDER BY name ASC
  `).all(shopId);
}

function getProductById(id) {
  return db.prepare(`
    SELECT p.*, s.name AS shop_name, s.phone AS shop_phone, s.address AS shop_address,
           s.market_id, m.name AS market_name
    FROM products p
    JOIN shops s ON s.id = p.shop_id
    JOIN markets m ON m.id = s.market_id
    WHERE p.id = ?
  `).get(id);
}

function createProduct({ shopId, name, description, price, unit, imageUrl }) {
  const result = db.prepare(`
    INSERT INTO products (shop_id, name, description, price, unit, image_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(shopId, name, description || null, price, unit || 'dona', imageUrl || null);
  return getProductById(result.lastInsertRowid);
}

function updateProduct(id, ownerTelegramId, data) {
  const product = db.prepare(`
    SELECT p.* FROM products p
    JOIN shops s ON s.id = p.shop_id
    WHERE p.id = ? AND s.owner_telegram_id = ?
  `).get(id, String(ownerTelegramId));
  if (!product) return null;

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

function deleteProduct(id, ownerTelegramId) {
  const product = db.prepare(`
    SELECT p.* FROM products p
    JOIN shops s ON s.id = p.shop_id
    WHERE p.id = ? AND s.owner_telegram_id = ?
  `).get(id, String(ownerTelegramId));
  if (!product) return false;
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  return true;
}

/**
 * Search products inside a market by free-text query.
 * Returns products with shop info, ranked by relevance.
 */
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

  // Group by shop for nicer UI
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

function createMarket({ name, slug, description, city, address, imageUrl }) {
  const result = db.prepare(`
    INSERT INTO markets (name, slug, description, city, address, image_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, slug, description || null, city || 'Toshkent', address || null, imageUrl || null);
  return getMarketById(result.lastInsertRowid);
}

initDb();

module.exports = {
  db,
  initDb,
  upsertUser,
  getMarkets,
  getMarketById,
  getMarketBySlug,
  getShopsByMarket,
  getShopById,
  getShopsByOwner,
  createShop,
  updateShop,
  getProductsByShop,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  searchInMarket,
  createMarket,
  refreshMarketShopCount,
};
