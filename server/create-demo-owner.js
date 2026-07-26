/**
 * Mavjud demo do'konlarga bitta egasi bog'lash
 * Telefon: +998901112233
 * Parol: owner123
 */
require('dotenv').config();
const db = require('./db');
const { hashPassword, normalizePhone } = require('./auth');

const phone = normalizePhone('+998901112233');
const password = 'owner123';
const name = 'Demo Do\'kon Egasi';

let owner = db.getOwnerByPhone(phone);
if (!owner) {
  owner = db.createOwner({
    phone,
    passwordHash: hashPassword(password),
    name,
  });
  console.log('Owner yaratildi:', phone, password);
} else {
  console.log('Owner allaqachon bor:', phone);
}

// O'rikzor do'konlarini shu egaga biriktirish
const shops = db.db.prepare("SELECT id, name FROM shops WHERE market_id = 1").all();
const upd = db.db.prepare('UPDATE shops SET owner_id = ? WHERE id = ?');
for (const s of shops) {
  upd.run(owner.id, s.id);
  console.log('  bog\'landi:', s.name);
}

console.log('\nKirish (bot): Do\'kon egasiman →', phone, '→', password);
