const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cfg = require('./configuracao');
const { lerBanco, escreverBanco, comBanco, criarEmpresaPadrao, criarObrigacoesPadrao, auditar, adicionarNotificacao, atualizarStatusAssinatura, contaPermitida, MESES } = require('./banco');
const { gerarHashSenha, verificarSenha, assinarToken, verificarToken, temPermissao, usuarioPublico, CARGOS } = require('./autenticacao');
const { uid, agoraISO, apenasDigitos, dinheiro, adicionarDias, anoMesDia, textoLimpo, protocolo } = require('./utilidades');
const { criarCheckout, criarLinkPagamento } = require('./asaas');

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml'
};

function send(res, status, payload, headers = {}) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': typeof payload === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8', ...headers });
  res.end(body);
}
function ok(res, data = {}) { send(res, 200, { ok: true, ...data }); }
function fail(res, status, message, extra = {}) { send(res, status, { ok: false, message, ...extra }); }

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    const limit = Math.max(1, cfg.maxUploadMb + 1) * 1024 * 1024;
    req.on('data', chunk => {
      raw += chunk;
      if (Buffer.byteLength(raw) > limit) {
        reject(Object.assign(new Error('Payload muito grande.'), { status: 413 }));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(Object.assign(new Error('JSON inválido.'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function getAuthUser(req, db) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const payload = verificarToken(token);
  if (!payload?.userId) return null;
  const user = db.users.find(u => u.id === payload.userId && u.status === 'active');
  if (user) atualizarStatusAssinatura(db, user.id);
  return user || null;
}
function requireAuth(req, res, db) {
  const user = getAuthUser(req, db);
  if (!user) fail(res, 401, 'Acesso não autorizado. Faça login novamente.');
  return user;
}
function requireRole(user, roles, res) {
  if (!roles.includes(user.role)) { fail(res, 403, 'Você não tem permissão para esta ação.'); return false; }
  return true;
}
function requireActivePlan(user, db, res) {
  if ([CARGOS.OWNER, CARGOS.SUPPORT, CARGOS.MODERATOR].includes(user.role)) return true;
  if (!contaPermitida(db, user.id)) { fail(res, 402, 'Plano inativo ou teste pendente. Regularize sua assinatura para acessar este recurso.'); return false; }
  return true;
}

function saveAttachmentFromDataUrl(userId, dataUrl, originalName = 'imagem') {
  if (!dataUrl) return null;
  const match = String(dataUrl).match(/^data:(image\/(png|jpe?g|webp|gif));base64,(.+)$/i);
  if (!match) throw Object.assign(new Error('Anexo inválido. Envie imagem PNG, JPG, WEBP ou GIF.'), { status: 400 });
  const mime = match[1].toLowerCase();
  const ext = mime.includes('png') ? '.png' : mime.includes('webp') ? '.webp' : mime.includes('gif') ? '.gif' : '.jpg';
  const base64 = match[3];
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > cfg.maxUploadMb * 1024 * 1024) throw Object.assign(new Error(`Imagem maior que ${cfg.maxUploadMb}MB.`), { status: 413 });
  const safeName = textoLimpo(originalName, 60).replace(/[^a-z0-9_.-]/gi, '-').toLowerCase();
  const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName || 'imagem'}${ext}`;
  const userDir = path.join(cfg.uploadDir, userId);
  fs.mkdirSync(userDir, { recursive: true });
  const filePath = path.join(userDir, filename);
  fs.writeFileSync(filePath, buffer);
  return { url: `/uploads/${userId}/${filename}`, mime, name: originalName, size: buffer.length };
}

function companyFor(db, userId) { const c = db.companies.find(c => c.userId === userId) || null; if (!c) return null; return { ...c, nomeNegocio: c.businessName, nomeFantasia: c.tradeName, tipoAtividade: c.activityType, limiteAnual: c.annualLimit, valorDas: c.dasValue, criadoEm: c.createdAt }; }
function subscriptionFor(db, userId) { const s = atualizarStatusAssinatura(db, userId); if (!s) return null; return { ...s, nomePlano: s.planName, preco: s.price, fimTesteEm: s.trialEndAt, inicioTesteEm: s.trialStartAt, proximaCobrancaEm: s.nextBillingAt, urlCheckout: s.checkoutUrl }; }
const EQUIPE = [CARGOS.OWNER, CARGOS.SUPPORT, CARGOS.MODERATOR];
const BADGES = { owner: 'Fundador', support: 'Suporte', moderator: 'Moderador', customer: 'Cliente' };

function isStaff(user) { return EQUIPE.includes(user?.role); }
function initials(name = '') {
  return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'U';
}
function feedbackForAssignee(db, userId) {
  const rows = db.ticketFeedbacks.filter(f => f.assigneeId === userId);
  if (!rows.length) return { ratingAvg: 0, ratingCount: 0 };
  const avg = rows.reduce((sum, f) => sum + Number(f.rating || 0), 0) / rows.length;
  return { ratingAvg: Number(avg.toFixed(1)), ratingCount: rows.length };
}
function exposeUser(db, user) {
  const safe = usuarioPublico(user);
  if (!safe) return null;
  const stats = feedbackForAssignee(db, user.id);
  const s = db.flaggedUsers.filter(f => f.userId === user.id);
  return {
    ...safe, ...stats,
    nome: safe.name, cargo: safe.role, email: safe.email, telefone: safe.phone, cpfCnpj: safe.cpfCnpj,
    criadoEm: safe.createdAt, ultimoLoginEm: safe.lastLoginAt, atualizadoEm: safe.updatedAt,
    rotuloCargo: safe.roleLabel, forcarTrocaSenha: safe.forcePasswordChange,
    mediaAvaliacao: stats.ratingAvg, quantidadeAvaliacoes: stats.ratingCount,
    marcadorRotulo: BADGES[user.role] || safe.roleLabel || user.role,
    iniciais: initials(user.name), avatarUrl: user.avatarUrl || '',
    sinalizado: s.length > 0
  };
}
function exposeMessage(db, message) {
  return {
    ...message,
    texto: message.text, remetente: exposeUser(db, db.users.find(u => u.id === message.senderId)),
    anexo: message.attachment, criadoEm: message.createdAt, sistema: message.system,
    sender: exposeUser(db, db.users.find(u => u.id === message.senderId))
  };
}
function ticketStatusRank(status) {
  return ({ open: 0, in_progress: 1, closed: 2 }[status] ?? 3);
}
function compareTickets(a, b) {
  const urgent = Number(b.priority === 'urgent') - Number(a.priority === 'urgent');
  if (urgent) return urgent;
  const status = ticketStatusRank(a.status) - ticketStatusRank(b.status);
  if (status) return status;
  if (a.status === 'closed' || b.status === 'closed') return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
  return new Date(a.createdAt) - new Date(b.createdAt);
}
function exposeTicket(db, ticket) {
  if (!ticket) return null;
  const feedback = db.ticketFeedbacks.find(f => f.ticketId === ticket.id) || null;
  return {
    ...ticket,
    titulo: ticket.title, categoria: ticket.category, protocolo: ticket.protocol,
    tipo: ticket.type, prioridade: ticket.priority, status: ticket.status,
    criadoEm: ticket.createdAt, atualizadoEm: ticket.updatedAt,
    cliente: exposeUser(db, db.users.find(u => u.id === ticket.customerId)),
    atendente: exposeUser(db, db.users.find(u => u.id === ticket.assigneeId)),
    fechadoPor: exposeUser(db, db.users.find(u => u.id === ticket.closedBy)),
    feedback
  };
}
function estimateQueue(db, ticket) {
  const open = db.tickets.filter(t => t.type === ticket.type && t.status === 'open').sort(compareTickets);
  const index = Math.max(0, open.findIndex(t => t.id === ticket.id));
  const unit = ticket.priority === 'urgent' ? 3 : 5;
  return Math.max(unit, (index + 1) * unit);
}
function queueInfoFor(db, ticket) {
  if (!ticket || ticket.status !== 'open') return null;
  const open = db.tickets.filter(t => t.type === ticket.type && t.status === 'open').sort(compareTickets);
  const index = Math.max(0, open.findIndex(t => t.id === ticket.id));
  const usersAhead = Math.max(0, index);
  const estimatedMinutes = Number(ticket.estimatedMinutes || estimateQueue(db, ticket));
  const waitedMinutes = Math.floor((Date.now() - new Date(ticket.createdAt).getTime()) / 60000);
  const delayed = waitedMinutes > estimatedMinutes;
  return {
    usersAhead, estimatedMinutes, waitedMinutes, delayed,
    usuariosNaFrente: usersAhead, minutosEstimados: estimatedMinutes, minutosAguardados: waitedMinutes, atrasado: delayed,
    message: delayed
      ? 'Desculpe a demora, estou dando prioridade para sua solicitação.'
      : `Tempo para ser atendido em ${estimatedMinutes} minutos, usuários na fila ${usersAhead}.`,
    mensagem: delayed
      ? 'Desculpe a demora, estou dando prioridade para sua solicitação.'
      : `Tempo para ser atendido em ${estimatedMinutes} minutos, usuários na fila ${usersAhead}.`
  };
}
function mentionsPriority(text = '') {
  return /\b(prioridade|urgente|urgência|emergencial)\b/i.test(String(text));
}
function markTicketUrgent(db, ticket, actorId) {
  if (!ticket || ticket.priority === 'urgent') return false;
  ticket.priority = 'urgent';
  ticket.urgentAt = agoraISO();
  ticket.updatedAt = agoraISO();
  auditar(db, actorId, 'ticket.priority.urgent', { ticketId: ticket.id });
  return true;
}
function ticketTarget(ticket) {
  return ticket ? { kind: 'ticket', ticketId: ticket.id, ticketType: ticket.type } : null;
}
function notificationTargetFor(db, notification) {
  if (notification.target) return notification.target;
  if (notification.type === 'billing') return { kind: 'billing' };
  if (['ticket', 'feedback'].includes(notification.type)) {
    const text = `${notification.title || ''} ${notification.body || ''}`;
    const protocolMatch = text.match(/\b(SUP|MOD)-\d{8}-\d{5}\b/);
    const ticket = protocolMatch ? db.tickets.find(t => t.protocol === protocolMatch[0]) : null;
    return ticketTarget(ticket);
  }
  if (notification.type === 'team-chat') {
    const msgMatch = String(notification.key || '').match(/team-msg-(tmsg_[a-z0-9]+)/i);
    const message = msgMatch ? db.teamMessages.find(m => m.id === msgMatch[1]) : null;
    return message ? { kind: 'team-chat', conversationId: message.conversationId } : null;
  }
  return null;
}
function exposeNotification(db, notification) {
  return {
    ...notification,
    titulo: notification.title, corpo: notification.body, lida: notification.read,
    tipo: notification.type, criadoEm: notification.createdAt,
    target: notificationTargetFor(db, notification)
  };
}
function notifyTicketTeam(db, ticket, title, body, key) {
  const allowed = ticket.type === 'report' ? [CARGOS.OWNER, CARGOS.MODERATOR] : [CARGOS.OWNER, CARGOS.SUPPORT];
  db.users.filter(u => allowed.includes(u.role) && u.status === 'active').forEach(u => adicionarNotificacao(db, u.id, 'ticket', title, body, `${key}-${u.id}`, ticketTarget(ticket)));
}
function ticketFeedbackFor(db, ticketId, userId) {
  return db.ticketFeedbacks.find(f => f.ticketId === ticketId && f.customerId === userId) || null;
}
function canSeeFeedback(user, feedback, db) {
  if (user.role === CARGOS.OWNER) return true;
  const ticket = db.tickets.find(t => t.id === feedback.ticketId);
  return !!ticket && canAccessTicket(user, ticket);
}
function activeMembership(conversation, userId) {
  const members = normalizeConversationMembers(conversation);
  return members.find(m => m.userId === userId && !m.removedAt) || null;
}
function normalizeConversationMembers(conversation) {
  if (!conversation.members) {
    const ids = conversation.memberIds || [];
    conversation.members = ids.map(userId => ({ userId, joinedAt: conversation.createdAt || agoraISO(), removedAt: null }));
  }
  return conversation.members;
}
function exposeConversation(db, conversation, viewerId) {
  normalizeConversationMembers(conversation);
  const membership = activeMembership(conversation, viewerId);
  const visibleMessages = db.teamMessages.filter(m => m.conversationId === conversation.id && (!membership || new Date(m.createdAt) >= new Date(membership.joinedAt)));
  const lastMessage = visibleMessages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
  return {
    ...conversation,
    titulo: conversation.title, tipo: conversation.type,
    memberIds: conversation.members.filter(m => !m.removedAt).map(m => m.userId),
    membros: conversation.members.filter(m => !m.removedAt).map(m => exposeUser(db, db.users.find(u => u.id === m.userId))),
    members: conversation.members.filter(m => !m.removedAt).map(m => exposeUser(db, db.users.find(u => u.id === m.userId))),
    ultimaMensagem: lastMessage ? exposeMessage(db, lastMessage) : null,
    lastMessage: lastMessage ? exposeMessage(db, lastMessage) : null
  };
}
function canAccessTeamConversation(conversation, user) {
  if (!isStaff(user)) return false;
  return !!activeMembership(conversation, user.id) && !(conversation.deletedFor || []).includes(user.id);
}

function dashboardData(db, userId) {
  const company = companyFor(db, userId);
  const year = Number(company?.year || new Date().getFullYear());
  let acc = 0;
  const launches = db.launches.filter(l => l.userId === userId && new Date(l.date).getFullYear() === year);
  const months = MESES.map((name, idx) => {
    const month = idx + 1;
    const monthLaunches = launches.filter(l => new Date(`${l.date}T12:00:00`).getMonth() + 1 === month);
    const revenue = dinheiro(monthLaunches.filter(l => l.type === 'revenue').reduce((s, l) => s + Number(l.amount || 0), 0));
    const expenses = dinheiro(monthLaunches.filter(l => l.type === 'expense').reduce((s, l) => s + Number(l.amount || 0), 0));
    acc = dinheiro(acc + revenue);
    const percent = Math.round((acc / Number(company?.annualLimit || 81000)) * 100);
    return { month, nome: name, receita: revenue, despesas: expenses, acumulado: acc, percentual: percent, name, revenue, expenses, accumulated: acc, percent, status: percent > 100 ? 'limit_exceeded' : percent > 80 ? 'warning' : 'ok' };
  });
  const current = months[new Date().getMonth()];
  const obligations = db.obligations.filter(o => o.userId === userId).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  const pendingObligations = obligations.filter(o => o.status !== 'paid').slice(0, 8);
  return {
    empresa: company, ano: year, meses: months, atual: current, obrigacoes: pendingObligations.map(o => ({ ...o, titulo: o.title, dataVencimento: o.dueDate, valor: o.amount, urlComprovante: o.receiptUrl, tipo: o.type })), lancamentos: launches.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 12).map(l => ({ ...l, data: l.date, titulo: l.title, tipo: l.type, categoria: l.category, valor: l.amount })),
    company, year, months, current, launches: launches.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 12), obligations: pendingObligations
  };
}

function canAccessTicket(user, ticket) {
  if (user.role === CARGOS.OWNER) return true;
  if (user.role === CARGOS.CUSTOMER) return ticket.customerId === user.id;
  if (user.role === CARGOS.SUPPORT) return ticket.type === 'support';
  if (user.role === CARGOS.MODERATOR) return ticket.type === 'report';
  return false;
}

function ticketPrefix(type) { return type === 'report' ? 'MOD' : 'SUP'; }

async function handleApi(req, res, url) {
  const pathname = url.pathname;
  const method = req.method;
  const db = lerBanco();

  try {
    if (method === 'GET' && pathname === '/api/health') {
      return ok(res, { status: 'online', time: agoraISO(), paymentMode: cfg.paymentMock ? 'mock' : 'asaas', version: '1.0.0' });
    }

    if (method === 'GET' && pathname === '/api/legal/texts') {
      return ok(res, { texts: legalTexts() });
    }

    if (method === 'POST' && pathname === '/api/auth/register') {
      const body = await readBody(req);
      const name = textoLimpo(body.name, 120);
      const email = textoLimpo(body.email, 180).toLowerCase();
      const password = String(body.password || '');
      const cnpj = apenasDigitos(body.cnpj || '');
      if (!name || !email.includes('@') || password.length < 8) return fail(res, 400, 'Informe nome, e-mail válido e senha com no mínimo 8 caracteres.');
      if (!body.acceptTerms) return fail(res, 400, 'É necessário aceitar os Termos de Uso e a Política de Privacidade.');
      if (db.users.some(u => u.email === email)) return fail(res, 409, 'Já existe uma conta com este e-mail.');
      const user = { id: uid('usr'), name, email, role: CARGOS.CUSTOMER, passwordHash: gerarHashSenha(password), status: 'active', phone: textoLimpo(body.phone, 30), cpfCnpj: cnpj, forcePasswordChange: false, createdAt: agoraISO(), updatedAt: agoraISO(), lastLoginAt: null };
      db.users.push(user);
      const company = criarEmpresaPadrao(user, { businessName: body.businessName || name, tradeName: body.tradeName || 'Meu negócio', cnpj, activityType: body.activityType || 'Serviços' });
      db.companies.push(company);
      db.obligations.push(...criarObrigacoesPadrao(user.id, company.year, company.dasValue));
      db.subscriptions.push({ id: uid('sub'), userId: user.id, provider: cfg.paymentMock ? 'mock' : 'asaas', status: 'pending_checkout', planName: cfg.planName, price: cfg.planPrice, trialStartAt: null, trialEndAt: null, nextBillingAt: null, externalId: '', checkoutUrl: '', lastPaymentConfirmedAt: null, createdAt: agoraISO(), updatedAt: agoraISO() });
      db.legalAcceptances.push({ id: uid('leg'), userId: user.id, type: 'terms_privacy', version: legalTexts().version, acceptedAt: agoraISO(), ip: req.socket.remoteAddress || '' });
      auditar(db, user.id, 'auth.register', { email });
      escreverBanco(db);
      const token = assinarToken({ userId: user.id, role: user.role });
      return ok(res, { user: exposeUser(db, user), company, subscription: subscriptionFor(db, user.id), token });
    }

    if (method === 'POST' && pathname === '/api/auth/login') {
      const body = await readBody(req);
      const email = textoLimpo(body.email, 180).toLowerCase();
      const user = db.users.find(u => u.email === email && u.status === 'active');
      if (!user || !verificarSenha(body.password || '', user.passwordHash)) return fail(res, 401, 'E-mail ou senha inválidos.');
      user.lastLoginAt = agoraISO(); user.updatedAt = agoraISO();
      atualizarStatusAssinatura(db, user.id);
      auditar(db, user.id, 'auth.login', { email });
      escreverBanco(db);
      const token = assinarToken({ userId: user.id, role: user.role });
      return ok(res, { user: exposeUser(db, user), company: companyFor(db, user.id), subscription: subscriptionFor(db, user.id), token });
    }

    if (pathname === '/api/webhooks/asaas' && method === 'POST') {
      const token = url.searchParams.get('token') || req.headers['x-webhook-token'] || '';
      if (cfg.asaasWebhookToken && token !== cfg.asaasWebhookToken) return fail(res, 401, 'Webhook não autorizado.');
      const body = await readBody(req);
      const event = body.event || body.type || '';
      const payment = body.payment || body.checkout || body.subscription || body;
      const ext = payment.externalReference || payment.external_reference || payment.id || '';
      const sub = db.subscriptions.find(s => s.id === ext || s.externalId === payment.subscription || s.providerCheckoutId === payment.checkoutId || s.providerCheckoutId === payment.id);
      if (sub) {
        const paidEvents = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'CHECKOUT_COMPLETED', 'SUBSCRIPTION_CREATED', 'SUBSCRIPTION_UPDATED'];
        const overdueEvents = ['PAYMENT_OVERDUE', 'PAYMENT_DELETED'];
        if (paidEvents.includes(event)) {
          sub.status = sub.trialEndAt && new Date(sub.trialEndAt) > new Date() ? 'trialing' : 'active';
          sub.lastPaymentConfirmedAt = agoraISO();
          sub.nextBillingAt = payment.nextDueDate || sub.nextBillingAt || anoMesDia(adicionarDias(new Date(), 30));
          sub.externalId = payment.subscription || payment.id || sub.externalId;
          adicionarNotificacao(db, sub.userId, 'billing', 'Pagamento confirmado', 'Sua assinatura está ativa. Obrigado por manter seu MEI no controle.', `pay-${payment.id || Date.now()}`);
        }
        if (overdueEvents.includes(event)) {
          sub.status = 'past_due';
          adicionarNotificacao(db, sub.userId, 'billing', 'Pagamento não confirmado', 'Não conseguimos confirmar sua cobrança. Atualize seu método de pagamento.', `overdue-${payment.id || Date.now()}`);
          const owner = db.users.find(u => u.role === CARGOS.OWNER && u.status === 'active');
          if (owner) {
            const overdueUser = db.users.find(u => u.id === sub.userId);
            adicionarNotificacao(db, owner.id, 'billing', `Cliente inadimplente: ${overdueUser?.name || 'Cliente'}`, 'Pagamento não confirmado pelo gateway.', `overdue-owner-${sub.userId}-${payment.id || Date.now()}`, { kind: 'admin', userId: sub.userId });
          }
        }
        sub.updatedAt = agoraISO();
        db.payments.push({ id: uid('pay'), userId: sub.userId, subscriptionId: sub.id, provider: 'asaas', event, amount: Number(payment.value || cfg.planPrice), status: payment.status || event, externalId: payment.id || '', payload: body, createdAt: agoraISO() });
      }
      escreverBanco(db);
      return ok(res, { received: true });
    }

    const user = requireAuth(req, res, db);
    if (!user) return;

    if (method === 'GET' && pathname === '/api/me') {
      escreverBanco(db);
      return ok(res, { user: exposeUser(db, user), company: companyFor(db, user.id), subscription: subscriptionFor(db, user.id), notifications: db.notifications.filter(n => n.userId === user.id).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,30).map(n => exposeNotification(db, n)), legal: legalTexts() });
    }

    if (method === 'POST' && pathname === '/api/notifications/read') {
      const body = await readBody(req);
      const ids = Array.isArray(body.ids) ? body.ids : [];
      db.notifications.forEach(n => { if (n.userId === user.id && (ids.length === 0 || ids.includes(n.id))) n.read = true; });
      escreverBanco(db); return ok(res);
    }

    if (method === 'POST' && pathname === '/api/cookies/consent') {
      const body = await readBody(req);
      db.cookieConsents.push({ id: uid('ck'), userId: user.id, necessary: true, analytics: !!body.analytics, marketing: !!body.marketing, version: legalTexts().version, createdAt: agoraISO() });
      escreverBanco(db); return ok(res);
    }

    if (method === 'PUT' && pathname === '/api/account/profile') {
      const body = await readBody(req);
      const name = textoLimpo(body.name, 120);
      const phone = textoLimpo(body.phone, 30);
      if (name) user.name = name;
      if (phone || body.phone === '') user.phone = phone;
      if (body.avatarDataUrl) {
        const avatar = saveAttachmentFromDataUrl(user.id, body.avatarDataUrl, body.avatarName || 'perfil');
        user.avatarUrl = avatar.url;
      }
      user.updatedAt = agoraISO();
      auditar(db, user.id, 'account.profile.update', {});
      escreverBanco(db);
      return ok(res, { user: exposeUser(db, user) });
    }

    if (method === 'POST' && pathname === '/api/billing/start-trial') {
      if (user.role !== CARGOS.CUSTOMER) return fail(res, 400, 'Assinatura é necessária apenas para clientes.');
      let sub = db.subscriptions.find(s => s.userId === user.id);
      if (!sub) { sub = { id: uid('sub'), userId: user.id, provider: cfg.paymentMock ? 'mock' : 'asaas', status: 'pending_checkout', planName: cfg.planName, price: cfg.planPrice, createdAt: agoraISO(), updatedAt: agoraISO() }; db.subscriptions.push(sub); }
      if (['trialing', 'active'].includes(sub.status)) return ok(res, { subscription: sub, checkoutUrl: sub.checkoutUrl || '' });
      const trialStart = agoraISO();
      const trialEnd = adicionarDias(new Date(), cfg.trialDays).toISOString();
      if (cfg.paymentMock) {
        sub.status = 'trialing'; sub.trialStartAt = trialStart; sub.trialEndAt = trialEnd; sub.nextBillingAt = trialEnd; sub.checkoutUrl = ''; sub.updatedAt = agoraISO();
        adicionarNotificacao(db, user.id, 'billing', 'Teste grátis iniciado', `Seu teste grátis de ${cfg.trialDays} dias foi ativado.`, `trial-start-${user.id}`);
        auditar(db, user.id, 'billing.trial.mock_start', { subscriptionId: sub.id });
        escreverBanco(db);
        return ok(res, { subscription: sub, checkoutUrl: '', message: 'Teste grátis ativado no modo local. Em produção, desative PAYMENT_MOCK e configure o Asaas.' });
      }
      const company = companyFor(db, user.id);
      const checkout = await createCheckout({ user, company, subscriptionId: sub.id }).catch(async (err) => {
        if (err.status === 404 || err.status === 400) return createPaymentLink({ user, company, subscriptionId: sub.id });
        throw err;
      });
      sub.status = 'pending_checkout'; sub.provider = 'asaas'; sub.providerCheckoutId = checkout.providerCheckoutId; sub.checkoutUrl = checkout.checkoutUrl; sub.trialStartAt = trialStart; sub.trialEndAt = trialEnd; sub.nextBillingAt = trialEnd; sub.updatedAt = agoraISO();
      auditar(db, user.id, 'billing.checkout.created', { subscriptionId: sub.id, providerCheckoutId: sub.providerCheckoutId });
      escreverBanco(db);
      return ok(res, { subscription: sub, checkoutUrl: checkout.checkoutUrl });
    }

    if (method === 'GET' && pathname === '/api/billing/status') {
      escreverBanco(db);
      return ok(res, { subscription: subscriptionFor(db, user.id), payments: db.payments.filter(p => p.userId === user.id).slice(-12).reverse() });
    }

    if (method === 'POST' && pathname === '/api/billing/cancel') {
      const sub = db.subscriptions.find(s => s.userId === user.id);
      if (!sub) return fail(res, 404, 'Assinatura não encontrada.');
      if (sub.status === 'past_due') return fail(res, 409, 'Existe pagamento pendente. Regularize antes de encerrar a assinatura.');
      sub.status = 'canceled'; sub.canceledAt = agoraISO(); sub.updatedAt = agoraISO();
      adicionarNotificacao(db, user.id, 'billing', 'Assinatura cancelada', 'Seu plano foi cancelado. Seus dados continuam disponíveis para exportação e exclusão conforme a LGPD.', `cancel-${sub.id}`);
      auditar(db, user.id, 'billing.cancel', { subscriptionId: sub.id });
      escreverBanco(db); return ok(res, { subscription: sub });
    }

    if (method === 'POST' && pathname === '/api/account/delete-request') {
      const sub = db.subscriptions.find(s => s.userId === user.id);
      if (sub && sub.status === 'past_due') return fail(res, 409, 'Não é possível excluir a conta com pagamento pendente. Regularize a cobrança ou fale com o suporte.');
      user.status = 'deleted'; user.deletedAt = agoraISO(); user.email = `deleted-${user.id}@deleted.local`; user.updatedAt = agoraISO();
      auditar(db, user.id, 'account.delete_request', {});
      escreverBanco(db); return ok(res, { message: 'Conta marcada para exclusão. Dados obrigatórios poderão ser retidos pelo prazo legal.' });
    }

    if (method === 'GET' && pathname === '/api/dashboard') {
      if (!requireActivePlan(user, db, res)) return;
      escreverBanco(db);
      return ok(res, dashboardData(db, user.id));
    }

    if (method === 'GET' && pathname === '/api/launches') {
      if (!requireActivePlan(user, db, res)) return;
      const rows = db.launches.filter(l => l.userId === user.id).sort((a,b)=>new Date(b.date)-new Date(a.date));
      return ok(res, { launches: rows.map(l => ({ ...l, data: l.date, titulo: l.title, tipo: l.type, categoria: l.category, valor: l.amount })) });
    }

    if (method === 'POST' && pathname === '/api/launches') {
      if (!requireActivePlan(user, db, res)) return;
      const body = await readBody(req);
      const launch = { id: uid('lan'), userId: user.id, title: textoLimpo(body.title, 150), date: body.date || anoMesDia(new Date()), type: body.type === 'expense' ? 'expense' : 'revenue', category: textoLimpo(body.category, 80) || 'Prestação de Serviço', amount: dinheiro(body.amount), contactName: textoLimpo(body.contactName, 120), invoiceIssued: !!body.invoiceIssued, paymentMethod: textoLimpo(body.paymentMethod, 40) || 'Pix', notes: textoLimpo(body.notes, 1000), createdAt: agoraISO(), updatedAt: agoraISO() };
      if (!launch.title || launch.amount <= 0) return fail(res, 400, 'Informe descrição e valor maior que zero.');
      db.launches.push(launch); auditar(db, user.id, 'launch.create', { launchId: launch.id }); escreverBanco(db); return ok(res, { launch });
    }

    const launchDelete = pathname.match(/^\/api\/launches\/([^/]+)$/);
    if (launchDelete && method === 'DELETE') {
      if (!requireActivePlan(user, db, res)) return;
      const id = launchDelete[1];
      const before = db.launches.length;
      db.launches = db.launches.filter(l => !(l.id === id && l.userId === user.id));
      if (db.launches.length === before) return fail(res, 404, 'Lançamento não encontrado.');
      auditar(db, user.id, 'launch.delete', { launchId: id }); escreverBanco(db); return ok(res);
    }

    if (method === 'GET' && pathname === '/api/obligations') {
      if (!requireActivePlan(user, db, res)) return;
      return ok(res, { obligations: db.obligations.filter(o => o.userId === user.id).sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate)).map(o => ({ ...o, titulo: o.title, dataVencimento: o.dueDate, valor: o.amount, urlComprovante: o.receiptUrl, tipo: o.type })) });
    }

    const obligationPatch = pathname.match(/^\/api\/obligations\/([^/]+)$/);
    if (obligationPatch && method === 'PATCH') {
      if (!requireActivePlan(user, db, res)) return;
      const body = await readBody(req);
      const item = db.obligations.find(o => o.id === obligationPatch[1] && o.userId === user.id);
      if (!item) return fail(res, 404, 'Obrigação não encontrada.');
      if (['pending','paid','late'].includes(body.status)) item.status = body.status;
      if (body.receiptDataUrl) item.receiptUrl = saveAttachmentFromDataUrl(user.id, body.receiptDataUrl, body.receiptName || 'comprovante')?.url || item.receiptUrl;
      item.updatedAt = agoraISO(); auditar(db, user.id, 'obligation.update', { obligationId: item.id, status: item.status }); escreverBanco(db); return ok(res, { obligation: item });
    }

    if (method === 'GET' && pathname === '/api/company') {
      return ok(res, { company: companyFor(db, user.id) });
    }
    if (method === 'PUT' && pathname === '/api/company') {
      const body = await readBody(req);
      let company = companyFor(db, user.id);
      if (!company) { company = criarEmpresaPadrao(user, body); db.companies.push(company); }
      company.businessName = textoLimpo(body.businessName, 160) || company.businessName;
      company.tradeName = textoLimpo(body.tradeName, 160) || company.tradeName;
      company.cnpj = apenasDigitos(body.cnpj || company.cnpj);
      company.activityType = textoLimpo(body.activityType, 80) || company.activityType;
      company.annualLimit = Number(body.annualLimit || company.annualLimit || 81000);
      company.dasValue = Number(body.dasValue || company.dasValue || 86.05);
      company.updatedAt = agoraISO();
      auditar(db, user.id, 'company.update', { companyId: company.id }); escreverBanco(db); return ok(res, { company });
    }

    if (method === 'GET' && pathname === '/api/reports/monthly') {
      if (!requireActivePlan(user, db, res)) return;
      const year = Number(url.searchParams.get('year') || new Date().getFullYear());
      const month = Number(url.searchParams.get('month') || new Date().getMonth() + 1);
      const rows = db.launches.filter(l => l.userId === user.id && new Date(l.date).getFullYear() === year && new Date(`${l.date}T12:00:00`).getMonth() + 1 === month);
      const revenue = dinheiro(rows.filter(l => l.type === 'revenue').reduce((s,l)=>s+Number(l.amount),0));
      const expenses = dinheiro(rows.filter(l => l.type === 'expense').reduce((s,l)=>s+Number(l.amount),0));
      return ok(res, { report: { year, month, monthName: MESES[month-1], revenue, expenses, balance: dinheiro(revenue-expenses), launches: rows } });
    }

    if (method === 'GET' && pathname === '/api/tickets') {
      const tickets = db.tickets.filter(t => canAccessTicket(user, t)).sort(compareTickets).map(t => ({ ...exposeTicket(db, t), queueInfo: queueInfoFor(db, t) }));
      return ok(res, { tickets });
    }

    if (method === 'POST' && pathname === '/api/tickets') {
      const body = await readBody(req);
      const type = body.type === 'report' ? 'report' : 'support';
      if (type === 'report' && ![CARGOS.CUSTOMER, CARGOS.OWNER, CARGOS.SUPPORT, CARGOS.MODERATOR].includes(user.role)) return fail(res, 403, 'Sem permissão.');
      if (type === 'support' && user.role !== CARGOS.CUSTOMER && user.role !== CARGOS.OWNER) return fail(res, 403, 'Somente clientes podem abrir atendimento de suporte.');
      const description = textoLimpo(body.description, 4000) || 'Solicitação aberta.';
      const priority = body.priority === 'urgent' || mentionsPriority(`${body.title || ''} ${description}`) ? 'urgent' : 'normal';
      const countToday = db.tickets.filter(t => t.protocol?.startsWith(`${ticketPrefix(type)}-${new Date().toISOString().slice(0,10).replace(/-/g,'')}`)).length;
      const ticket = { id: uid('tck'), protocol: protocolo(ticketPrefix(type), countToday), type, title: textoLimpo(body.title, 140) || (type === 'report' ? 'Denúncia' : 'Solicitação de suporte'), category: textoLimpo(body.category, 80) || (type === 'report' ? 'Uso indevido' : 'Ajuda'), status: 'open', priority, customerId: user.role === CARGOS.CUSTOMER ? user.id : (body.customerId || user.id), assigneeId: null, estimatedMinutes: 5, urgentAt: priority === 'urgent' ? agoraISO() : null, createdAt: agoraISO(), updatedAt: agoraISO(), closedAt: null, closedBy: null };
      db.tickets.push(ticket);
      ticket.estimatedMinutes = estimateQueue(db, ticket);
      const attachment = body.attachmentDataUrl ? saveAttachmentFromDataUrl(user.id, body.attachmentDataUrl, body.attachmentName || 'imagem') : null;
      db.messages.push({ id: uid('msg'), ticketId: ticket.id, senderId: user.id, text: description, attachment, system: false, createdAt: agoraISO() });
      notifyTicketTeam(db, ticket, `Novo protocolo ${ticket.protocol}`, `${ticket.title}${priority === 'urgent' ? ' · Urgente' : ''}`, `ticket-new-${ticket.id}`);
      auditar(db, user.id, 'ticket.create', { ticketId: ticket.id, type, protocol: ticket.protocol });
      escreverBanco(db); return ok(res, { ticket: exposeTicket(db, ticket), queueInfo: queueInfoFor(db, ticket) });
    }

    const startMatch = pathname.match(/^\/api\/tickets\/([^/]+)\/start$/);
    if (startMatch && method === 'POST') {
      const ticket = db.tickets.find(t => t.id === startMatch[1]);
      if (!ticket || !canAccessTicket(user, ticket)) return fail(res, 404, 'Chamado não encontrado.');
      if (![CARGOS.OWNER, CARGOS.SUPPORT, CARGOS.MODERATOR].includes(user.role)) return fail(res, 403, 'Somente equipe pode iniciar atendimento.');
      if (ticket.status === 'closed') return fail(res, 409, 'Chamado encerrado. Abra outro protocolo para continuar.');
      if (ticket.assigneeId && ticket.assigneeId !== user.id && user.role !== CARGOS.OWNER) return fail(res, 409, 'Este atendimento já foi iniciado por outro membro da equipe.');
      ticket.assigneeId = user.id; ticket.status = 'in_progress'; ticket.updatedAt = agoraISO();
      db.messages.push({ id: uid('msg'), ticketId: ticket.id, senderId: user.id, text: `${user.name} iniciou o atendimento.`, attachment: null, system: true, createdAt: agoraISO() });
      if (ticket.customerId) adicionarNotificacao(db, ticket.customerId, 'ticket', `Atendimento iniciado em ${ticket.protocol}`, `${user.name} iniciou o atendimento.`, `ticket-start-${ticket.id}`, ticketTarget(ticket));
      auditar(db, user.id, 'ticket.start', { ticketId: ticket.id }); escreverBanco(db); return ok(res, { ticket: exposeTicket(db, ticket) });
    }

    const closeMatch = pathname.match(/^\/api\/tickets\/([^/]+)\/close$/);
    if (closeMatch && method === 'POST') {
      const ticket = db.tickets.find(t => t.id === closeMatch[1]);
      if (!ticket || !canAccessTicket(user, ticket)) return fail(res, 404, 'Chamado não encontrado.');
      if (ticket.status === 'closed') return ok(res, { ticket: exposeTicket(db, ticket) });
      ticket.status = 'closed'; ticket.closedAt = agoraISO(); ticket.closedBy = user.id; ticket.updatedAt = agoraISO();
      db.messages.push({ id: uid('msg'), ticketId: ticket.id, senderId: user.id, text: 'Conversa finalizada. Para continuar, abra um novo protocolo.', attachment: null, system: true, createdAt: agoraISO() });
      if (ticket.customerId && ticket.customerId !== user.id) adicionarNotificacao(db, ticket.customerId, 'ticket', `Protocolo ${ticket.protocolo} finalizado`, 'Avalie sua experiência no atendimento.', `ticket-close-${ticket.id}`, ticketTarget(ticket));
      auditar(db, user.id, 'ticket.close', { ticketId: ticket.id }); escreverBanco(db); return ok(res, { ticket: exposeTicket(db, ticket) });
    }

    const transferMatch = pathname.match(/^\/api\/tickets\/([^/]+)\/transfer$/);
    if (transferMatch && method === 'POST') {
      const ticket = db.tickets.find(t => t.id === transferMatch[1]);
      if (!ticket || !canAccessTicket(user, ticket)) return fail(res, 404, 'Chamado não encontrado.');
      if (ticket.status === 'closed') return fail(res, 409, 'Chamado encerrado.');
      if (!EQUIPE.includes(user.cargo) && user.cargo !== CARGOS.OWNER) return fail(res, 403, 'Apenas a equipe pode transferir atendimento.');
      if (ticket.assigneeId !== user.id && user.cargo !== CARGOS.OWNER) return fail(res, 403, 'Apenas o atendente atual ou owner pode transferir.');
      const body = await readBody(req);
      const novoAtendenteId = body.assigneeId;
      if (!novoAtendenteId) return fail(res, 400, 'Informe o membro da equipe para transferir.');
      const novoAtendente = db.users.find(u => u.id === novoAtendenteId && EQUIPE.includes(u.cargo) && u.status === 'active');
      if (!novoAtendente) return fail(res, 404, 'Membro da equipe não encontrado.');
      if (novoAtendente.id === user.id) return fail(res, 400, 'Você já é o atendente atual.');
      const allowed = ticket.type === 'report' ? [CARGOS.OWNER, CARGOS.MODERATOR] : [CARGOS.OWNER, CARGOS.SUPPORT];
      if (!allowed.includes(novoAtendente.cargo)) return fail(res, 403, 'O membro selecionado não pode atender este tipo de protocolo.');
      const antigoAtendenteNome = user.nome || 'Atendente';
      ticket.assigneeId = novoAtendente.id;
      ticket.status = 'in_progress';
      ticket.updatedAt = agoraISO();
      db.messages.push({ id: uid('msg'), ticketId: ticket.id, senderId: user.id, text: `Atendimento transferido para ${novoAtendente.nome}. Aguarde...`, attachment: null, system: true, createdAt: agoraISO() });
      db.messages.push({ id: uid('msg'), ticketId: ticket.id, senderId: novoAtendente.id, text: `${novoAtendente.nome} assumiu este atendimento.`, attachment: null, system: true, createdAt: agoraISO() });
      adicionarNotificacao(db, novoAtendente.id, 'ticket', `Atendimento transferido: ${ticket.protocolo}`, `${antigoAtendenteNome} transferiu o protocolo ${ticket.protocolo} para você.`, `transfer-${ticket.id}-${novoAtendente.id}`, ticketTarget(ticket));
      if (ticket.customerId) adicionarNotificacao(db, ticket.customerId, 'ticket', `Atendimento atualizado em ${ticket.protocolo}`, `${novoAtendente.nome} assumiu seu atendimento.`, `transfer-customer-${ticket.id}`, ticketTarget(ticket));
      auditar(db, user.id, 'ticket.transfer', { ticketId: ticket.id, fromUserId: user.id, toUserId: novoAtendente.id });
      escreverBanco(db);
      return ok(res, { ticket: exposeTicket(db, ticket) });
    }

    const messagesMatch = pathname.match(/^\/api\/tickets\/([^/]+)\/messages$/);
    if (messagesMatch && method === 'GET') {
      const ticket = db.tickets.find(t => t.id === messagesMatch[1]);
      if (!ticket || !canAccessTicket(user, ticket)) return fail(res, 404, 'Chamado não encontrado.');
      const messages = db.messages.filter(m => m.ticketId === ticket.id).sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt)).map(m => exposeMessage(db, m));
      return ok(res, { ticket: exposeTicket(db, ticket), messages, queueInfo: queueInfoFor(db, ticket), feedback: ticketFeedbackFor(db, ticket.id, ticket.customerId) });
    }
    if (messagesMatch && method === 'POST') {
      const body = await readBody(req);
      const ticket = db.tickets.find(t => t.id === messagesMatch[1]);
      if (!ticket || !canAccessTicket(user, ticket)) return fail(res, 404, 'Chamado não encontrado.');
      if (ticket.status === 'closed') return fail(res, 409, 'Este protocolo foi finalizado. Abra um novo chamado para continuar.');
      if ([CARGOS.SUPPORT, CARGOS.MODERATOR].includes(user.role)) {
        if (!ticket.assigneeId) return fail(res, 409, 'Inicie o atendimento antes de responder.');
        if (ticket.assigneeId !== user.id && user.role !== CARGOS.OWNER) return fail(res, 409, 'Outro membro da equipe está atendendo este protocolo.');
      }
      const attachment = body.attachmentDataUrl ? saveAttachmentFromDataUrl(user.id, body.attachmentDataUrl, body.attachmentName || 'imagem') : null;
      const text = textoLimpo(body.text, 4000);
      if (!text && !attachment) return fail(res, 400, 'Envie uma mensagem ou imagem.');
      const msg = { id: uid('msg'), ticketId: ticket.id, senderId: user.id, text, attachment, system: false, createdAt: agoraISO() };
      db.messages.push(msg); ticket.updatedAt = agoraISO();
      if (mentionsPriority(text)) {
        const changed = markTicketUrgent(db, ticket, user.id);
        if (changed) notifyTicketTeam(db, ticket, `Protocolo ${ticket.protocol} marcado como urgente`, text || ticket.title, `ticket-urgent-${ticket.id}`);
      }
      const notifyUserId = user.id === ticket.customerId ? ticket.assigneeId : ticket.customerId;
      if (notifyUserId) adicionarNotificacao(db, notifyUserId, 'ticket', `Nova mensagem no protocolo ${ticket.protocol}`, text || 'Imagem enviada no atendimento.', `msg-${msg.id}`, ticketTarget(ticket));
      if (user.id === ticket.customerId && !ticket.assigneeId) notifyTicketTeam(db, ticket, `Nova mensagem em ${ticket.protocol}`, text || 'Imagem enviada no atendimento.', `ticket-waiting-msg-${msg.id}`);
      auditar(db, user.id, 'ticket.message', { ticketId: ticket.id }); escreverBanco(db); return ok(res, { message: exposeMessage(db, msg), ticket: exposeTicket(db, ticket) });
    }

    const feedbackMatch = pathname.match(/^\/api\/tickets\/([^/]+)\/feedback$/);
    if (feedbackMatch && method === 'POST') {
      const ticket = db.tickets.find(t => t.id === feedbackMatch[1]);
      if (!ticket || !canAccessTicket(user, ticket)) return fail(res, 404, 'Chamado não encontrado.');
      if (ticket.status !== 'closed') return fail(res, 409, 'Avaliação disponível somente após encerrar o chamado.');
      if (user.id !== ticket.customerId && user.role !== CARGOS.OWNER) return fail(res, 403, 'Somente o cliente deste chamado pode avaliar.');
      if (ticketFeedbackFor(db, ticket.id, ticket.customerId)) return fail(res, 409, 'Avaliação já registrada para este chamado.');
      const body = await readBody(req);
      const rawRating = Number(body.rating);
      if (!Number.isFinite(rawRating) || rawRating < 1 || rawRating > 5) return fail(res, 400, 'Informe uma nota de 1 a 5 estrelas.');
      const rating = Math.round(rawRating);
      const feedback = { id: uid('fbk'), ticketId: ticket.id, customerId: ticket.customerId, assigneeId: ticket.assigneeId || (EQUIPE.includes(db.users.find(u => u.id === ticket.closedBy)?.role) ? ticket.closedBy : null), rating, comment: textoLimpo(body.comment, 1000), createdAt: agoraISO() };
      db.ticketFeedbacks.push(feedback);
      db.messages.push({ id: uid('msg'), ticketId: ticket.id, senderId: user.id, text: `Avaliação enviada: ${rating} estrela${rating === 1 ? '' : 's'}.`, attachment: null, system: true, createdAt: agoraISO() });
      if (feedback.assigneeId) adicionarNotificacao(db, feedback.assigneeId, 'feedback', `Nova avaliação em ${ticket.protocol}`, `${rating} estrela${rating === 1 ? '' : 's'}${feedback.comment ? ` · ${feedback.comment}` : ''}`, `feedback-${feedback.id}`, ticketTarget(ticket));
      auditar(db, user.id, 'ticket.feedback.create', { ticketId: ticket.id, feedbackId: feedback.id, rating });
      escreverBanco(db);
      return ok(res, { feedback, ticket: exposeTicket(db, ticket) });
    }

    if (method === 'GET' && pathname === '/api/admin/feedbacks') {
      if (!isStaff(user)) return fail(res, 403, 'Somente equipe pode acessar avaliações.');
      const feedbacks = db.ticketFeedbacks
        .filter(f => canSeeFeedback(user, f, db))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(f => {
          const ticket = db.tickets.find(t => t.id === f.ticketId);
          return {
            ...f, nota: f.rating, comentario: f.comment, chamadoId: f.ticketId,
            ticket: exposeTicket(db, ticket),
            cliente: exposeUser(db, db.users.find(u => u.id === f.customerId)),
            atendente: exposeUser(db, db.users.find(u => u.id === f.assigneeId)),
            customer: exposeUser(db, db.users.find(u => u.id === f.customerId)),
            assignee: exposeUser(db, db.users.find(u => u.id === f.assigneeId))
          };
        });
      const allowedTypes = user.role === CARGOS.OWNER ? ['support', 'report'] : user.role === CARGOS.SUPPORT ? ['support'] : ['report'];
      const staff = db.users.filter(u => EQUIPE.includes(u.role) && u.status === 'active');
      const ranking = staff.map(member => {
        const rows = db.ticketFeedbacks.filter(f => f.assigneeId === member.id && allowedTypes.includes(db.tickets.find(t => t.id === f.ticketId)?.type));
        const avg = rows.length ? rows.reduce((sum, f) => sum + Number(f.rating || 0), 0) / rows.length : 0;
        return { usuario: exposeUser(db, member), mediaAvaliacao: Number(avg.toFixed(1)), quantidadeAvaliacoes: rows.length, user: exposeUser(db, member), ratingAvg: Number(avg.toFixed(1)), ratingCount: rows.length };
      }).filter(row => row.ratingCount > 0).sort((a, b) => b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount);
      return ok(res, { feedbacks, ranking });
    }

    if (method === 'GET' && pathname === '/api/team/users') {
      if (!isStaff(user)) return fail(res, 403, 'Somente equipe pode acessar o chat interno.');
      return ok(res, { users: db.users.filter(u => EQUIPE.includes(u.role) && u.status === 'active').map(u => exposeUser(db, u)) });
    }

    if (method === 'GET' && pathname === '/api/team/conversations') {
      if (!isStaff(user)) return fail(res, 403, 'Somente equipe pode acessar o chat interno.');
      const conversations = db.teamConversations
        .filter(c => canAccessTeamConversation(c, user))
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
        .map(c => exposeConversation(db, c, user.id));
      escreverBanco(db);
      return ok(res, { conversations });
    }

    if (method === 'POST' && pathname === '/api/team/conversations') {
      if (!isStaff(user)) return fail(res, 403, 'Somente equipe pode acessar o chat interno.');
      const body = await readBody(req);
      const requested = Array.isArray(body.memberIds) ? body.memberIds : [];
      const memberIds = [...new Set([user.id, ...requested])].filter(id => db.users.some(u => u.id === id && EQUIPE.includes(u.role) && u.status === 'active'));
      if (memberIds.length < 2) return fail(res, 400, 'Selecione pelo menos mais um membro da equipe.');
      const type = body.type === 'group' || memberIds.length > 2 ? 'group' : 'direct';
      const title = textoLimpo(body.title, 120) || (type === 'group' ? 'Grupo da equipe' : '');
      const conversation = { id: uid('tmc'), type, title, createdBy: user.id, adminId: user.id, members: memberIds.map(userId => ({ userId, joinedAt: agoraISO(), removedAt: null })), deletedFor: [], createdAt: agoraISO(), updatedAt: agoraISO() };
      db.teamConversations.push(conversation);
      db.teamMessages.push({ id: uid('tmsg'), conversationId: conversation.id, senderId: user.id, text: type === 'group' ? `${user.name} criou o grupo.` : `${user.name} iniciou a conversa.`, attachment: null, system: true, createdAt: agoraISO() });
      auditar(db, user.id, 'team.conversation.create', { conversationId: conversation.id, type });
      escreverBanco(db);
      return ok(res, { conversation: exposeConversation(db, conversation, user.id) });
    }

    const teamConversationMatch = pathname.match(/^\/api\/team\/conversations\/([^/]+)$/);
    if (teamConversationMatch && method === 'DELETE') {
      if (!isStaff(user)) return fail(res, 403, 'Somente equipe pode acessar o chat interno.');
      const conversation = db.teamConversations.find(c => c.id === teamConversationMatch[1]);
      if (!conversation || !canAccessTeamConversation(conversation, user)) return fail(res, 404, 'Conversa não encontrada.');
      conversation.deletedFor = [...new Set([...(conversation.deletedFor || []), user.id])];
      conversation.updatedAt = agoraISO();
      auditar(db, user.id, 'team.conversation.delete_for_user', { conversationId: conversation.id });
      escreverBanco(db);
      return ok(res);
    }

    const teamMemberMatch = pathname.match(/^\/api\/team\/conversations\/([^/]+)\/members\/([^/]+)$/);
    if (teamMemberMatch && method === 'DELETE') {
      if (!isStaff(user)) return fail(res, 403, 'Somente equipe pode acessar o chat interno.');
      const conversation = db.teamConversations.find(c => c.id === teamMemberMatch[1]);
      if (!conversation || !canAccessTeamConversation(conversation, user)) return fail(res, 404, 'Conversa não encontrada.');
      if (conversation.adminId !== user.id && user.role !== CARGOS.OWNER) return fail(res, 403, 'Somente o administrador do grupo pode remover membros.');
      const memberId = teamMemberMatch[2];
      const member = activeMembership(conversation, memberId);
      if (!member) return fail(res, 404, 'Membro não encontrado.');
      member.removedAt = agoraISO();
      conversation.updatedAt = agoraISO();
      const removedUser = db.users.find(u => u.id === memberId);
      db.teamMessages.push({ id: uid('tmsg'), conversationId: conversation.id, senderId: user.id, text: `${removedUser?.name || 'Membro'} foi removido da conversa.`, attachment: null, system: true, createdAt: agoraISO() });
      auditar(db, user.id, 'team.conversation.member.remove', { conversationId: conversation.id, memberId });
      escreverBanco(db);
      return ok(res, { conversation: exposeConversation(db, conversation, user.id) });
    }

    const teamMembersMatch = pathname.match(/^\/api\/team\/conversations\/([^/]+)\/members$/);
    if (teamMembersMatch && method === 'POST') {
      if (!isStaff(user)) return fail(res, 403, 'Somente equipe pode acessar o chat interno.');
      const conversation = db.teamConversations.find(c => c.id === teamMembersMatch[1]);
      if (!conversation || !canAccessTeamConversation(conversation, user)) return fail(res, 404, 'Conversa não encontrada.');
      if (conversation.adminId !== user.id && user.role !== CARGOS.OWNER) return fail(res, 403, 'Somente o administrador do grupo pode adicionar membros.');
      const body = await readBody(req);
      const ids = Array.isArray(body.memberIds) ? body.memberIds : [];
      normalizeConversationMembers(conversation);
      const added = [];
      for (const memberId of ids) {
        const memberUser = db.users.find(u => u.id === memberId && EQUIPE.includes(u.role) && u.status === 'active');
        if (!memberUser || activeMembership(conversation, memberId)) continue;
        conversation.members.push({ userId: memberId, joinedAt: agoraISO(), removedAt: null });
        added.push(memberUser.name);
      }
      if (added.length) db.teamMessages.push({ id: uid('tmsg'), conversationId: conversation.id, senderId: user.id, text: `${added.join(', ')} entrou na conversa.`, attachment: null, system: true, createdAt: agoraISO() });
      conversation.updatedAt = agoraISO();
      auditar(db, user.id, 'team.conversation.member.add', { conversationId: conversation.id, added });
      escreverBanco(db);
      return ok(res, { conversation: exposeConversation(db, conversation, user.id) });
    }

    const teamMessagesMatch = pathname.match(/^\/api\/team\/conversations\/([^/]+)\/messages$/);
    if (teamMessagesMatch && method === 'GET') {
      if (!isStaff(user)) return fail(res, 403, 'Somente equipe pode acessar o chat interno.');
      const conversation = db.teamConversations.find(c => c.id === teamMessagesMatch[1]);
      if (!conversation || !canAccessTeamConversation(conversation, user)) return fail(res, 404, 'Conversa não encontrada.');
      const membership = activeMembership(conversation, user.id);
      const messages = db.teamMessages
        .filter(m => m.conversationId === conversation.id && new Date(m.createdAt) >= new Date(membership.joinedAt))
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        .map(m => exposeMessage(db, m));
      return ok(res, { conversation: exposeConversation(db, conversation, user.id), messages });
    }
    if (teamMessagesMatch && method === 'POST') {
      if (!isStaff(user)) return fail(res, 403, 'Somente equipe pode acessar o chat interno.');
      const conversation = db.teamConversations.find(c => c.id === teamMessagesMatch[1]);
      if (!conversation || !canAccessTeamConversation(conversation, user)) return fail(res, 404, 'Conversa não encontrada.');
      const body = await readBody(req);
      const text = textoLimpo(body.text, 4000);
      const attachment = body.attachmentDataUrl ? saveAttachmentFromDataUrl(user.id, body.attachmentDataUrl, body.attachmentName || 'imagem') : null;
      if (!text && !attachment) return fail(res, 400, 'Envie uma mensagem ou imagem.');
      const msg = { id: uid('tmsg'), conversationId: conversation.id, senderId: user.id, text, attachment, system: false, createdAt: agoraISO() };
      db.teamMessages.push(msg);
      conversation.updatedAt = agoraISO();
      normalizeConversationMembers(conversation).filter(m => !m.removedAt && m.userId !== user.id).forEach(m => adicionarNotificacao(db, m.userId, 'team-chat', `Nova mensagem de ${user.name}`, text || 'Imagem enviada no chat da equipe.', `team-msg-${msg.id}-${m.userId}`, { kind: 'team-chat', conversationId: conversation.id }));
      auditar(db, user.id, 'team.message.create', { conversationId: conversation.id });
      escreverBanco(db);
      return ok(res, { message: exposeMessage(db, msg), conversation: exposeConversation(db, conversation, user.id) });
    }

    if (method === 'GET' && pathname === '/api/admin/users') {
      if (!requireRole(user, [CARGOS.OWNER], res)) return;
      return ok(res, { users: db.users.map(u => ({ ...exposeUser(db, u), company: companyFor(db, u.id), subscription: subscriptionFor(db, u.id) })) });
    }

    if (method === 'POST' && pathname === '/api/admin/users') {
      if (!requireRole(user, [CARGOS.OWNER], res)) return;
      const body = await readBody(req);
      const role = [CARGOS.SUPPORT, CARGOS.MODERATOR, CARGOS.OWNER].includes(body.role) ? body.role : CARGOS.SUPPORT;
      const email = textoLimpo(body.email, 180).toLowerCase();
      const name = textoLimpo(body.name, 120);
      const password = String(body.password || 'Equipe@123456!');
      if (!name || !email.includes('@')) return fail(res, 400, 'Informe nome e e-mail válido.');
      if (db.users.some(u => u.email === email)) return fail(res, 409, 'E-mail já cadastrado.');
      const staff = { id: uid('usr'), name, email, role, passwordHash: gerarHashSenha(password), status: 'active', phone: '', cpfCnpj: '', forcePasswordChange: true, avatarUrl: '', createdAt: agoraISO(), updatedAt: agoraISO(), lastLoginAt: null };
      db.users.push(staff); auditar(db, user.id, 'admin.user.create', { userId: staff.id, role }); escreverBanco(db); return ok(res, { user: exposeUser(db, staff), temporaryPassword: password });
    }

    const adminUserMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
    if (adminUserMatch && method === 'PATCH') {
      if (!requireRole(user, [CARGOS.OWNER], res)) return;
      const target = db.users.find(u => u.id === adminUserMatch[1]);
      if (!target) return fail(res, 404, 'Usuário não encontrado.');
      const body = await readBody(req);
      const nextEmail = textoLimpo(body.email, 180).toLowerCase();
      if (nextEmail && !nextEmail.includes('@')) return fail(res, 400, 'E-mail inválido.');
      if (nextEmail && db.users.some(u => u.id !== target.id && u.email === nextEmail)) return fail(res, 409, 'E-mail já cadastrado.');
      if (body.name !== undefined) target.name = textoLimpo(body.name, 120) || target.name;
      if (nextEmail) target.email = nextEmail;
      if ([CARGOS.OWNER, CARGOS.SUPPORT, CARGOS.MODERATOR, CARGOS.CUSTOMER].includes(body.role)) target.role = body.role;
      if (['active', 'blocked', 'deleted'].includes(body.status)) target.status = body.status;
      if (body.phone !== undefined) target.phone = textoLimpo(body.phone, 30);
      if (body.cpfCnpj !== undefined) target.cpfCnpj = apenasDigitos(body.cpfCnpj);
      if (body.forcePasswordChange !== undefined) target.forcePasswordChange = !!body.forcePasswordChange;
      if (body.password) target.passwordHash = gerarHashSenha(body.password);
      if (body.avatarDataUrl) target.avatarUrl = saveAttachmentFromDataUrl(target.id, body.avatarDataUrl, body.avatarName || 'perfil').url;
      target.updatedAt = agoraISO();
      auditar(db, user.id, 'admin.user.update', { userId: target.id });
      escreverBanco(db);
      return ok(res, { user: exposeUser(db, target) });
    }

    if (adminUserMatch && method === 'DELETE') {
      if (!requireRole(user, [CARGOS.OWNER], res)) return;
      const target = db.users.find(u => u.id === adminUserMatch[1]);
      if (!target) return fail(res, 404, 'Usuário não encontrado.');
      if (target.id === user.id) return fail(res, 409, 'O owner logado não pode excluir a própria conta.');
      target.status = 'deleted';
      target.deletedAt = agoraISO();
      target.originalEmail = target.originalEmail || target.email;
      target.email = `deleted-${target.id}@deleted.local`;
      target.updatedAt = agoraISO();
      auditar(db, user.id, 'admin.user.delete', { userId: target.id });
      escreverBanco(db);
      return ok(res, { user: exposeUser(db, target) });
    }

    const adminUserDetailMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
    if (adminUserDetailMatch && method === 'GET') {
      if (!requireRole(user, [CARGOS.OWNER, CARGOS.SUPPORT, CARGOS.MODERATOR], res)) return;
      const target = db.users.find(u => u.id === adminUserDetailMatch[1]);
      if (!target) return fail(res, 404, 'Usuário não encontrado.');
      if (user.role !== CARGOS.OWNER && target.role === CARGOS.OWNER) return fail(res, 403, 'Sem permissão.');
      const targetSub = db.subscriptions.find(s => s.userId === target.id);
      const targetCompany = companyFor(db, target.id);
      const flags = db.flaggedUsers.filter(f => f.userId === target.id).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
      return ok(res, { user: exposeUser(db, target), subscription: targetSub || null, company: targetCompany || null, flags: flags.map(f => ({ ...f, createdBy: exposeUser(db, db.users.find(u => u.id === f.createdBy)) })) });
    }

    const adminFlagMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/flag$/);
    if (adminFlagMatch && method === 'POST') {
      if (!requireRole(user, [CARGOS.OWNER, CARGOS.SUPPORT, CARGOS.MODERATOR], res)) return;
      const target = db.users.find(u => u.id === adminFlagMatch[1]);
      if (!target) return fail(res, 404, 'Usuário não encontrado.');
      if (target.role === CARGOS.OWNER) return fail(res, 403, 'Não é possível sinalizar o proprietário.');
      const body = await readBody(req);
      const text = textoLimpo(body.text, 2000);
      if (!text) return fail(res, 400, 'Informe o motivo da sinalização.');
      const flag = { id: uid('flg'), userId: target.id, createdBy: user.id, text, createdAt: agoraISO() };
      db.flaggedUsers.push(flag);
      const staffRoles = [CARGOS.OWNER, CARGOS.SUPPORT, CARGOS.MODERATOR];
      db.users.filter(u => staffRoles.includes(u.role) && u.status === 'active' && u.id !== user.id).forEach(u => adicionarNotificacao(db, u.id, 'flag', `Cliente sinalizado: ${target.name}`, text, `flag-${flag.id}-${u.id}`, { kind: 'admin', userId: target.id }));
      auditar(db, user.id, 'user.flag.create', { userId: target.id, flagId: flag.id });
      escreverBanco(db);
      return ok(res, { flag: { ...flag, createdBy: exposeUser(db, user) } });
    }
    if (adminFlagMatch && method === 'DELETE') {
      if (!requireRole(user, [CARGOS.OWNER], res)) return;
      const body = await readBody(req);
      const flagId = body.flagId;
      if (!flagId) return fail(res, 400, 'Informe o ID da sinalização.');
      const idx = db.flaggedUsers.findIndex(f => f.id === flagId && f.userId === adminFlagMatch[1]);
      if (idx < 0) return fail(res, 404, 'Sinalização não encontrada.');
      db.flaggedUsers.splice(idx, 1);
      auditar(db, user.id, 'user.flag.delete', { flagId });
      escreverBanco(db);
      return ok(res);
    }

    if (method === 'POST' && pathname === '/api/admin/notifications') {
      if (!requireRole(user, [CARGOS.OWNER, CARGOS.SUPPORT, CARGOS.MODERATOR], res)) return;
      const body = await readBody(req);
      const targetUserId = body.userId;
      const type = textoLimpo(body.type, 40) || 'info';
      const title = textoLimpo(body.title, 180);
      const msg = textoLimpo(body.text, 2000);
      if (!targetUserId || !title || !msg) return fail(res, 400, 'Informe usuário, título e mensagem.');
      const target = db.users.find(u => u.id === targetUserId && u.status === 'active');
      if (!target) return fail(res, 404, 'Usuário não encontrado.');
      const targetKindMap = { assinatura: 'billing', suporte: 'ticket', moderação: 'ticket', info: 'info' };
      const kind = targetKindMap[type] || 'info';
      const n = adicionarNotificacao(db, targetUserId, kind, title, msg, `admin-ntf-${targetUserId}-${Date.now()}`, { kind, ticketType: type === 'moderação' ? 'report' : null });
      auditar(db, user.id, 'admin.notification.send', { targetUserId, type, title });
      escreverBanco(db);
      return ok(res, { notification: n });
    }

    if (method === 'GET' && pathname === '/api/admin/metrics') {
      if (!requireRole(user, [CARGOS.OWNER], res)) return;
      return ok(res, {
        metrics: {
          customers: db.users.filter(u => u.role === CARGOS.CUSTOMER && u.status === 'active').length,
          activeSubscriptions: db.subscriptions.filter(s => ['trialing','active'].includes(s.status)).length,
          pendingTickets: db.tickets.filter(t => t.status !== 'closed' && t.type === 'support').length,
          pendingReports: db.tickets.filter(t => t.status !== 'closed' && t.type === 'report').length,
          revenueRegistered: dinheiro(db.launches.filter(l => l.type === 'revenue').reduce((s,l)=>s+Number(l.amount),0)),
          clientes: db.users.filter(u => u.role === CARGOS.CUSTOMER && u.status === 'active').length,
          assinaturasAtivas: db.subscriptions.filter(s => ['trialing','active'].includes(s.status)).length,
          chamadosPendentes: db.tickets.filter(t => t.status !== 'closed' && t.type === 'support').length,
          denunciasPendentes: db.tickets.filter(t => t.status !== 'closed' && t.type === 'report').length
        }
      });
    }

    return fail(res, 404, 'Rota não encontrada.');
  } catch (err) {
    console.error(err);
    return fail(res, err.status || 500, err.message || 'Erro interno do servidor.', err.payload ? { details: err.payload } : {});
  }
}

function legalTexts() {
  return {
    version: '2026-06-25',
    termsTitle: 'Termos de Uso — MEI no Controle',
    privacyTitle: 'Política de Privacidade — MEI no Controle',
    cookieTitle: 'Política de Cookies — MEI no Controle',
    terms: [
      'O MEI no Controle é uma ferramenta de organização financeira e fiscal para microempreendedores individuais. O serviço ajuda a registrar receitas, despesas, vencimentos e alertas, mas não substitui contador, advogado ou orientação oficial do Portal do Empreendedor.',
      'O usuário é responsável pela veracidade dos dados cadastrados, pelos lançamentos inseridos e pela conferência de obrigações fiscais antes de qualquer envio oficial.',
      'A assinatura pode ser cancelada pelo usuário dentro da plataforma. Havendo cobrança pendente, a conta poderá ficar em modo restrito até a regularização.',
      'Protocolos de suporte e moderação são registrados para segurança, histórico de atendimento e prevenção de uso indevido.'
    ],
    privacy: [
      'Tratamos dados como nome, e-mail, telefone, CNPJ/CPF informado, dados do MEI, lançamentos financeiros, obrigações, mensagens de suporte, anexos enviados e registros de aceite legal.',
      'Dados de cartão não são armazenados pelo sistema. O pagamento é realizado por gateway integrado; este projeto salva apenas identificadores técnicos da cobrança, quando disponíveis.',
      'O usuário pode solicitar acesso, correção, exportação ou exclusão da conta. Alguns registros poderão ser mantidos quando necessário para cumprimento legal, prevenção a fraude, defesa de direitos ou histórico financeiro obrigatório.',
      'Anexos enviados no chat devem conter apenas informações necessárias para o atendimento.'
    ],
    cookies: [
      'Cookies necessários mantêm login, segurança e funcionamento da plataforma.',
      'Cookies analíticos e de marketing só devem ser usados quando habilitados pelo usuário no banner de preferências.',
      'O consentimento pode ser alterado posteriormente na área da conta.'
    ]
  };
}

function serveFile(req, res, pathname) {
  let filePath = pathname === '/' ? path.join(PUBLIC_DIR, 'index.html') : path.join(PUBLIC_DIR, pathname);
  const normalized = path.normalize(filePath);
  if (!normalized.startsWith(PUBLIC_DIR) && !normalized.startsWith(cfg.uploadDir)) return false;
  if (!fs.existsSync(normalized) || fs.statSync(normalized).isDirectory()) return false;
  const ext = path.extname(normalized).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(normalized).pipe(res);
  return true;
}

function serveUpload(req, res, pathname) {
  const rel = pathname.replace('/uploads/', '');
  const filePath = path.normalize(path.join(cfg.uploadDir, rel));
  if (!filePath.startsWith(cfg.uploadDir) || !fs.existsSync(filePath)) return false;
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'private, max-age=3600' });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);
  if (url.pathname.startsWith('/uploads/')) {
    if (serveUpload(req, res, url.pathname)) return;
    return send(res, 404, 'Arquivo não encontrado.');
  }
  if (serveFile(req, res, url.pathname)) return;
  serveFile(req, res, '/index.html') || send(res, 404, 'Página não encontrada.');
});

if (require.main === module) {
  lerBanco();
  server.listen(cfg.port, () => {
    console.log(`MEI no Controle online em ${cfg.appUrl}`);
    console.log(`Gateway: ${cfg.paymentMock ? 'modo local/mock' : 'Asaas real'} | Dados: ${cfg.dataFile}`);
  });
}

module.exports = { server, legalTexts };
