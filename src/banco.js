const fs = require('fs');
const path = require('path');
const cfg = require('./configuracao');
const { uid, agoraISO, anoMesDia, adicionarDias } = require('./utilidades');
const { gerarHashSenha, CARGOS } = require('./autenticacao');

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function bancoVazio() {
  return {
    meta: { version: 1, createdAt: agoraISO(), updatedAt: agoraISO() },
    users: [],
    companies: [],
    subscriptions: [],
    payments: [],
    launches: [],
    obligations: [],
    notifications: [],
    tickets: [],
    messages: [],
    ticketFeedbacks: [],
    flaggedUsers: [],
    templates: [],
    teamConversations: [],
    teamMessages: [],
    legalAcceptances: [],
    cookieConsents: [],
    auditLogs: []
  };
}

function garantirDiretorios() {
  fs.mkdirSync(path.dirname(cfg.dataFile), { recursive: true });
  fs.mkdirSync(cfg.uploadDir, { recursive: true });
}

function lerBanco() {
  garantirDiretorios();
  if (!fs.existsSync(cfg.dataFile)) {
    const db = bancoVazio();
    semearBase(db);
    escreverBanco(db);
    return db;
  }
  const raw = fs.readFileSync(cfg.dataFile, 'utf8');
  const db = raw ? JSON.parse(raw) : bancoVazio();
  for (const key of Object.keys(bancoVazio())) if (!(key in db)) db[key] = bancoVazio()[key];
  semearBase(db);
  return db;
}

function escreverBanco(db) {
  garantirDiretorios();
  db.meta = db.meta || {};
  db.meta.updatedAt = agoraISO();
  const tmp = `${cfg.dataFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, cfg.dataFile);
}

function comBanco(fn) {
  const db = lerBanco();
  const result = fn(db);
  escreverBanco(db);
  return result;
}

function semearBase(db) {
  const seedUsers = [
    { name: 'Anderson Honorato', email: 'owner@meinocontrole.local', role: CARGOS.OWNER, password: 'Owner@123456!', forcePasswordChange: true },
    { name: 'Equipe Suporte', email: 'suporte@meinocontrole.local', role: CARGOS.SUPPORT, password: 'Suporte@123456!', forcePasswordChange: true },
    { name: 'Equipe Moderação', email: 'moderacao@meinocontrole.local', role: CARGOS.MODERATOR, password: 'Moderacao@123456!', forcePasswordChange: true }
  ];
  for (const item of seedUsers) {
    if (!db.users.some(u => u.email.toLowerCase() === item.email.toLowerCase())) {
      db.users.push({
        id: uid('usr'), name: item.name, email: item.email.toLowerCase(), role: item.role,
        passwordHash: gerarHashSenha(item.password), status: 'active', phone: '', cpfCnpj: '',
        forcePasswordChange: item.forcePasswordChange, createdAt: agoraISO(), updatedAt: agoraISO(), lastLoginAt: null
      });
    }
  }
}

function criarEmpresaPadrao(user, payload = {}) {
  return {
    id: uid('cmp'),
    userId: user.id,
    businessName: payload.businessName || payload.name || 'Meu MEI',
    tradeName: payload.tradeName || 'Meu negócio',
    cnpj: payload.cnpj || '',
    activityType: payload.activityType || 'Serviços',
    annualLimit: Number(payload.annualLimit || 81000),
    dasValue: Number(payload.dasValue || 86.05),
    year: new Date().getFullYear(),
    createdAt: agoraISO(), updatedAt: agoraISO()
  };
}

function criarObrigacoesPadrao(userId, year = new Date().getFullYear(), dasValue = 86.05) {
  return [
    ...MESES.map((month, idx) => ({
      id: uid('obl'), userId, title: `DAS — ${month}/${year}`, type: 'DAS Mensal',
      dueDate: `${year}-${String(idx + 1).padStart(2, '0')}-20`, amount: Number(dasValue),
      status: 'pending', receiptUrl: '', createdAt: agoraISO(), updatedAt: agoraISO()
    })),
    { id: uid('obl'), userId, title: `DASN-SIMEI ${year - 1}`, type: 'DASN-SIMEI Anual',
      dueDate: `${year}-05-31`, amount: 0, status: 'pending', receiptUrl: '', createdAt: agoraISO(), updatedAt: agoraISO() }
  ];
}

function auditar(db, actorId, action, meta = {}) {
  db.auditLogs.push({ id: uid('log'), actorId: actorId || null, action, meta, createdAt: agoraISO() });
}

function adicionarNotificacao(db, userId, type, title, body, key = '', target = null) {
  if (key && db.notifications.some(n => n.userId === userId && n.key === key)) return null;
  const n = { id: uid('ntf'), userId, type, title, body, key, target, read: false, createdAt: agoraISO() };
  db.notifications.push(n);
  return n;
}

function atualizarStatusAssinatura(db, userId) {
  const sub = db.subscriptions.find(s => s.userId === userId);
  if (!sub) return null;
  const now = new Date();
  if (sub.status === 'trialing') {
    const end = new Date(sub.trialEndAt);
    const diffDays = Math.ceil((end - now) / 86400000);
    if (diffDays <= 3 && diffDays > 1) adicionarNotificacao(db, userId, 'billing', 'Seu teste grátis está acabando', `Faltam ${diffDays} dias para a primeira cobrança do seu plano.`, `trial-${userId}-${diffDays}`);
    if (diffDays === 1) adicionarNotificacao(db, userId, 'billing', 'Amanhã começa sua cobrança', 'Seu teste grátis termina amanhã. Confira seu método de pagamento.', `trial-${userId}-1`);
    if (now > end && !sub.lastPaymentConfirmedAt) {
      sub.status = 'past_due';
      sub.updatedAt = agoraISO();
      adicionarNotificacao(db, userId, 'billing', 'Pagamento pendente', 'Seu teste terminou. Regularize a assinatura para liberar todos os recursos.', `trial-ended-${userId}`);
      const owner = db.users.find(u => u.role === CARGOS.OWNER && u.status === 'active');
      if (owner) {
        const user = db.users.find(u => u.id === userId);
        adicionarNotificacao(db, owner.id, 'billing', `Cliente inadimplente: ${user?.name || 'Cliente'}`, 'O teste grátis terminou e o pagamento não foi confirmado.', `overdue-owner-${userId}`, { kind: 'admin', userId });
      }
    }
  }
  if (sub.status === 'active' && sub.nextBillingAt) {
    const next = new Date(sub.nextBillingAt);
    const diffDays = Math.ceil((next - now) / 86400000);
    if (diffDays === 3) adicionarNotificacao(db, userId, 'billing', 'Próxima cobrança em 3 dias', 'Sua assinatura será cobrada em 3 dias.', `billing-${userId}-${sub.nextBillingAt}-3`);
    if (diffDays === 0) adicionarNotificacao(db, userId, 'billing', 'Cobrança programada para hoje', 'Hoje é o dia de renovação do seu plano.', `billing-${userId}-${sub.nextBillingAt}-0`);
  }
  return sub;
}

function contaPermitida(db, userId) {
  const sub = atualizarStatusAssinatura(db, userId);
  if (!sub) return false;
  return ['trialing', 'active'].includes(sub.status);
}

module.exports = {
  MESES,
  bancoVazio,
  lerBanco,
  escreverBanco,
  comBanco,
  criarEmpresaPadrao,
  criarObrigacoesPadrao,
  auditar,
  adicionarNotificacao,
  atualizarStatusAssinatura,
  contaPermitida
};
