/**
 * Har bir do'konga alohida egasi (login telefon + parol) biriktiradi.
 */
const db = require('./db');
const { hashPassword, normalizePhone } = require('./auth');

function uniquePhone(preferred, shopId) {
  let phone = normalizePhone(preferred);
  if (!/^\+\d{10,15}$/.test(phone)) {
    phone = `+99890${String(1000000 + shopId).slice(-7)}`;
  }
  // agar band bo'lsa boshqa raqam
  let n = 0;
  let candidate = phone;
  while (true) {
    const existing = db.getOwnerByPhone(candidate);
    if (!existing) return candidate;
    // boshqa do'konga tegishli bo'lsa — yangi raqam
    const shops = db.getShopsByOwnerId(existing.id);
    if (shops.length === 1 && shops[0].id === shopId) return candidate;
    n += 1;
    candidate = `+99890${String(1000000 + shopId * 10 + n).slice(-7)}`;
    if (n > 50) {
      candidate = `+99899${String(Date.now()).slice(-7)}`;
      if (!db.getOwnerByPhone(candidate)) return candidate;
    }
  }
}

function makePassword(shopId) {
  // oddiy, eslab qolinadigan: shop01, shop02...
  return `shop${String(shopId).padStart(2, '0')}`;
}

const shops = db.db.prepare(`
  SELECT s.*, m.name AS market_name
  FROM shops s
  JOIN markets m ON m.id = s.market_id
  ORDER BY s.id
`).all();

const results = [];

for (const shop of shops) {
  const loginPhone = uniquePhone(shop.phone, shop.id);
  const password = makePassword(shop.id);
  const ownerName = `${shop.name} egasi`;

  // Mavjud egasi shu do'konga yolg'iz bog'langanmi?
  let owner = null;
  if (shop.owner_id) {
    const current = db.getOwnerById(shop.owner_id);
    const owned = current ? db.getShopsByOwnerId(current.id) : [];
    if (current && owned.length === 1 && owned[0].id === shop.id) {
      // faqat shu do'kon — parol/telefon yangilash
      owner = db.updateOwnerPassword(current.id, hashPassword(password), password);
      if (current.phone !== loginPhone && !db.getOwnerByPhone(loginPhone)) {
        db.db.prepare('UPDATE owners SET phone = ?, name = ? WHERE id = ?')
          .run(loginPhone, ownerName, current.id);
        owner = db.getOwnerById(current.id);
      } else {
        db.db.prepare('UPDATE owners SET name = ? WHERE id = ?').run(ownerName, current.id);
        owner = db.getOwnerById(current.id);
      }
    }
  }

  if (!owner) {
    // yangi egasi
    if (db.getOwnerByPhone(loginPhone)) {
      // telefon band — boshqa raqam
      const alt = uniquePhone(`+99891${String(1000000 + shop.id).slice(-7)}`, shop.id);
      owner = db.createOwner({
        phone: alt,
        passwordHash: hashPassword(password),
        passwordPlain: password,
        name: ownerName,
      });
    } else {
      owner = db.createOwner({
        phone: loginPhone,
        passwordHash: hashPassword(password),
        passwordPlain: password,
        name: ownerName,
      });
    }
    // eski schemada owner_telegram_id NOT NULL bo'lishi mumkin
    db.db.prepare(`UPDATE shops SET owner_id = ?, owner_telegram_id = COALESCE(owner_telegram_id, '') WHERE id = ?`)
      .run(owner.id, shop.id);
    db.db.prepare('UPDATE shops SET owner_id = ? WHERE id = ?').run(owner.id, shop.id);
  }

  const final = db.getOwnerById(owner.id);
  results.push({
    shop_id: shop.id,
    shop: shop.name,
    market: shop.market_name,
    login: final.phone,
    password: final.password_plain,
  });
  console.log(`${shop.name.padEnd(28)} | ${final.phone} | ${final.password_plain}`);
}

// Bo'sh qolgan umumiy demo egasini olib tashlash (do'konsiz)
const orphans = db.db.prepare(`
  SELECT o.id, o.phone FROM owners o
  WHERE NOT EXISTS (SELECT 1 FROM shops s WHERE s.owner_id = o.id)
`).all();
for (const o of orphans) {
  db.db.prepare('DELETE FROM owners WHERE id = ?').run(o.id);
  console.log('O‘chirildi (do‘konsiz egasi):', o.phone);
}

console.log('\nJami:', results.length, "do'kon — har biri alohida login/parol");
console.log(JSON.stringify(results, null, 2));
