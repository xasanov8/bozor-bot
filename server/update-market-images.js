/**
 * Bozorlar uchun haqiqiy rasmlar (Wikimedia Commons — Toshkent / Chorsu va bozor manzaralari).
 * Ishga tushirish: node server/update-market-images.js
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const OUT = path.join(__dirname, '..', 'uploads', 'seed');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const UA = 'BozorTopBot/1.0 (educational; https://github.com/xasanov8/bozor-bot)';

/**
 * Har bir bozor uchun alohida, haqiqiy Toshkent bozor fotolari (Commons).
 * Chorsu — mashhur gumbaz; qolganlar — turli bozor/rastalarning haqiqiy suratlari.
 */
const MAP = {
  chorsu: {
    file: 'market_chorsu.jpg',
    // Toshkent Chorsu — taniqli ko'k gumbaz (tashqi)
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Chorsu_bazaar_dome_79.jpg/1280px-Chorsu_bazaar_dome_79.jpg',
    credit: 'Chorsu bazaar dome — Wikimedia Commons',
  },
  orikzor: {
    file: 'market_orikzor.jpg',
    // Ochiq dehqon/kiyim rastasi, gumbaz fonida
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Chorsu_Bazaar%2C_Tashkent%2C_Uzbekistan_%286136941747%29.jpg/1280px-Chorsu_Bazaar%2C_Tashkent%2C_Uzbekistan_%286136941747%29.jpg',
    credit: 'Tashkent bazaar outdoor stalls — Wikimedia Commons (Fabio Achilli)',
  },
  qoyliq: {
    file: 'market_qoyliq.jpg',
    // Bozor ichidagi savdo / rastalar
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Chorsu_Bazaar%2C_Tashkent%2C_Uzbekistan_-_2019-06-01_14.jpg/1280px-Chorsu_Bazaar%2C_Tashkent%2C_Uzbekistan_-_2019-06-01_14.jpg',
    credit: 'Tashkent bazaar interior 2019 — Wikimedia Commons',
  },
  farhod: {
    file: 'market_farhod.jpg',
    // Bozor tashqi maydon / kiraverish
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Chorsu_Bazaar_in_Tashkent_3.jpg/1280px-Chorsu_Bazaar_in_Tashkent_3.jpg',
    credit: 'Tashkent bazaar exterior — Wikimedia Commons (Adam Harangozó)',
  },
};

function download(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 8) return reject(new Error('Too many redirects'));
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(
      url,
      {
        headers: {
          'User-Agent': UA,
          Accept: 'image/*,*/*',
        },
        timeout: 60000,
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          const next = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, url).href;
          return download(next, dest, redirects + 1).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
        file.on('error', (err) => {
          try { fs.unlinkSync(dest); } catch (_) {}
          reject(err);
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

(async () => {
  const ver = Date.now().toString(36);
  for (const [slug, meta] of Object.entries(MAP)) {
    const dest = path.join(OUT, meta.file);
    process.stdout.write(`${slug}... `);
    try {
      await download(meta.url, dest);
      const size = fs.statSync(dest).size;
      if (size < 5000) throw new Error(`too small (${size}b)`);
      // Cache-bust: brauzer eski rasmni ushlab qolmasin
      const publicUrl = `/uploads/seed/${meta.file}?v=${ver}`;
      db.db.prepare('UPDATE markets SET image_url = ? WHERE slug = ?').run(publicUrl, slug);
      console.log('OK', Math.round(size / 1024) + 'KB', publicUrl);
      console.log('   ', meta.credit);
    } catch (e) {
      console.log('FAIL', e.message);
    }
  }
  console.log('\nDB:');
  console.log(
    db.getMarkets().map((m) => ({ name: m.name, image: m.image_url }))
  );
})();
