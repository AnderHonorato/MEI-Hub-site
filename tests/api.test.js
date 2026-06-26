const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mei-real-'));
process.env.UPLOAD_DIR = path.join(tmp, 'uploads');
process.env.JWT_SECRET = 'test-secret-with-more-than-32-chars-123456';
process.env.PAYMENT_MOCK = 'true';
process.env.PORT = '0';
process.env.APP_URL = 'http://localhost:0';
process.env.SMTP_PASS = '';

// Carrega DATABASE_URL do .env (Neon ou local)
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    if (key === 'DATABASE_URL' && !process.env[key]) {
      process.env[key] = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    }
  }
}

const { server } = require('../src/servidor');
const prisma = require('../src/prisma');

function listen() {
  return new Promise(resolve => server.listen(0, () => resolve(server.address().port)));
}
function close() { return new Promise(resolve => server.close(resolve)); }
async function req(port, method, path, body, token) {
  const res = await fetch(`http://localhost:${port}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  return { status: res.status, data };
}

const emailsCriados = [];

async function limparDadosTeste() {
  for (const email of emailsCriados) {
    const u = await prisma.user.findUnique({ where: { email } });
    if (u) {
      await prisma.company.deleteMany({ where: { userId: u.id } }).catch(() => {});
      await prisma.subscription.deleteMany({ where: { userId: u.id } }).catch(() => {});
      await prisma.launch.deleteMany({ where: { userId: u.id } }).catch(() => {});
      await prisma.obligation.deleteMany({ where: { userId: u.id } }).catch(() => {});
      await prisma.legalAcceptance.deleteMany({ where: { userId: u.id } }).catch(() => {});
      await prisma.cookieConsent.deleteMany({ where: { userId: u.id } }).catch(() => {});
      await prisma.notification.deleteMany({ where: { userId: u.id } }).catch(() => {});
      await prisma.auditLog.deleteMany({ where: { actorId: u.id } }).catch(() => {});
      const tickets = await prisma.ticket.findMany({ where: { customerId: u.id } });
      for (const t of tickets) {
        await prisma.message.deleteMany({ where: { ticketId: t.id } }).catch(() => {});
        await prisma.ticketFeedback.deleteMany({ where: { ticketId: t.id } }).catch(() => {});
      }
      await prisma.ticket.deleteMany({ where: { customerId: u.id } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: u.id } }).catch(() => {});
    }
  }
}

test('fluxo principal: cadastro, trial, dashboard, lancamento e suporte', async () => {
  const port = await listen();
  try {
    let r = await req(port, 'GET', '/api/health');
    assert.equal(r.status, 200);
    assert.equal(r.data.paymentMode, 'mock');

    r = await req(port, 'POST', '/api/auth/login', { email: 'owner@meinocontrole.local', password: 'Owner@123456!' });
    assert.equal(r.status, 200);
    const ownerToken = r.data.token;

    r = await req(port, 'GET', '/api/admin/metrics', null, ownerToken);
    assert.equal(r.status, 200);
    assert.equal(typeof r.data.metrics.customers, 'number');

    emailsCriados.push('cliente@teste.com');
    r = await req(port, 'POST', '/api/auth/register', {
      name: 'Cliente Teste', email: 'cliente@teste.com', password: 'Cliente@123456',
      phone: '11999999999', businessName: 'Cliente Teste MEI', cnpj: '12345678000100',
      activityType: 'Servicos', acceptTerms: true
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.subscription.status, 'pending_checkout');
    const customerToken = r.data.token;

    r = await req(port, 'GET', '/api/dashboard', null, customerToken);
    assert.equal(r.status, 402);

    r = await req(port, 'POST', '/api/billing/start-trial', {}, customerToken);
    assert.equal(r.status, 200);
    assert.equal(r.data.subscription.status, 'trialing');

    r = await req(port, 'POST', '/api/launches', { title: 'Servico entregue', date: '2026-06-25', type: 'revenue', category: 'Prestacao de Servico', amount: 2500, paymentMethod: 'Pix' }, customerToken);
    assert.equal(r.status, 200);
    assert.equal(r.data.launch.amount, 2500);

    r = await req(port, 'GET', '/api/dashboard', null, customerToken);
    assert.equal(r.status, 200);
    assert.equal(r.data.current.revenue, 2500);

    r = await req(port, 'POST', '/api/tickets', { type: 'support', title: 'Preciso de ajuda', category: 'Faturamento', description: 'Nao encontrei meu relatorio.' }, customerToken);
    assert.equal(r.status, 200);
    assert.match(r.data.ticket.protocol, /^SUP-/);
    const ticketId = r.data.ticket.id;

    r = await req(port, 'POST', '/api/auth/login', { email: 'suporte@meinocontrole.local', password: 'Suporte@123456!' });
    assert.equal(r.status, 200);
    const supportToken = r.data.token;

    r = await req(port, 'POST', `/api/tickets/${ticketId}/start`, {}, supportToken);
    assert.equal(r.status, 200);
    assert.equal(r.data.ticket.status, 'in_progress');

    r = await req(port, 'POST', `/api/tickets/${ticketId}/messages`, { text: 'Vamos verificar agora.' }, supportToken);
    assert.equal(r.status, 200);

    r = await req(port, 'GET', '/api/me', null, customerToken);
    assert.equal(r.status, 200);
    const ticketNotice = r.data.notifications.find(n => n.title.includes('Nova mensagem no protocolo'));
    assert.equal(ticketNotice.target.kind, 'ticket');
    assert.equal(ticketNotice.target.ticketId, ticketId);
    assert.equal(ticketNotice.target.ticketType, 'support');

    r = await req(port, 'POST', `/api/tickets/${ticketId}/close`, {}, customerToken);
    assert.equal(r.status, 200);

    r = await req(port, 'POST', `/api/tickets/${ticketId}/messages`, { text: 'Mais uma duvida.' }, customerToken);
    assert.equal(r.status, 409);

    r = await req(port, 'POST', `/api/tickets/${ticketId}/feedback`, { rating: 5, comment: 'Atendimento claro e rapido.' }, customerToken);
    assert.equal(r.status, 200);
    assert.equal(r.data.feedback.rating, 5);
    assert.equal(r.data.feedback.assigneeId, r.data.ticket.assigneeId);

    r = await req(port, 'POST', `/api/tickets/${ticketId}/feedback`, { rating: 4 }, customerToken);
    assert.equal(r.status, 409);

    r = await req(port, 'GET', '/api/admin/feedbacks', null, supportToken);
    assert.equal(r.status, 200);
    assert.equal(r.data.feedbacks.length, 1);
    assert.equal(r.data.ranking[0].ratingAvg, 5);

    r = await req(port, 'POST', '/api/tickets', { type: 'support', title: 'Prioridade no DAS', category: 'DAS e obrigacoes', description: 'Preciso de prioridade neste atendimento.' }, customerToken);
    assert.equal(r.status, 200);
    assert.equal(r.data.ticket.priority, 'urgent');

    r = await req(port, 'GET', '/api/tickets', null, supportToken);
    assert.equal(r.status, 200);
    assert.equal(r.data.tickets[0].priority, 'urgent');

    r = await req(port, 'GET', '/api/team/users', null, ownerToken);
    assert.equal(r.status, 200);
    const supportUser = r.data.users.find(u => u.email === 'suporte@meinocontrole.local');
    const moderatorUser = r.data.users.find(u => u.email === 'moderacao@meinocontrole.local');
    assert.ok(supportUser);
    assert.ok(moderatorUser);

    r = await req(port, 'POST', '/api/team/conversations', { memberIds: [supportUser.id], title: 'Plantao' }, ownerToken);
    assert.equal(r.status, 200);
    const conversationId = r.data.conversation.id;

    r = await req(port, 'POST', `/api/team/conversations/${conversationId}/messages`, { text: 'Alinhar atendimentos urgentes.' }, ownerToken);
    assert.equal(r.status, 200);

    r = await req(port, 'GET', '/api/me', null, supportToken);
    assert.equal(r.status, 200);
    const teamNotice = r.data.notifications.find(n => n.type === 'team-chat');
    assert.equal(teamNotice.target.kind, 'team-chat');
    assert.equal(teamNotice.target.conversationId, conversationId);

    r = await req(port, 'GET', `/api/team/conversations/${conversationId}/messages`, null, supportToken);
    assert.equal(r.status, 200);
    assert.equal(r.data.messages.some(m => m.text === 'Alinhar atendimentos urgentes.'), true);

    r = await req(port, 'POST', '/api/team/conversations', { memberIds: [supportUser.id, moderatorUser.id], title: 'Grupo operacional', type: 'group' }, ownerToken);
    assert.equal(r.status, 200);
    const groupId = r.data.conversation.id;

    r = await req(port, 'DELETE', `/api/team/conversations/${groupId}/members/${supportUser.id}`, null, ownerToken);
    assert.equal(r.status, 200);

    r = await req(port, 'GET', `/api/team/conversations/${groupId}/messages`, null, supportToken);
    assert.equal(r.status, 404);

    r = await req(port, 'POST', `/api/team/conversations/${groupId}/messages`, { text: 'Mensagem durante ausencia.' }, ownerToken);
    assert.equal(r.status, 200);
    await new Promise(resolve => setTimeout(resolve, 10));

    r = await req(port, 'POST', `/api/team/conversations/${groupId}/members`, { memberIds: [supportUser.id] }, ownerToken);
    assert.equal(r.status, 200);

    r = await req(port, 'GET', `/api/team/conversations/${groupId}/messages`, null, supportToken);
    assert.equal(r.status, 200);
    assert.equal(r.data.messages.some(m => m.text === 'Mensagem durante ausencia.'), false);

    emailsCriados.push('atendente@teste.local');
    r = await req(port, 'POST', '/api/admin/users', { name: 'Atendente Teste', email: 'atendente@teste.local', role: 'support', password: 'Equipe@123456!' }, ownerToken);
    assert.equal(r.status, 200);
    const staffId = r.data.user.id;

    r = await req(port, 'PATCH', `/api/admin/users/${staffId}`, { name: 'Atendente Editado', status: 'blocked', role: 'moderator' }, ownerToken);
    assert.equal(r.status, 200);
    assert.equal(r.data.user.name, 'Atendente Editado');
    assert.equal(r.data.user.status, 'blocked');
    assert.equal(r.data.user.role, 'moderator');

    r = await req(port, 'DELETE', `/api/admin/users/${staffId}`, null, ownerToken);
    assert.equal(r.status, 200);
    assert.equal(r.data.user.status, 'deleted');
  } finally {
    await close();
    await limparDadosTeste().catch(() => {});
    await prisma.$disconnect().catch(() => {});
  }
});

test('autenticacao: login bloqueado, recuperacao de senha e 2FA', async () => {
  const port = await listen();
  try {
    // Registra usuario para testes de auth
    const emailTeste = 'authteste@teste.com';
    emailsCriados.push(emailTeste);
    let r = await req(port, 'POST', '/api/auth/register', {
      name: 'Auth Teste', email: emailTeste, password: 'Teste@123456',
      phone: '11988887777', businessName: 'Auth MEI', cnpj: '12345678000199',
      activityType: 'Servicos', acceptTerms: true
    });
    assert.equal(r.status, 200);
    const customerToken = r.data.token;
    assert.ok(customerToken);

    // Teste: login com senha errada (bloqueio apos 5 tentativas)
    for (let i = 0; i < 4; i++) {
      r = await req(port, 'POST', '/api/auth/login', { email: emailTeste, password: 'senhaerrada' });
      assert.equal(r.status, 401);
    }
    // 5a tentativa deve bloquear
    r = await req(port, 'POST', '/api/auth/login', { email: emailTeste, password: 'senhaerrada' });
    assert.equal(r.status, 429);
    assert.ok(r.data.message.includes('bloqueada'));

    // Login correto ainda bloqueado
    r = await req(port, 'POST', '/api/auth/login', { email: emailTeste, password: 'Teste@123456' });
    assert.equal(r.status, 429);

    // Recuperacao de senha
    r = await req(port, 'POST', '/api/auth/esqueci-senha', { email: emailTeste });
    assert.equal(r.status, 200);

    // Como nao temos o codigo (enviado por email), verificamos que a rota responde ok
    r = await req(port, 'POST', '/api/auth/redefinir-senha', { email: emailTeste, codigo: '000000', novaSenha: 'Nova@123456' });
    assert.equal(r.status, 400); // codigo invalido
    assert.ok(r.data.message.includes('invalido') || r.data.message.includes('dados'));

    // 2FA - iniciar
    r = await req(port, 'POST', '/api/conta/2fa/iniciar', {}, customerToken);
    assert.equal(r.status, 200);
    assert.ok(r.data.segredoManual);

    // 2FA - confirmar com codigo valido
    const { gerarCodigoTotp } = require('../src/totp');
    const codigoValido = gerarCodigoTotp(r.data.segredoManual);
    r = await req(port, 'POST', '/api/conta/2fa/confirmar', { codigo: codigoValido }, customerToken);
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.data.codigosBackup));
    assert.equal(r.data.codigosBackup.length, 10);

    // Login agora pede 2FA
    // Primeiro, desbloqueia manualmente alterando o banco
    const prismaLocal = require('../src/prisma');
    await prismaLocal.user.update({ where: { email: emailTeste }, data: { bloqueadoAte: null, tentativasLoginFalhas: 0 } });
    r = await req(port, 'POST', '/api/auth/login', { email: emailTeste, password: 'Teste@123456' });
    assert.equal(r.status, 200);
    assert.equal(r.data.pendente2fa, true);
    const tokenTemp = r.data.tokenTemporario;
    assert.ok(tokenTemp);

    // Validar 2FA com codigo correto
    r = await req(port, 'POST', '/api/auth/2fa/validar', { tokenTemporario: tokenTemp, codigo: codigoValido });
    assert.equal(r.status, 200);
    assert.ok(r.data.token);
    const tokenFinal = r.data.token;

    // 2FA - desativar
    r = await req(port, 'POST', '/api/conta/2fa/desativar', { senha: 'Teste@123456' }, tokenFinal);
    assert.equal(r.status, 200);

    // Login volta ao normal (sem 2FA)
    r = await req(port, 'POST', '/api/auth/login', { email: emailTeste, password: 'Teste@123456' });
    assert.equal(r.status, 200);
    assert.ok(r.data.token);
  } finally {
    await close();
    await limparDadosTeste().catch(() => {});
    await prisma.$disconnect().catch(() => {});
  }
});
