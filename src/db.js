const fs = require('fs');
const path = require('path');
const config = require('./config');
const { uid, nowISO, yyyyMmDd, addDays } = require('./utils');
const { hashPassword, ROLES } = require('./auth');

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function emptyDb() {
  return {
    meta: { version: 1, createdAt: nowISO(), updatedAt: nowISO() },
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
    teamConversations: [],
    teamMessages: [],
    legalAcceptances: [],
    cookieConsents: [],
    auditLogs: []
  };
}

function ensureDirs() {
  fs.mkdirSync(path.dirname(config.dataFile), { recursive: true });
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

function readDb() {
  ensureDirs();
  if (!fs.existsSync(config.dataFile)) {
    const db = emptyDb();
    seedBase(db);
    writeDb(db);
    return db;
  }
  const raw = fs.readFileSync(config.dataFile, 'utf8');
  const db = raw ? JSON.parse(raw) : emptyDb();
  for (const key of Object.keys(emptyDb())) if (!(key in db)) db[key] = emptyDb()[key];
  seedBase(db);
  return db;
}

function writeDb(db) {
  ensureDirs();
  db.meta = db.meta || {};
  db.meta.updatedAt = nowISO();
  const tmp = `${config.dataFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, config.dataFile);
}

function withDb(fn) {
  const db = readDb();
  const result = fn(db);
  writeDb(db);
  return result;
}

function seedBase(db) {
  const seedUsers = [
    { name: 'Anderson Honorato', email: 'owner@meinocontrole.local', role: ROLES.OWNER, password: 'Owner@123456!', forcePasswordChange: true },
    { name: 'Equipe Suporte', email: 'suporte@meinocontrole.local', role: ROLES.SUPPORT, password: 'Suporte@123456!', forcePasswordChange: true },
    { name: 'Equipe Moderação', email: 'moderacao@meinocontrole.local', role: ROLES.MODERATOR, password: 'Moderacao@123456!', forcePasswordChange: true }
  ];
  for (const item of seedUsers) {
    if (!db.users.some(u => u.email.toLowerCase() === item.email.toLowerCase())) {
      db.users.push({
        id: uid('usr'), name: item.name, email: item.email.toLowerCase(), role: item.role,
        passwordHash: hashPassword(item.password), status: 'active', phone: '', cpfCnpj: '',
        forcePasswordChange: item.forcePasswordChange, createdAt: nowISO(), updatedAt: nowISO(), lastLoginAt: null
      });
    }
  }
}

function createDefaultCompany(user, payload = {}) {
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
    createdAt: nowISO(), updatedAt: nowISO()
  };
}

function createDefaultObligations(userId, year = new Date().getFullYear(), dasValue = 86.05) {
  return [
    ...MESES.map((month, idx) => ({
      id: uid('obl'), userId, title: `DAS — ${month}/${year}`, type: 'DAS Mensal',
      dueDate: `${year}-${String(idx + 1).padStart(2, '0')}-20`, amount: Number(dasValue),
      status: 'pending', receiptUrl: '', createdAt: nowISO(), updatedAt: nowISO()
    })),
    { id: uid('obl'), userId, title: `DASN-SIMEI ${year - 1}`, type: 'DASN-SIMEI Anual',
      dueDate: `${year}-05-31`, amount: 0, status: 'pending', receiptUrl: '', createdAt: nowISO(), updatedAt: nowISO() }
  ];
}

function audit(db, actorId, action, meta = {}) {
  db.auditLogs.push({ id: uid('log'), actorId: actorId || null, action, meta, createdAt: nowISO() });
}

function addNotification(db, userId, type, title, body, key = '', target = null) {
  if (key && db.notifications.some(n => n.userId === userId && n.key === key)) return null;
  const n = { id: uid('ntf'), userId, type, title, body, key, target, read: false, createdAt: nowISO() };
  db.notifications.push(n);
  return n;
}

function refreshSubscriptionStatus(db, userId) {
  const sub = db.subscriptions.find(s => s.userId === userId);
  if (!sub) return null;
  const now = new Date();
  if (sub.status === 'trialing') {
    const end = new Date(sub.trialEndAt);
    const diffDays = Math.ceil((end - now) / 86400000);
    if (diffDays <= 3 && diffDays > 1) addNotification(db, userId, 'billing', 'Seu teste grátis está acabando', `Faltam ${diffDays} dias para a primeira cobrança do seu plano.`, `trial-${userId}-${diffDays}`);
    if (diffDays === 1) addNotification(db, userId, 'billing', 'Amanhã começa sua cobrança', 'Seu teste grátis termina amanhã. Confira seu método de pagamento.', `trial-${userId}-1`);
    if (now > end && !sub.lastPaymentConfirmedAt) {
      sub.status = 'past_due';
      sub.updatedAt = nowISO();
      addNotification(db, userId, 'billing', 'Pagamento pendente', 'Seu teste terminou. Regularize a assinatura para liberar todos os recursos.', `trial-ended-${userId}`);
      const owner = db.users.find(u => u.role === ROLES.OWNER && u.status === 'active');
      if (owner) {
        const user = db.users.find(u => u.id === userId);
        addNotification(db, owner.id, 'billing', `Cliente inadimplente: ${user?.name || 'Cliente'}`, 'O teste grátis terminou e o pagamento não foi confirmado.', `overdue-owner-${userId}`, { kind: 'admin', userId });
      }
    }
  }
  if (sub.status === 'active' && sub.nextBillingAt) {
    const next = new Date(sub.nextBillingAt);
    const diffDays = Math.ceil((next - now) / 86400000);
    if (diffDays === 3) addNotification(db, userId, 'billing', 'Próxima cobrança em 3 dias', 'Sua assinatura será cobrada em 3 dias.', `billing-${userId}-${sub.nextBillingAt}-3`);
    if (diffDays === 0) addNotification(db, userId, 'billing', 'Cobrança programada para hoje', 'Hoje é o dia de renovação do seu plano.', `billing-${userId}-${sub.nextBillingAt}-0`);
  }
  return sub;
}

function isAccountAllowed(db, userId) {
  const sub = refreshSubscriptionStatus(db, userId);
  if (!sub) return false;
  return ['trialing', 'active'].includes(sub.status);
}

module.exports = {
  MESES,
  emptyDb,
  readDb,
  writeDb,
  withDb,
  createDefaultCompany,
  createDefaultObligations,
  audit,
  addNotification,
  refreshSubscriptionStatus,
  isAccountAllowed
};
