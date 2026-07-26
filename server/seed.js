/**
 * Demo ma'lumotlar — O'rikzor va boshqa bozorlar, do'konlar, mahsulotlar
 */
require('dotenv').config();
const db = require('./db');

function seed() {
  const marketsCount = db.db.prepare('SELECT COUNT(*) AS c FROM markets').get().c;
  if (marketsCount > 0) {
    console.log('Ma\'lumotlar allaqachon mavjud. Qayta seed qilish uchun data/bozor.db ni o\'chiring.');
    return;
  }

  const markets = [
    {
      name: "O'rikzor",
      slug: 'orikzor',
      description: "Toshkentdagi yirik dehqon bozori. Meva-sabzavot, oziq-ovqat va uy-ro'zg'or mollari.",
      city: 'Toshkent',
      address: "Toshkent sh., O'rikzor massivi",
      imageUrl: '/uploads/seed/market_orikzor.jpg',
    },
    {
      name: 'Chorsu',
      slug: 'chorsu',
      description: 'Tarixiy bozor — ziravorlar, quruq mevalar, milliy taomlar.',
      city: 'Toshkent',
      address: 'Toshkent sh., Chorsu maydoni',
      imageUrl: '/uploads/seed/market_chorsu.jpg',
    },
    {
      name: 'Qoʻyliq',
      slug: 'qoyliq',
      description: "Yirik oziq-ovqat va kiyim-kechak bozori.",
      city: 'Toshkent',
      address: "Toshkent sh., Qo'yliq",
      imageUrl: '/uploads/seed/market_qoyliq.jpg',
    },
    {
      name: 'Farhod',
      slug: 'farhod',
      description: 'Sergeli tumanidagi katta bozor.',
      city: 'Toshkent',
      address: 'Toshkent sh., Sergeli',
      imageUrl: '/uploads/seed/market_farhod.jpg',
    },
  ];

  const marketIds = {};
  for (const m of markets) {
    const created = db.createMarket(m);
    marketIds[m.slug] = created.id;
    console.log(`Bozor: ${m.name}`);
  }

  const ownerId = '100001'; // demo egasi

  const shopsData = [
    {
      market: 'orikzor',
      name: "Sifat Meva",
      phone: '+998901112233',
      address: "O'rikzor, 12-qator, 5-do'kon",
      description: 'Yangi meva va sabzavotlar',
      products: [
        { name: 'Olma (qizil)', price: 12000, unit: 'kg', description: 'Toza, shirin' },
        { name: 'Banan', price: 22000, unit: 'kg', description: 'Import' },
        { name: 'Pomidor', price: 8000, unit: 'kg', description: 'Issiqxona' },
        { name: 'Bodring', price: 7000, unit: 'kg' },
        { name: "O'rik", price: 15000, unit: 'kg', description: 'Mavsumiy' },
      ],
    },
    {
      market: 'orikzor',
      name: "Nonvoyxonai Farhod",
      phone: '+998933334455',
      address: "O'rikzor, kirish qismi, 2-blok",
      description: 'Yangi non va pishiriqlar',
      products: [
        { name: 'Patir non', price: 4000, unit: 'dona' },
        { name: 'Obi non', price: 3500, unit: 'dona' },
        { name: 'Somsa (goʻshtli)', price: 8000, unit: 'dona' },
        { name: 'Kulcha', price: 5000, unit: 'dona' },
      ],
    },
    {
      market: 'orikzor',
      name: "Go'sht Markazi",
      phone: '+998907778899',
      address: "O'rikzor, go'sht bo'limi, 8-joy",
      description: "Mol va qo'y go'shti",
      products: [
        { name: "Mol go'shti", price: 95000, unit: 'kg' },
        { name: "Qo'y go'shti", price: 110000, unit: 'kg' },
        { name: 'Tovuq', price: 38000, unit: 'kg' },
        { name: 'Jigar', price: 45000, unit: 'kg' },
      ],
    },
    {
      market: 'orikzor',
      name: 'Guruch va Don',
      phone: '+998941234567',
      address: "O'rikzor, 3-qator, 18",
      description: 'Guruch, un, yorma',
      products: [
        { name: 'Devzira guruch', price: 28000, unit: 'kg' },
        { name: 'Lazer guruch', price: 18000, unit: 'kg' },
        { name: 'Bugʻdoy uni', price: 9000, unit: 'kg' },
        { name: 'Noxat', price: 16000, unit: 'kg' },
      ],
    },
    {
      market: 'chorsu',
      name: 'Ziravorlar Dunyosi',
      phone: '+998909998877',
      address: 'Chorsu, ziravorlar qatori',
      description: 'Zira, murch, quruq meva',
      products: [
        { name: 'Zira', price: 45000, unit: 'kg' },
        { name: 'Qora murch', price: 120000, unit: 'kg' },
        { name: 'Bodom', price: 95000, unit: 'kg' },
        { name: 'Mayiz', price: 55000, unit: 'kg' },
      ],
    },
    {
      market: 'chorsu',
      name: 'Sariq Choyxona Mollari',
      phone: '+998971112244',
      address: 'Chorsu, 4-yoʻlak',
      products: [
        { name: 'Qora choy', price: 85000, unit: 'kg' },
        { name: 'Koʻk choy', price: 70000, unit: 'kg' },
        { name: 'Asal', price: 120000, unit: 'kg' },
      ],
    },
    {
      market: 'qoyliq',
      name: 'Kiyim Savdo',
      phone: '+998901234567',
      address: "Qo'yliq, kiyim bo'limi B-12",
      products: [
        { name: "Erkaklar ko'ylagi", price: 180000, unit: 'dona' },
        { name: 'Sport poyabzal', price: 320000, unit: 'juft' },
        { name: 'Ayollar sumkasi', price: 150000, unit: 'dona' },
      ],
    },
    {
      market: 'farhod',
      name: 'Uy-roʻzgʻor',
      phone: '+998935551122',
      address: 'Farhod bozor, 7-qator',
      products: [
        { name: 'Plastik chelak', price: 25000, unit: 'dona' },
        { name: 'Idish-tovoq toʻplami', price: 180000, unit: 'komplekt' },
        { name: 'Choynak', price: 45000, unit: 'dona' },
      ],
    },
  ];

  for (const s of shopsData) {
    const shop = db.createShop({
      marketId: marketIds[s.market],
      ownerTelegramId: ownerId,
      name: s.name,
      phone: s.phone,
      address: s.address,
      description: s.description || null,
      imageUrl: null,
    });
    for (const p of s.products) {
      db.createProduct({
        shopId: shop.id,
        name: p.name,
        description: p.description || null,
        price: p.price,
        unit: p.unit || 'dona',
        imageUrl: null,
      });
    }
    console.log(`  Do'kon: ${s.name} (${s.products.length} mahsulot)`);
  }

  console.log('\nSeed tayyor! npm start bilan ishga tushiring.');
}

seed();
