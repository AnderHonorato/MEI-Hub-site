const crypto = require('crypto');

function nowISO() { return new Date().toISOString(); }
function uid(prefix = 'id') { return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`; }
function onlyDigits(v = '') { return String(v).replace(/\D/g, ''); }
function money(v) { return Number(Number(v || 0).toFixed(2)); }
function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
function yyyyMmDd(date) { return new Date(date).toISOString().slice(0, 10); }
function safeString(value, max = 5000) { return String(value || '').trim().slice(0, max); }
function protocol(prefix, count) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}-${date}-${String(count + 1).padStart(5, '0')}`;
}
function parseBool(v) { return v === true || v === 'true' || v === 1 || v === '1'; }
function base64url(input) { return Buffer.from(input).toString('base64url'); }
function jsonBase64url(obj) { return base64url(JSON.stringify(obj)); }
function timingSafeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

module.exports = { nowISO, uid, onlyDigits, money, addDays, yyyyMmDd, safeString, protocol, parseBool, base64url, jsonBase64url, timingSafeEqual };
