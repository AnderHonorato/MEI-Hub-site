const crypto = require('crypto');

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function gerarSegredoBase32() {
  const bytes = crypto.randomBytes(20);
  return base32Codificar(bytes);
}

function base32Codificar(buffer) {
  let bits = '', saida = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
  for (let i = 0; i + 5 <= bits.length; i += 5) saida += ALFABETO[parseInt(bits.slice(i, i + 5), 2)];
  return saida;
}

function base32Decodificar(texto) {
  const limpo = String(texto || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const c of limpo) {
    const idx = ALFABETO.indexOf(c);
    if (idx < 0) continue;
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function gerarCodigoTotp(segredoBase32, passoUnix = Math.floor(Date.now() / 30000)) {
  const chave = base32Decodificar(segredoBase32);
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(passoUnix));
  const hmac = crypto.createHmac('sha1', chave).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const codigo = ((hmac[offset] & 0x7f) << 24 | (hmac[offset + 1] & 0xff) << 16 |
    (hmac[offset + 2] & 0xff) << 8 | (hmac[offset + 3] & 0xff)) % 1000000;
  return String(codigo).padStart(6, '0');
}

function verificarCodigoTotp(segredoBase32, codigoDigitado) {
  const segredo = String(segredoBase32 || '').trim().toUpperCase().replace(/[^A-Z2-7]/g, '');
  if (!segredo) return false;
  const passoAtual = Math.floor(Date.now() / 30000);
  for (const offset of [-3, -2, -1, 0, 1, 2, 3]) {
    if (gerarCodigoTotp(segredo, passoAtual + offset) === String(codigoDigitado).trim()) return true;
  }
  return false;
}

module.exports = { gerarSegredoBase32, gerarCodigoTotp, verificarCodigoTotp };
