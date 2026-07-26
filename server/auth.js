const crypto = require('crypto');

const ownerTokens = new Map(); // token -> { ownerId, phone, name, exp }
const adminTokens = new Map(); // token -> { exp }

const OWNER_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ADMIN_TTL_MS = 12 * 60 * 60 * 1000;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !password) return false;
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(String(password), salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
  } catch {
    return false;
  }
}

function makeToken() {
  return crypto.randomBytes(32).toString('hex');
}

function createOwnerToken(owner) {
  const token = makeToken();
  ownerTokens.set(token, {
    ownerId: owner.id,
    phone: owner.phone,
    name: owner.name,
    exp: Date.now() + OWNER_TTL_MS,
  });
  return token;
}

function getOwnerSession(token) {
  if (!token) return null;
  const s = ownerTokens.get(token);
  if (!s) return null;
  if (Date.now() > s.exp) {
    ownerTokens.delete(token);
    return null;
  }
  return s;
}

function revokeOwnerToken(token) {
  ownerTokens.delete(token);
}

function createAdminToken() {
  const token = makeToken();
  adminTokens.set(token, { exp: Date.now() + ADMIN_TTL_MS });
  return token;
}

function getAdminSession(token) {
  if (!token) return null;
  const s = adminTokens.get(token);
  if (!s) return null;
  if (Date.now() > s.exp) {
    adminTokens.delete(token);
    return null;
  }
  return s;
}

function checkSuperadminPassword(password) {
  const expected = process.env.SUPERADMIN_PASSWORD || 'bozorAdmin2026';
  return String(password) === String(expected);
}

function normalizePhone(phone) {
  let p = String(phone || '').replace(/[\s\-()]/g, '');
  if (p.startsWith('998') && p.length === 12) p = `+${p}`;
  if (p.startsWith('9') && p.length === 9) p = `+998${p}`;
  if (p.startsWith('8') && p.length === 9) p = `+998${p.slice(1)}`; // rare
  if (/^\d{9}$/.test(p)) p = `+998${p}`;
  if (p.startsWith('0') && p.length === 10) p = `+998${p.slice(1)}`;
  return p;
}

function isLocalhost(req) {
  const ip = req.ip || req.socket?.remoteAddress || '';
  const host = req.hostname || '';
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip.endsWith('127.0.0.1')
  );
}

module.exports = {
  hashPassword,
  verifyPassword,
  createOwnerToken,
  getOwnerSession,
  revokeOwnerToken,
  createAdminToken,
  getAdminSession,
  checkSuperadminPassword,
  normalizePhone,
  isLocalhost,
};
