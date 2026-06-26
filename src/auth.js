const crypto = require('crypto');
const config = require('./config');
const { jsonBase64url, timingSafeEqual } = require('./utils');

const ROLES = {
  OWNER: 'owner',
  SUPPORT: 'support',
  MODERATOR: 'moderator',
  CUSTOMER: 'customer',
};

const ROLE_LABELS = {
  owner: 'Founder/Owner',
  support: 'Suporte',
  moderator: 'Moderação',
  customer: 'Cliente',
};

const PERMISSIONS = {
  owner: ['*'],
  support: ['support:tickets:read', 'support:tickets:write', 'support:messages:write', 'users:limited:read'],
  moderator: ['moderation:tickets:read', 'moderation:tickets:write', 'moderation:messages:write', 'users:limited:read'],
  customer: ['customer:self', 'customer:tickets:write', 'customer:mei:write'],
};

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, passwordHash) {
  if (!passwordHash || !passwordHash.includes(':')) return false;
  const [salt, hash] = passwordHash.split(':');
  const candidate = hashPassword(password, salt).split(':')[1];
  return timingSafeEqual(hash, candidate);
}

function signToken(payload, expiresSeconds = 60 * 60 * 12) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresSeconds;
  const body = { ...payload, exp };
  const unsigned = `${jsonBase64url(header)}.${jsonBase64url(body)}`;
  const sig = crypto.createHmac('sha256', config.jwtSecret).update(unsigned).digest('base64url');
  return `${unsigned}.${sig}`;
}

function verifyToken(token) {
  try {
    const [h, p, s] = String(token || '').split('.');
    if (!h || !p || !s) return null;
    const unsigned = `${h}.${p}`;
    const expected = crypto.createHmac('sha256', config.jwtSecret).update(unsigned).digest('base64url');
    if (!timingSafeEqual(s, expected)) return null;
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function hasPermission(user, permission) {
  const perms = PERMISSIONS[user?.role] || [];
  return perms.includes('*') || perms.includes(permission);
}

function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return { ...safe, roleLabel: ROLE_LABELS[user.role] || user.role };
}

module.exports = { ROLES, ROLE_LABELS, PERMISSIONS, hashPassword, verifyPassword, signToken, verifyToken, hasPermission, publicUser };
