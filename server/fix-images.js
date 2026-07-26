const https = require('https');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const OUT = path.join(__dirname, '..', 'uploads', 'seed');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlink(dest, () => {});
          return download(res.headers.location, dest).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          file.close();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      })
      .on('error', reject);
  });
}

const fixes = [
  ['kulcha', 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&q=80&auto=format&fit=crop'],
  ['dishes', 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=600&q=80&auto=format&fit=crop'],
  ['shirt2', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80&auto=format&fit=crop'],
];

async function main() {
  for (const [key, url] of fixes) {
    const dest = path.join(OUT, `${key}.jpg`);
    process.stdout.write(`${key}... `);
    try {
      await download(url, dest);
      console.log('OK');
    } catch (e) {
      console.log(e.message);
    }
  }

  const rules = [
    [/kulcha/i, '/uploads/seed/kulcha.jpg'],
    [/idish/i, '/uploads/seed/dishes.jpg'],
    [/erkak/i, '/uploads/seed/shirt2.jpg'],
    [/ko.?ylak/i, '/uploads/seed/shirt.jpg'],
  ];

  const products = db.db.prepare('SELECT id, name, image_url FROM products').all();
  const upd = db.db.prepare('UPDATE products SET image_url = ? WHERE id = ?');

  for (const p of products) {
    if (p.image_url) continue;
    for (const [re, url] of rules) {
      if (re.test(p.name)) {
        upd.run(url, p.id);
        console.log('fixed', p.name);
        break;
      }
    }
  }

  const left = db.db
    .prepare("SELECT id, name FROM products WHERE image_url IS NULL OR image_url = ''")
    .all();
  for (const p of left) {
    upd.run('/uploads/seed/market_orikzor.jpg', p.id);
    console.log('fallback', p.name);
  }

  const stats = {
    products: db.db.prepare('SELECT COUNT(*) AS c FROM products WHERE image_url IS NOT NULL').get().c,
    shops: db.db.prepare('SELECT COUNT(*) AS c FROM shops WHERE image_url IS NOT NULL').get().c,
    markets: db.db.prepare('SELECT COUNT(*) AS c FROM markets WHERE image_url IS NOT NULL').get().c,
  };
  console.log('Stats:', stats);
}

main().catch(console.error);
