/**
 * Internetdan real rasmlarni yuklab, bozor/do'kon/mahsulotlarga biriktiradi.
 * Manba: Unsplash (bekinish rasmlar, tijorat uchun Unsplash litsenziyasi).
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const db = require('./db');

const OUT = path.join(__dirname, '..', 'uploads', 'seed');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

/** Unsplash CDN — real food / market photos */
const IMAGES = {
  // Markets
  market_orikzor: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800&q=80&auto=format&fit=crop',
  market_chorsu: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80&auto=format&fit=crop',
  market_qoyliq: 'https://images.unsplash.com/photo-1533900298318-6b8da08a523e?w=800&q=80&auto=format&fit=crop',
  market_farhod: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80&auto=format&fit=crop',

  // Shops
  shop_fruit: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=600&q=80&auto=format&fit=crop',
  shop_bread: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80&auto=format&fit=crop',
  shop_meat: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=600&q=80&auto=format&fit=crop',
  shop_grain: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&q=80&auto=format&fit=crop',
  shop_spice: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&q=80&auto=format&fit=crop',
  shop_tea: 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=600&q=80&auto=format&fit=crop',
  shop_clothes: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&q=80&auto=format&fit=crop',
  shop_home: 'https://images.unsplash.com/photo-1556911220-bff31c812dba?w=600&q=80&auto=format&fit=crop',

  // Products
  apple: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600&q=80&auto=format&fit=crop',
  banana: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600&q=80&auto=format&fit=crop',
  tomato: 'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=600&q=80&auto=format&fit=crop',
  cucumber: 'https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?w=600&q=80&auto=format&fit=crop',
  apricot: 'https://images.unsplash.com/photo-1628352081506-83c43123ed6d?w=600&q=80&auto=format&fit=crop',
  bread_patir: 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=600&q=80&auto=format&fit=crop',
  bread_obi: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80&auto=format&fit=crop',
  samsa: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&q=80&auto=format&fit=crop',
  kulcha: 'https://images.unsplash.com/photo-1585478259715-876acc5be8eb?w=600&q=80&auto=format&fit=crop',
  beef: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=600&q=80&auto=format&fit=crop',
  lamb: 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=600&q=80&auto=format&fit=crop',
  chicken: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=600&q=80&auto=format&fit=crop',
  liver: 'https://images.unsplash.com/photo-1615937691194-97dbd3f3dc29?w=600&q=80&auto=format&fit=crop',
  rice_devzira: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&q=80&auto=format&fit=crop',
  rice_lazer: 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=600&q=80&auto=format&fit=crop',
  flour: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=600&q=80&auto=format&fit=crop',
  chickpea: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=600&q=80&auto=format&fit=crop',
  cumin: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&q=80&auto=format&fit=crop',
  pepper: 'https://images.unsplash.com/photo-1506368249639-73a05d6f6488?w=600&q=80&auto=format&fit=crop',
  almond: 'https://images.unsplash.com/photo-1508747703725-719777637510?w=600&q=80&auto=format&fit=crop',
  raisin: 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=600&q=80&auto=format&fit=crop',
  black_tea: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&q=80&auto=format&fit=crop',
  green_tea: 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=600&q=80&auto=format&fit=crop',
  honey: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600&q=80&auto=format&fit=crop',
  shirt: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&q=80&auto=format&fit=crop',
  sneakers: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80&auto=format&fit=crop',
  bag: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&q=80&auto=format&fit=crop',
  bucket: 'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=600&q=80&auto=format&fit=crop',
  dishes: 'https://images.unsplash.com/photo-1603199506016-b9a694b5162d?w=600&q=80&auto=format&fit=crop',
  teapot: 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=600&q=80&auto=format&fit=crop',
};

const PRODUCT_MAP = [
  { match: /olma/i, key: 'apple' },
  { match: /banan/i, key: 'banana' },
  { match: /pomidor/i, key: 'tomato' },
  { match: /bodring/i, key: 'cucumber' },
  { match: /o['']?rik|o‘rik|oʻrik/i, key: 'apricot' },
  { match: /patir/i, key: 'bread_patir' },
  { match: /obi non/i, key: 'bread_obi' },
  { match: /somsa/i, key: 'samsa' },
  { match: /kulcha/i, key: 'kulcha' },
  { match: /mol go/i, key: 'beef' },
  { match: /qo['']?y go|qo‘y|qoʻy/i, key: 'lamb' },
  { match: /tovuq/i, key: 'chicken' },
  { match: /jigar/i, key: 'liver' },
  { match: /devzira/i, key: 'rice_devzira' },
  { match: /lazer/i, key: 'rice_lazer' },
  { match: /un\b|bug/i, key: 'flour' },
  { match: /noxat/i, key: 'chickpea' },
  { match: /zira/i, key: 'cumin' },
  { match: /murch/i, key: 'pepper' },
  { match: /bodom/i, key: 'almond' },
  { match: /mayiz/i, key: 'raisin' },
  { match: /qora choy/i, key: 'black_tea' },
  { match: /ko['']?k choy|ko‘k|koʻk/i, key: 'green_tea' },
  { match: /asal/i, key: 'honey' },
  { match: /ko['']?ylak|ko‘ylak|koʻylak/i, key: 'shirt' },
  { match: /poyabzal/i, key: 'sneakers' },
  { match: /sumka/i, key: 'bag' },
  { match: /chelak/i, key: 'bucket' },
  { match: /idish/i, key: 'dishes' },
  { match: /choynak/i, key: 'teapot' },
];

const SHOP_MAP = [
  { match: /meva/i, key: 'shop_fruit' },
  { match: /non/i, key: 'shop_bread' },
  { match: /go['']?sht|go‘sht|goʻsht/i, key: 'shop_meat' },
  { match: /guruch|don/i, key: 'shop_grain' },
  { match: /ziravor/i, key: 'shop_spice' },
  { match: /choy/i, key: 'shop_tea' },
  { match: /kiyim/i, key: 'shop_clothes' },
  { match: /ro['']?zg|uy/i, key: 'shop_home' },
];

const MARKET_MAP = {
  orikzor: 'market_orikzor',
  chorsu: 'market_chorsu',
  qoyliq: 'market_qoyliq',
  farhod: 'market_farhod',
};

function download(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
      return resolve(dest);
    }
    const file = fs.createWriteStream(dest);
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) BozorBot/1.0',
          Accept: 'image/*,*/*',
        },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlink(dest, () => {});
          return download(res.headers.location, dest).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(dest, () => {});
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve(dest)));
      }
    );
    req.on('error', (err) => {
      file.close();
      fs.unlink(dest, () => {});
      reject(err);
    });
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

async function ensureAll() {
  const local = {};
  for (const [key, url] of Object.entries(IMAGES)) {
    const dest = path.join(OUT, `${key}.jpg`);
    process.stdout.write(`Yuklanmoqda: ${key}... `);
    try {
      await download(url, dest);
      local[key] = `/uploads/seed/${key}.jpg`;
      console.log('OK');
    } catch (err) {
      console.log('FAIL', err.message);
    }
  }
  return local;
}

function matchKey(name, rules) {
  for (const r of rules) {
    if (r.match.test(name)) return r.key;
  }
  return null;
}

async function main() {
  console.log('Rasmlar yuklanmoqda...\n');
  const local = await ensureAll();

  // Markets
  const markets = db.db.prepare('SELECT id, slug, name FROM markets').all();
  const updMarket = db.db.prepare('UPDATE markets SET image_url = ? WHERE id = ?');
  for (const m of markets) {
    const key = MARKET_MAP[m.slug];
    if (key && local[key]) {
      updMarket.run(local[key], m.id);
      console.log(`Bozor rasm: ${m.name}`);
    }
  }

  // Shops
  const shops = db.db.prepare('SELECT id, name FROM shops').all();
  const updShop = db.db.prepare('UPDATE shops SET image_url = ? WHERE id = ?');
  for (const s of shops) {
    const key = matchKey(s.name, SHOP_MAP);
    if (key && local[key]) {
      updShop.run(local[key], s.id);
      console.log(`Do'kon rasm: ${s.name}`);
    }
  }

  // Products
  const products = db.db.prepare('SELECT id, name FROM products').all();
  const updProduct = db.db.prepare('UPDATE products SET image_url = ? WHERE id = ?');
  let n = 0;
  for (const p of products) {
    const key = matchKey(p.name, PRODUCT_MAP);
    if (key && local[key]) {
      updProduct.run(local[key], p.id);
      n++;
      console.log(`Mahsulot rasm: ${p.name}`);
    }
  }

  console.log(`\nTayyor: ${n} mahsulot, ${shops.length} do'kon, ${markets.length} bozor yangilandi.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
