const https = require('https');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const OUT = path.join(__dirname, '..', 'uploads', 'seed');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const MAP = {
  orikzor: {
    file: 'market_orikzor.jpg',
    url: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=900&q=80&auto=format&fit=crop',
  },
  chorsu: {
    file: 'market_chorsu.jpg',
    url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=900&q=80&auto=format&fit=crop',
  },
  qoyliq: {
    file: 'market_qoyliq.jpg',
    url: 'https://images.unsplash.com/photo-1533900298318-6b8da08a523e?w=900&q=80&auto=format&fit=crop',
  },
  farhod: {
    file: 'market_farhod.jpg',
    url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=900&q=80&auto=format&fit=crop',
  },
};

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, { headers: { 'User-Agent': 'Mozilla/5.0 BozorBot/1.0' } }, (res) => {
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

(async () => {
  for (const [slug, meta] of Object.entries(MAP)) {
    const dest = path.join(OUT, meta.file);
    process.stdout.write(`${slug}... `);
    try {
      await download(meta.url, dest);
      const url = `/uploads/seed/${meta.file}`;
      db.db.prepare('UPDATE markets SET image_url = ? WHERE slug = ?').run(url, slug);
      console.log('OK', url);
    } catch (e) {
      console.log('FAIL', e.message);
    }
  }
  console.log(db.getMarkets().map((m) => ({ name: m.name, image: m.image_url })));
})();
