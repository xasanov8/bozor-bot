/**
 * Filtr, reyting, sharx, buyurtma, statistika, aksiya, ish vaqti, moderatsiya
 */
const dbModule = require('./db');
const { db } = dbModule;

function migrateFeatures() {
  const addCol = (table, col, defSql) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
    if (!cols.includes(col)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${defSql}`);
    }
  };

  addCol('shops', 'work_open', "TEXT DEFAULT '09:00'");
  addCol('shops', 'work_close', "TEXT DEFAULT '18:00'");
  addCol('shops', 'work_days', "TEXT DEFAULT '1,2,3,4,5,6,7'");
  addCol('shops', 'rating_avg', 'REAL DEFAULT 0');
  addCol('shops', 'rating_count', 'INTEGER DEFAULT 0');
  addCol('shops', 'views_count', 'INTEGER DEFAULT 0');

  addCol('products', 'category', "TEXT DEFAULT 'boshqa'");
  addCol('products', 'old_price', 'REAL');
  addCol('products', 'discount_percent', 'REAL DEFAULT 0');
  addCol('products', 'is_promo', 'INTEGER DEFAULT 0');
  addCol('products', 'moderation_status', "TEXT DEFAULT 'approved'");
  addCol('products', 'views_count', 'INTEGER DEFAULT 0');
  addCol('products', 'rating_avg', 'REAL DEFAULT 0');
  addCol('products', 'rating_count', 'INTEGER DEFAULT 0');

  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      buyer_telegram_id TEXT NOT NULL,
      buyer_name TEXT,
      shop_id INTEGER NOT NULL,
      status TEXT DEFAULT 'new',
      total REAL DEFAULT 0,
      note TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      qty INTEGER DEFAULT 1,
      unit TEXT DEFAULT 'dona',
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      shop_id INTEGER NOT NULL,
      order_id INTEGER,
      buyer_telegram_id TEXT NOT NULL,
      buyer_name TEXT,
      rating INTEGER NOT NULL,
      comment TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(product_id, buyer_telegram_id),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS shop_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER NOT NULL,
      product_id INTEGER,
      event_type TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_telegram_id);
    CREATE INDEX IF NOT EXISTS idx_orders_shop ON orders(shop_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_shop ON reviews(shop_id);
    CREATE INDEX IF NOT EXISTS idx_stats_shop ON shop_stats(shop_id);
    CREATE INDEX IF NOT EXISTS idx_products_mod ON products(moderation_status);
    CREATE INDEX IF NOT EXISTS idx_products_cat ON products(category);

    CREATE TABLE IF NOT EXISTS chat_threads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER NOT NULL,
      buyer_telegram_id TEXT NOT NULL,
      buyer_name TEXT,
      last_message TEXT,
      last_at TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(shop_id, buyer_telegram_id),
      FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id INTEGER NOT NULL,
      sender_role TEXT NOT NULL,
      sender_id TEXT,
      body TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_chat_threads_shop ON chat_threads(shop_id);
    CREATE INDEX IF NOT EXISTS idx_chat_threads_buyer ON chat_threads(buyer_telegram_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(thread_id);
  `);

  // Sharxga egasi javobi
  const revCols = db.prepare('PRAGMA table_info(reviews)').all().map((c) => c.name);
  if (!revCols.includes('owner_reply')) {
    db.exec('ALTER TABLE reviews ADD COLUMN owner_reply TEXT');
  }
  if (!revCols.includes('owner_reply_at')) {
    db.exec('ALTER TABLE reviews ADD COLUMN owner_reply_at TEXT');
  }
}

migrateFeatures();

const CATEGORIES = [
  { id: 'meva', label: 'Meva-sabzavot' },
  { id: 'gosht', label: "Go'sht" },
  { id: 'non', label: 'Non va pishiriq' },
  { id: 'don', label: 'Guruch va don' },
  { id: 'ziravor', label: 'Ziravor va choy' },
  { id: 'kiyim', label: 'Kiyim' },
  { id: 'uy', label: "Uy-ro'zg'or" },
  { id: 'boshqa', label: 'Boshqa' },
];

function nowInTashkent() {
  // O'zbekiston vaqti (UTC+5) — server UTC bo'lsa ham to'g'ri
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tashkent',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  const map = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const day = map[parts.weekday] || 1;
  const [hh, mm] = String(parts.hour + ':' + parts.minute).split(':').map(Number);
  return { day, minutes: hh * 60 + mm };
}

function parseTimeToMinutes(t) {
  if (!t || !/^\d{1,2}:\d{2}$/.test(String(t).trim())) return null;
  const [h, m] = String(t).trim().split(':').map(Number);
  return h * 60 + m;
}

function isShopOpenNow(shop) {
  const days = String(shop.work_days || '1,2,3,4,5,6,7')
    .split(',')
    .map((x) => Number(x.trim()))
    .filter(Boolean);
  const { day, minutes: cur } = nowInTashkent();
  if (!days.includes(day)) return false;
  const open = parseTimeToMinutes(shop.work_open || '09:00');
  const close = parseTimeToMinutes(shop.work_close || '18:00');
  if (open == null || close == null) return true;
  if (close > open) return cur >= open && cur < close;
  return cur >= open || cur < close;
}

function trackEvent(shopId, eventType, productId = null) {
  if (!shopId || !eventType) return;
  db.prepare(`
    INSERT INTO shop_stats (shop_id, product_id, event_type) VALUES (?, ?, ?)
  `).run(shopId, productId || null, eventType);
  if (eventType === 'view_shop') {
    db.prepare('UPDATE shops SET views_count = COALESCE(views_count,0) + 1 WHERE id = ?').run(shopId);
  }
  if (eventType === 'view_product' && productId) {
    db.prepare('UPDATE products SET views_count = COALESCE(views_count,0) + 1 WHERE id = ?').run(productId);
  }
}

function refreshProductRating(productId) {
  const row = db.prepare(`
    SELECT AVG(rating) AS avg_r, COUNT(*) AS cnt FROM reviews WHERE product_id = ?
  `).get(productId);
  db.prepare(`
    UPDATE products SET rating_avg = ?, rating_count = ? WHERE id = ?
  `).run(row.avg_r || 0, row.cnt || 0, productId);
  const p = db.prepare('SELECT shop_id FROM products WHERE id = ?').get(productId);
  if (p) refreshShopRating(p.shop_id);
}

function refreshShopRating(shopId) {
  const row = db.prepare(`
    SELECT AVG(rating) AS avg_r, COUNT(*) AS cnt FROM reviews WHERE shop_id = ?
  `).get(shopId);
  db.prepare(`
    UPDATE shops SET rating_avg = ?, rating_count = ? WHERE id = ?
  `).run(row.avg_r || 0, row.cnt || 0, shopId);
}

function getEffectivePrice(p) {
  const price = Number(p.price) || 0;
  const disc = Number(p.discount_percent) || 0;
  if (p.is_promo && disc > 0) {
    return Math.round(price * (1 - disc / 100));
  }
  return price;
}

function enrichProduct(p) {
  if (!p) return p;
  const effective = getEffectivePrice(p);
  return {
    ...p,
    effective_price: effective,
    has_promo: !!(p.is_promo && (p.discount_percent > 0 || p.old_price)),
    moderation_status: p.moderation_status || 'approved',
  };
}

function enrichShop(s) {
  if (!s) return s;
  return {
    ...s,
    is_open_now: isShopOpenNow(s),
    work_open: s.work_open || '09:00',
    work_close: s.work_close || '18:00',
    work_days: s.work_days || '1,2,3,4,5,6,7',
    rating_avg: Number(s.rating_avg) || 0,
    rating_count: Number(s.rating_count) || 0,
  };
}

/** Filtr + qidiruv — bitta bozor yoki barcha bozorlar (marketId = 'all' | null) */
function searchInMarketFiltered(marketId, query, filters = {}) {
  const q = (query || '').trim().toLowerCase();
  const {
    category,
    minPrice,
    maxPrice,
    minRating,
    promoOnly,
    openNow,
    sort = 'relevance',
    allMarkets = false,
  } = filters;

  const all = allMarkets || marketId === 'all' || marketId === 0 || marketId == null;

  let sql = `
    SELECT
      p.id, p.name, p.description, p.price, p.unit, p.image_url,
      p.category, p.old_price, p.discount_percent, p.is_promo,
      p.moderation_status, p.rating_avg AS product_rating, p.rating_count AS product_rating_count,
      s.id AS shop_id, s.name AS shop_name, s.phone AS shop_phone,
      s.address AS shop_address, s.image_url AS shop_image,
      s.rating_avg AS shop_rating, s.rating_count AS shop_rating_count,
      s.work_open, s.work_close, s.work_days, s.market_id,
      m.name AS market_name
    FROM products p
    JOIN shops s ON s.id = p.shop_id
    JOIN markets m ON m.id = s.market_id
    WHERE s.is_active = 1
      AND p.is_available = 1
      AND COALESCE(p.moderation_status, 'approved') = 'approved'
      AND m.is_active = 1
  `;
  const params = [];

  if (!all) {
    sql += ` AND s.market_id = ?`;
    params.push(Number(marketId));
  }

  if (q) {
    // so'zlar bo'yicha kengroq qidiruv
    const words = q.split(/\s+/).filter(Boolean);
    for (const w of words) {
      sql += ` AND (
        LOWER(p.name) LIKE ?
        OR LOWER(COALESCE(p.description,'')) LIKE ?
        OR LOWER(s.name) LIKE ?
        OR LOWER(COALESCE(p.category,'')) LIKE ?
      )`;
      const like = `%${w}%`;
      params.push(like, like, like, like);
    }
  }
  if (category && category !== 'all') {
    sql += ` AND COALESCE(p.category, 'boshqa') = ?`;
    params.push(category);
  }
  if (promoOnly) {
    sql += ` AND p.is_promo = 1 AND COALESCE(p.discount_percent,0) > 0`;
  }
  if (minRating) {
    sql += ` AND COALESCE(s.rating_avg, 0) >= ?`;
    params.push(Number(minRating));
  }

  if (sort === 'price_asc') sql += ` ORDER BY p.price ASC`;
  else if (sort === 'price_desc') sql += ` ORDER BY p.price DESC`;
  else if (sort === 'rating') sql += ` ORDER BY COALESCE(s.rating_avg,0) DESC, p.price ASC`;
  else if (sort === 'promo') sql += ` ORDER BY p.is_promo DESC, p.discount_percent DESC, p.price ASC`;
  else {
    sql += ` ORDER BY
      CASE WHEN LOWER(p.name) LIKE ? THEN 0 ELSE 1 END,
      p.price ASC`;
    params.push(q ? `%${q}%` : '%');
  }
  sql += ` LIMIT 150`;

  let rows = db.prepare(sql).all(...params);

  // effective price filter + open now (JS)
  rows = rows.filter((r) => {
    const eff = getEffectivePrice(r);
    if (minPrice != null && minPrice !== '' && eff < Number(minPrice)) return false;
    if (maxPrice != null && maxPrice !== '' && eff > Number(maxPrice)) return false;
    if (openNow && !isShopOpenNow(r)) return false;
    return true;
  });

  const byShop = new Map();
  for (const p of rows) {
    const ep = enrichProduct(p);
    if (!byShop.has(p.shop_id)) {
      byShop.set(p.shop_id, {
        shop_id: p.shop_id,
        shop_name: p.shop_name,
        shop_phone: p.shop_phone,
        shop_address: p.shop_address,
        shop_image: p.shop_image,
        market_id: p.market_id,
        market_name: p.market_name,
        shop_rating: Number(p.shop_rating) || 0,
        shop_rating_count: Number(p.shop_rating_count) || 0,
        is_open_now: isShopOpenNow(p),
        work_open: p.work_open,
        work_close: p.work_close,
        products: [],
      });
    }
    byShop.get(p.shop_id).products.push({
      id: ep.id,
      name: ep.name,
      description: ep.description,
      price: ep.price,
      effective_price: ep.effective_price,
      unit: ep.unit,
      image_url: ep.image_url,
      category: ep.category,
      is_promo: ep.is_promo,
      discount_percent: ep.discount_percent,
      old_price: ep.old_price,
      has_promo: ep.has_promo,
      rating_avg: Number(p.product_rating) || 0,
      rating_count: Number(p.product_rating_count) || 0,
    });
  }
  return Array.from(byShop.values());
}

function getProductsByShopPublic(shopId) {
  return db.prepare(`
    SELECT * FROM products
    WHERE shop_id = ? AND is_available = 1
      AND COALESCE(moderation_status, 'approved') = 'approved'
    ORDER BY is_promo DESC, name ASC
  `).all(shopId).map(enrichProduct);
}

function getAllProductsByShopOwner(shopId) {
  return db.prepare(`
    SELECT * FROM products WHERE shop_id = ? ORDER BY created_at DESC
  `).all(shopId).map(enrichProduct);
}

function createOrder({ buyerTelegramId, buyerName, shopId, items, note }) {
  if (!items?.length) throw new Error('Savat bo\'sh');
  let total = 0;
  for (const it of items) {
    total += Number(it.price) * Number(it.qty || 1);
  }
  const result = db.prepare(`
    INSERT INTO orders (buyer_telegram_id, buyer_name, shop_id, total, note)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    String(buyerTelegramId),
    buyerName || null,
    shopId,
    total,
    note || null
  );
  const orderId = result.lastInsertRowid;
  const ins = db.prepare(`
    INSERT INTO order_items (order_id, product_id, name, price, qty, unit)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const it of items) {
    ins.run(orderId, it.product_id || it.id || null, it.name, Number(it.price), Number(it.qty || 1), it.unit || 'dona');
  }
  trackEvent(shopId, 'order');
  return getOrderById(orderId);
}

function getOrderById(id) {
  const order = db.prepare(`
    SELECT o.*, s.name AS shop_name, s.phone AS shop_phone, s.address AS shop_address
    FROM orders o JOIN shops s ON s.id = o.shop_id WHERE o.id = ?
  `).get(id);
  if (!order) return null;
  order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);
  return order;
}

function getOrdersByBuyer(telegramId) {
  return db.prepare(`
    SELECT o.*, s.name AS shop_name, s.phone AS shop_phone
    FROM orders o JOIN shops s ON s.id = o.shop_id
    WHERE o.buyer_telegram_id = ?
    ORDER BY o.created_at DESC
    LIMIT 50
  `).all(String(telegramId));
}

function getBuyerPurchasedProductIds(telegramId) {
  return db.prepare(`
    SELECT DISTINCT oi.product_id AS product_id
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.buyer_telegram_id = ? AND oi.product_id IS NOT NULL
  `).all(String(telegramId)).map((r) => r.product_id);
}

function canReviewProduct(telegramId, productId) {
  const bought = db.prepare(`
    SELECT oi.id FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.buyer_telegram_id = ? AND oi.product_id = ?
    LIMIT 1
  `).get(String(telegramId), productId);
  if (!bought) return { ok: false, reason: "Faqat buyurtma qilgan mahsulotga sharx yozish mumkin" };
  const existing = db.prepare(`
    SELECT id FROM reviews WHERE product_id = ? AND buyer_telegram_id = ?
  `).get(productId, String(telegramId));
  if (existing) return { ok: false, reason: 'Bu mahsulotga allaqachon sharx yozgansiz' };
  return { ok: true };
}

function createReview({ productId, buyerTelegramId, buyerName, rating, comment, orderId }) {
  const r = Math.min(5, Math.max(1, Number(rating) || 0));
  if (r < 1) throw new Error('Reyting 1–5 bo‘lsin');
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!product) throw new Error('Mahsulot topilmadi');
  const check = canReviewProduct(buyerTelegramId, productId);
  if (!check.ok) throw new Error(check.reason);

  db.prepare(`
    INSERT INTO reviews (product_id, shop_id, order_id, buyer_telegram_id, buyer_name, rating, comment)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    productId,
    product.shop_id,
    orderId || null,
    String(buyerTelegramId),
    buyerName || null,
    r,
    comment ? String(comment).trim().slice(0, 500) : null
  );
  refreshProductRating(productId);
  return db.prepare('SELECT * FROM reviews WHERE product_id = ? AND buyer_telegram_id = ?')
    .get(productId, String(buyerTelegramId));
}

function replyToReview(reviewId, identity, replyText) {
  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(reviewId);
  if (!review) throw new Error('Sharx topilmadi');
  const shop = dbModule.getShopById(review.shop_id);
  if (!shop || !dbModule.shopOwnedBy(shop, identity.telegramId, identity.ownerId)) {
    throw new Error("Ruxsat yo'q");
  }
  const text = String(replyText || '').trim().slice(0, 500);
  if (!text) throw new Error('Javob matni bo‘sh');
  db.prepare(`
    UPDATE reviews SET owner_reply = ?, owner_reply_at = datetime('now') WHERE id = ?
  `).run(text, reviewId);
  return db.prepare('SELECT * FROM reviews WHERE id = ?').get(reviewId);
}

function getOwnerReviews(ownerId, telegramId) {
  const shops = ownerId
    ? dbModule.getShopsByOwnerId(ownerId)
    : dbModule.getShopsByOwnerTelegram(telegramId);
  const ids = shops.map((s) => s.id);
  if (!ids.length) return [];
  const ph = ids.map(() => '?').join(',');
  return db.prepare(`
    SELECT r.*, p.name AS product_name, s.name AS shop_name
    FROM reviews r
    JOIN products p ON p.id = r.product_id
    JOIN shops s ON s.id = r.shop_id
    WHERE r.shop_id IN (${ph})
    ORDER BY r.created_at DESC
    LIMIT 100
  `).all(...ids);
}

function getReviewsForProduct(productId, limit = 30) {
  return db.prepare(`
    SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC LIMIT ?
  `).all(productId, limit);
}

function getReviewsForShop(shopId, limit = 40) {
  return db.prepare(`
    SELECT r.*, p.name AS product_name
    FROM reviews r
    JOIN products p ON p.id = r.product_id
    WHERE r.shop_id = ?
    ORDER BY r.created_at DESC LIMIT ?
  `).all(shopId, limit);
}

// ——— Chat ———

function getOrCreateThread(shopId, buyerTelegramId, buyerName) {
  let t = db.prepare(`
    SELECT * FROM chat_threads WHERE shop_id = ? AND buyer_telegram_id = ?
  `).get(shopId, String(buyerTelegramId));
  if (t) return t;
  const r = db.prepare(`
    INSERT INTO chat_threads (shop_id, buyer_telegram_id, buyer_name)
    VALUES (?, ?, ?)
  `).run(shopId, String(buyerTelegramId), buyerName || null);
  return db.prepare('SELECT * FROM chat_threads WHERE id = ?').get(r.lastInsertRowid);
}

function sendChatMessage({ shopId, buyerTelegramId, buyerName, senderRole, senderId, body }) {
  const text = String(body || '').trim().slice(0, 1000);
  if (!text) throw new Error('Xabar bo‘sh');
  if (!['buyer', 'owner'].includes(senderRole)) throw new Error('Noto‘g‘ri yuboruvchi');
  const shop = dbModule.getShopById(shopId);
  if (!shop || !shop.is_active) throw new Error("Do'kon topilmadi");

  const thread = getOrCreateThread(shopId, buyerTelegramId, buyerName);
  const ins = db.prepare(`
    INSERT INTO chat_messages (thread_id, sender_role, sender_id, body)
    VALUES (?, ?, ?, ?)
  `).run(thread.id, senderRole, senderId ? String(senderId) : null, text);
  db.prepare(`
    UPDATE chat_threads SET last_message = ?, last_at = datetime('now'),
      buyer_name = COALESCE(?, buyer_name)
    WHERE id = ?
  `).run(text, buyerName || null, thread.id);
  return db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(ins.lastInsertRowid);
}

function getThreadMessages(threadId, limit = 100) {
  return db.prepare(`
    SELECT * FROM chat_messages WHERE thread_id = ? ORDER BY id ASC LIMIT ?
  `).all(threadId, limit);
}

function getBuyerThreads(buyerTelegramId) {
  return db.prepare(`
    SELECT t.*, s.name AS shop_name, s.phone AS shop_phone, m.name AS market_name
    FROM chat_threads t
    JOIN shops s ON s.id = t.shop_id
    JOIN markets m ON m.id = s.market_id
    WHERE t.buyer_telegram_id = ?
    ORDER BY t.last_at DESC
  `).all(String(buyerTelegramId));
}

function getOwnerThreads(ownerId, telegramId) {
  const shops = ownerId
    ? dbModule.getShopsByOwnerId(ownerId)
    : dbModule.getShopsByOwnerTelegram(telegramId);
  const ids = shops.map((s) => s.id);
  if (!ids.length) return [];
  const ph = ids.map(() => '?').join(',');
  return db.prepare(`
    SELECT t.*, s.name AS shop_name, s.phone AS shop_phone
    FROM chat_threads t
    JOIN shops s ON s.id = t.shop_id
    WHERE t.shop_id IN (${ph})
    ORDER BY t.last_at DESC
  `).all(...ids);
}

function getThreadById(id) {
  return db.prepare(`
    SELECT t.*, s.name AS shop_name, s.phone AS shop_phone, s.owner_id, s.owner_telegram_id,
      m.name AS market_name
    FROM chat_threads t
    JOIN shops s ON s.id = t.shop_id
    JOIN markets m ON m.id = s.market_id
    WHERE t.id = ?
  `).get(id);
}

function updateShopHours(shopId, identity, { workOpen, workClose, workDays }) {
  const shop = dbModule.getShopById(shopId);
  if (!shop || !dbModule.shopOwnedBy(shop, identity.telegramId, identity.ownerId)) return null;
  db.prepare(`
    UPDATE shops SET
      work_open = COALESCE(?, work_open),
      work_close = COALESCE(?, work_close),
      work_days = COALESCE(?, work_days)
    WHERE id = ?
  `).run(workOpen ?? null, workClose ?? null, workDays ?? null, shopId);
  return enrichShop(dbModule.getShopById(shopId));
}

function setProductPromo(productId, identity, { isPromo, discountPercent, oldPrice }) {
  const product = dbModule.getProductById(productId);
  if (!product) return null;
  const shop = dbModule.getShopById(product.shop_id);
  if (!shop || !dbModule.shopOwnedBy(shop, identity.telegramId, identity.ownerId)) return null;
  db.prepare(`
    UPDATE products SET
      is_promo = COALESCE(?, is_promo),
      discount_percent = COALESCE(?, discount_percent),
      old_price = COALESCE(?, old_price),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    isPromo !== undefined ? (isPromo ? 1 : 0) : null,
    discountPercent !== undefined ? Number(discountPercent) : null,
    oldPrice !== undefined ? oldPrice : null,
    productId
  );
  return enrichProduct(dbModule.getProductById(productId));
}

function getOwnerStats(ownerId, telegramId) {
  const shops = ownerId
    ? dbModule.getShopsByOwnerId(ownerId)
    : dbModule.getShopsByOwnerTelegram(telegramId);
  const shopIds = shops.map((s) => s.id);
  if (!shopIds.length) {
    return { shops: [], totals: { views: 0, orders: 0, products: 0, reviews: 0, revenue: 0 } };
  }
  const placeholders = shopIds.map(() => '?').join(',');
  const totals = {
    views: db.prepare(`SELECT COALESCE(SUM(views_count),0) AS c FROM shops WHERE id IN (${placeholders})`).get(...shopIds).c,
    orders: db.prepare(`SELECT COUNT(*) AS c FROM orders WHERE shop_id IN (${placeholders})`).get(...shopIds).c,
    products: db.prepare(`SELECT COUNT(*) AS c FROM products WHERE shop_id IN (${placeholders})`).get(...shopIds).c,
    reviews: db.prepare(`SELECT COUNT(*) AS c FROM reviews WHERE shop_id IN (${placeholders})`).get(...shopIds).c,
    revenue: db.prepare(`SELECT COALESCE(SUM(total),0) AS c FROM orders WHERE shop_id IN (${placeholders})`).get(...shopIds).c,
    product_views: db.prepare(`SELECT COALESCE(SUM(views_count),0) AS c FROM products WHERE shop_id IN (${placeholders})`).get(...shopIds).c,
    calls: db.prepare(`SELECT COUNT(*) AS c FROM shop_stats WHERE shop_id IN (${placeholders}) AND event_type = 'call'`).get(...shopIds).c,
  };

  const shopStats = shops.map((s) => {
    const orders = db.prepare('SELECT COUNT(*) AS c, COALESCE(SUM(total),0) AS rev FROM orders WHERE shop_id = ?').get(s.id);
    const products = db.prepare('SELECT COUNT(*) AS c FROM products WHERE shop_id = ?').get(s.id).c;
    const reviews = db.prepare('SELECT COUNT(*) AS c FROM reviews WHERE shop_id = ?').get(s.id).c;
    return {
      ...enrichShop(s),
      orders_count: orders.c,
      revenue: orders.rev,
      products_count: products,
      reviews_count: reviews,
    };
  });

  return { shops: shopStats, totals };
}

function getPendingProducts() {
  return db.prepare(`
    SELECT p.*, s.name AS shop_name, m.name AS market_name
    FROM products p
    JOIN shops s ON s.id = p.shop_id
    JOIN markets m ON m.id = s.market_id
    WHERE COALESCE(p.moderation_status, 'approved') = 'pending'
    ORDER BY p.created_at DESC
  `).all();
}

function setProductModeration(productId, status) {
  if (!['pending', 'approved', 'rejected'].includes(status)) throw new Error('Noto‘g‘ri status');
  db.prepare(`
    UPDATE products SET moderation_status = ?, updated_at = datetime('now') WHERE id = ?
  `).run(status, productId);
  return dbModule.getProductById(productId);
}

function getAdminReport() {
  const base = dbModule.getDashboardStats();
  const orders = db.prepare('SELECT COUNT(*) AS c, COALESCE(SUM(total),0) AS revenue FROM orders').get();
  const reviews = db.prepare('SELECT COUNT(*) AS c, COALESCE(AVG(rating),0) AS avg_r FROM reviews').get();
  const pending = db.prepare(`SELECT COUNT(*) AS c FROM products WHERE moderation_status = 'pending'`).get().c;
  const promo = db.prepare(`SELECT COUNT(*) AS c FROM products WHERE is_promo = 1`).get().c;
  const byMarket = db.prepare(`
    SELECT m.name, m.id,
      (SELECT COUNT(*) FROM shops s WHERE s.market_id = m.id) AS shops,
      (SELECT COUNT(*) FROM products p JOIN shops s ON s.id = p.shop_id WHERE s.market_id = m.id) AS products,
      (SELECT COUNT(*) FROM orders o JOIN shops s ON s.id = o.shop_id WHERE s.market_id = m.id) AS orders
    FROM markets m
    ORDER BY m.name
  `).all();
  const topShops = db.prepare(`
    SELECT s.id, s.name, s.rating_avg, s.rating_count, s.views_count,
      m.name AS market_name,
      (SELECT COUNT(*) FROM orders o WHERE o.shop_id = s.id) AS orders_count,
      (SELECT COALESCE(SUM(total),0) FROM orders o WHERE o.shop_id = s.id) AS revenue
    FROM shops s
    JOIN markets m ON m.id = s.market_id
    ORDER BY orders_count DESC, s.views_count DESC
    LIMIT 10
  `).all();
  const recentOrders = db.prepare(`
    SELECT o.*, s.name AS shop_name
    FROM orders o JOIN shops s ON s.id = o.shop_id
    ORDER BY o.created_at DESC LIMIT 15
  `).all();
  const recentReviews = db.prepare(`
    SELECT r.*, p.name AS product_name, s.name AS shop_name
    FROM reviews r
    JOIN products p ON p.id = r.product_id
    JOIN shops s ON s.id = r.shop_id
    ORDER BY r.created_at DESC LIMIT 15
  `).all();

  return {
    summary: {
      ...base,
      orders: orders.c,
      revenue: orders.revenue,
      reviews: reviews.c,
      avg_rating: Number(reviews.avg_r) || 0,
      pending_moderation: pending,
      promo_products: promo,
    },
    byMarket,
    topShops,
    recentOrders,
    recentReviews,
  };
}

// Patch getDataRevision to include new tables - update via features
const originalGetDataRevision = dbModule.getDataRevision;
dbModule.getDataRevision = function getDataRevision() {
  const base = originalGetDataRevision();
  const extra = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM orders) AS oc,
      (SELECT COUNT(*) FROM reviews) AS rc,
      (SELECT COALESCE(MAX(id),0) FROM orders) AS om,
      (SELECT COALESCE(MAX(id),0) FROM reviews) AS rm,
      (SELECT COUNT(*) FROM products WHERE moderation_status = 'pending') AS pend
  `).get();
  return `${base}|${extra.oc}|${extra.rc}|${extra.om}|${extra.rm}|${extra.pend}`;
};

module.exports = {
  CATEGORIES,
  migrateFeatures,
  isShopOpenNow,
  trackEvent,
  enrichProduct,
  enrichShop,
  searchInMarketFiltered,
  getProductsByShopPublic,
  getAllProductsByShopOwner,
  createOrder,
  getOrderById,
  getOrdersByBuyer,
  getBuyerPurchasedProductIds,
  canReviewProduct,
  createReview,
  replyToReview,
  getOwnerReviews,
  getReviewsForProduct,
  getReviewsForShop,
  sendChatMessage,
  getThreadMessages,
  getBuyerThreads,
  getOwnerThreads,
  getThreadById,
  getOrCreateThread,
  updateShopHours,
  setProductPromo,
  getOwnerStats,
  getPendingProducts,
  setProductModeration,
  getAdminReport,
  getEffectivePrice,
  refreshProductRating,
};
