const crypto = require('crypto');

function agoraISO() { return new Date().toISOString(); }
function uid(prefixo = 'id') { return `${prefixo}_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`; }
function apenasDigitos(v = '') { return String(v).replace(/\D/g, ''); }
function dinheiro(v) { return Number(Number(v || 0).toFixed(2)); }
function adicionarDias(data, dias) { const d = new Date(data); d.setDate(d.getDate() + dias); return d; }
function anoMesDia(data) { return new Date(data).toISOString().slice(0, 10); }
function textoLimpo(valor, maximo = 5000) { return String(valor || '').trim().slice(0, maximo); }
function protocolo(prefixo, quantidade) {
  const data = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefixo}-${data}-${String(quantidade + 1).padStart(5, '0')}`;
}
function analisarBooleano(v) { return v === true || v === 'true' || v === 1 || v === '1'; }
function base64url(entrada) { return Buffer.from(entrada).toString('base64url'); }
function jsonBase64url(obj) { return base64url(JSON.stringify(obj)); }
function comparacaoTempoSeguro(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

module.exports = {
  agoraISO, uid, apenasDigitos, dinheiro, adicionarDias, anoMesDia, textoLimpo, protocolo,
  analisarBooleano, base64url, jsonBase64url, comparacaoTempoSeguro,
  // aliases para compatibilidade
  nowISO: agoraISO, onlyDigits: apenasDigitos, money: dinheiro,
  addDays: adicionarDias, yyyyMmDd: anoMesDia, safeString: textoLimpo,
  protocol: protocolo, parseBool: analisarBooleano, timingSafeEqual: comparacaoTempoSeguro
};
