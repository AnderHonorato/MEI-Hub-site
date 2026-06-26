const cfg = require('./configuracao');
const { uid, agoraISO, anoMesDia, adicionarDias } = require('./utilidades');
const { gerarHashSenha, CARGOS } = require('./autenticacao');
const { PARAMETROS_FISCAIS_2026 } = require('./parametrosFiscais');

const MESES = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function clonar(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function normalizarDatas(obj) {
  return JSON.parse(JSON.stringify(obj));
}

async function sincronizarColecao(modeloPrisma, anterior, atual) {
  const idsAntes = new Set(anterior.map(r => r.id));
  const idsDepois = new Set(atual.map(r => r.id));

  const paraCriar = atual.filter(r => !idsAntes.has(r.id));
  const paraExcluir = anterior.filter(r => !idsDepois.has(r.id));
  const paraAtualizar = atual.filter(r => idsAntes.has(r.id));

  if (paraCriar.length) {
    await modeloPrisma.createMany({ data: paraCriar, skipDuplicates: true });
  }
  for (const registro of paraExcluir) {
    await modeloPrisma.delete({ where: { id: registro.id } }).catch(() => {});
  }
  for (const registro of paraAtualizar) {
    await modeloPrisma.update({ where: { id: registro.id }, data: registro }).catch(() => {});
  }
}

async function garantirUsuariosSemente(users) {
  const prisma = require('./prisma');
  const seedItems = [
    { name: 'Anderson Honorato', email: 'owner@meinocontrole.local', role: CARGOS.OWNER, password: 'Owner@123456!', forcePasswordChange: true },
    { name: 'Equipe Suporte', email: 'suporte@meinocontrole.local', role: CARGOS.SUPPORT, password: 'Suporte@123456!', forcePasswordChange: true },
    { name: 'Equipe Moderacao', email: 'moderacao@meinocontrole.local', role: CARGOS.MODERATOR, password: 'Moderacao@123456!', forcePasswordChange: true }
  ];

  for (const item of seedItems) {
    const email = item.email.toLowerCase();
    const exists = users.find(u => u.email === email);
    if (!exists) {
      const novo = {
        id: uid('usr'),
        name: item.name,
        email: email,
        role: item.role,
        passwordHash: gerarHashSenha(item.password),
        status: 'active',
        phone: '',
        cpfCnpj: '',
        forcePasswordChange: item.forcePasswordChange,
        emailVerificado: true,
        avatarUrl: '',
        createdAt: agoraISO(),
        updatedAt: agoraISO(),
        lastLoginAt: null
      };
      await prisma.user.create({ data: novo });
      users.push(novo);
    }
    const user = users.find(u => u.email === email);
    if (user) {
      const legalExistente = await prisma.legalAcceptance.findFirst({ where: { userId: user.id, type: 'terms_privacy' } });
      if (!legalExistente) {
        await prisma.legalAcceptance.create({ data: { id: uid('leg'), userId: user.id, type: 'terms_privacy', version: '2026-06-26', acceptedAt: agoraISO(), ip: '127.0.0.1' } }).catch(() => {});
      }
    }
  }
}

async function lerBanco() {
  const prisma = require('./prisma');
  const [users, companies, subscriptions, payments, launches, obligations,
    notifications, tickets, messages, ticketFeedbacks, flaggedUsers, templates,
    teamConversations, teamMessages, legalAcceptances, cookieConsents, auditLogs
  ] = await Promise.all([
    prisma.user.findMany(), prisma.company.findMany(), prisma.subscription.findMany(),
    prisma.payment.findMany(), prisma.launch.findMany(), prisma.obligation.findMany(),
    prisma.notification.findMany(), prisma.ticket.findMany(), prisma.message.findMany(),
    prisma.ticketFeedback.findMany(), prisma.flaggedUser.findMany(), prisma.template.findMany(),
    prisma.teamConversation.findMany(), prisma.teamMessage.findMany(),
    prisma.legalAcceptance.findMany(), prisma.cookieConsent.findMany(), prisma.auditLog.findMany()
  ]);

  const plainUsers = normalizarDatas(users);
  const plainCompanies = normalizarDatas(companies);
  const plainSubscriptions = normalizarDatas(subscriptions);
  const plainPayments = normalizarDatas(payments);
  const plainLaunches = normalizarDatas(launches);
  const plainObligations = normalizarDatas(obligations);
  const plainNotifications = normalizarDatas(notifications);
  const plainTickets = normalizarDatas(tickets);
  const plainMessages = normalizarDatas(messages);
  const plainTicketFeedbacks = normalizarDatas(ticketFeedbacks);
  const plainFlaggedUsers = normalizarDatas(flaggedUsers);
  const plainTemplates = normalizarDatas(templates);
  const plainTeamConversations = normalizarDatas(teamConversations);
  const plainTeamMessages = normalizarDatas(teamMessages);
  const plainLegalAcceptances = normalizarDatas(legalAcceptances);
  const plainCookieConsents = normalizarDatas(cookieConsents);
  const plainAuditLogs = normalizarDatas(auditLogs);

  await garantirUsuariosSemente(plainUsers);
  // Re-ler legalAcceptances para incluir os criados pela semente
  const legalAtualizados = await prisma.legalAcceptance.findMany();
  const plainLegalAtualizados = normalizarDatas(legalAtualizados);
  for (const l of plainLegalAtualizados) {
    if (!plainLegalAcceptances.some(e => e.id === l.id)) plainLegalAcceptances.push(l);
  }

  const db = {
    meta: { version: 1 },
    users: plainUsers,
    companies: plainCompanies,
    subscriptions: plainSubscriptions,
    payments: plainPayments,
    launches: plainLaunches,
    obligations: plainObligations,
    notifications: plainNotifications,
    tickets: plainTickets,
    messages: plainMessages,
    ticketFeedbacks: plainTicketFeedbacks,
    flaggedUsers: plainFlaggedUsers,
    templates: plainTemplates,
    teamConversations: plainTeamConversations,
    teamMessages: plainTeamMessages,
    legalAcceptances: plainLegalAcceptances,
    cookieConsents: plainCookieConsents,
    auditLogs: plainAuditLogs
  };

  Object.defineProperty(db, '__antes', { value: clonar(db), enumerable: false, writable: true, configurable: true });
  return db;
}

async function escreverBanco(db) {
  const prisma = require('./prisma');
  const antes = db.__antes || {};

  await Promise.all([
    sincronizarColecao(prisma.user, antes.users || [], db.users),
    sincronizarColecao(prisma.company, antes.companies || [], db.companies),
    sincronizarColecao(prisma.subscription, antes.subscriptions || [], db.subscriptions),
    sincronizarColecao(prisma.payment, antes.payments || [], db.payments),
    sincronizarColecao(prisma.launch, antes.launches || [], db.launches),
    sincronizarColecao(prisma.obligation, antes.obligations || [], db.obligations),
    sincronizarColecao(prisma.notification, antes.notifications || [], db.notifications),
    sincronizarColecao(prisma.ticket, antes.tickets || [], db.tickets),
    sincronizarColecao(prisma.message, antes.messages || [], db.messages),
    sincronizarColecao(prisma.ticketFeedback, antes.ticketFeedbacks || [], db.ticketFeedbacks),
    sincronizarColecao(prisma.flaggedUser, antes.flaggedUsers || [], db.flaggedUsers),
    sincronizarColecao(prisma.template, antes.templates || [], db.templates),
    sincronizarColecao(prisma.teamConversation, antes.teamConversations || [], db.teamConversations),
    sincronizarColecao(prisma.teamMessage, antes.teamMessages || [], db.teamMessages),
    sincronizarColecao(prisma.legalAcceptance, antes.legalAcceptances || [], db.legalAcceptances),
    sincronizarColecao(prisma.cookieConsent, antes.cookieConsents || [], db.cookieConsents),
    sincronizarColecao(prisma.auditLog, antes.auditLogs || [], db.auditLogs)
  ]);

  db.__antes = clonar(db);
}

async function comBanco(fn) {
  const db = await lerBanco();
  const result = await fn(db);
  await escreverBanco(db);
  return result;
}

function criarEmpresaPadrao(user, payload = {}) {
  const tipo = payload.activityType || 'Serviços';
  const dasValue = Number(payload.dasValue || PARAMETROS_FISCAIS_2026.dasPorAtividade[tipo] || 80.90);
  const limite = tipo === 'Caminhoneiro' ? PARAMETROS_FISCAIS_2026.limiteAnualCaminhoneiro : PARAMETROS_FISCAIS_2026.limiteAnualPadrao;
  return {
    id: uid('cmp'),
    userId: user.id,
    businessName: payload.businessName || payload.name || 'Meu MEI',
    tradeName: payload.tradeName || 'Meu negócio',
    cnpj: payload.cnpj || '',
    activityType: tipo,
    annualLimit: Number(payload.annualLimit || limite),
    dasValue,
    year: new Date().getFullYear(),
    mesAbertura: new Date().getMonth() + 1,
    createdAt: agoraISO(), updatedAt: agoraISO()
  };
}

function criarObrigacoesPadrao(userId, year = new Date().getFullYear(), dasValue = 86.05) {
  return [
    ...MESES.map((month, idx) => ({
      id: uid('obl'), userId, title: `DAS \u2014 ${month}/${year}`, type: 'DAS Mensal',
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
    if (diffDays <= 3 && diffDays > 1) adicionarNotificacao(db, userId, 'billing', 'Seu teste gratis esta acabando', `Faltam ${diffDays} dias para a primeira cobranca do seu plano.`, `trial-${userId}-${diffDays}`);
    if (diffDays === 1) adicionarNotificacao(db, userId, 'billing', 'Amanha comeca sua cobranca', 'Seu teste gratis termina amanha. Confira seu metodo de pagamento.', `trial-${userId}-1`);
    if (now > end && !sub.lastPaymentConfirmedAt) {
      sub.status = 'past_due';
      sub.updatedAt = agoraISO();
      adicionarNotificacao(db, userId, 'billing', 'Pagamento pendente', 'Seu teste terminou. Regularize a assinatura para liberar todos os recursos.', `trial-ended-${userId}`);
      const owner = db.users.find(u => u.role === CARGOS.OWNER && u.status === 'active');
      if (owner) {
        const user = db.users.find(u => u.id === userId);
        adicionarNotificacao(db, owner.id, 'billing', `Cliente inadimplente: ${user?.name || 'Cliente'}`, 'O teste gratis terminou e o pagamento nao foi confirmado.', `overdue-owner-${userId}`, { kind: 'admin', userId });
      }
    }
  }
  if (sub.status === 'active' && sub.nextBillingAt) {
    const next = new Date(sub.nextBillingAt);
    const diffDays = Math.ceil((next - now) / 86400000);
    if (diffDays === 3) adicionarNotificacao(db, userId, 'billing', 'Proxima cobranca em 3 dias', 'Sua assinatura sera cobrada em 3 dias.', `billing-${userId}-${sub.nextBillingAt}-3`);
    if (diffDays === 0) adicionarNotificacao(db, userId, 'billing', 'Cobranca programada para hoje', 'Hoje e o dia de renovacao do seu plano.', `billing-${userId}-${sub.nextBillingAt}-0`);
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
