const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mei-real-'));
process.env.DATA_FILE = path.join(tmp, 'database.json');
process.env.UPLOAD_DIR = path.join(tmp, 'uploads');
process.env.JWT_SECRET = 'test-secret-with-more-than-32-chars-123456';
process.env.PAYMENT_MOCK = 'true';
process.env.PORT = '0';
process.env.APP_URL = 'http://localhost:0';

const { server } = require('../src/server');

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

test('fluxo principal: cadastro, trial, dashboard, lançamento e suporte', async () => {
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

    r = await req(port, 'POST', '/api/auth/register', {
      name: 'Cliente Teste', email: 'cliente@teste.com', password: 'Cliente@123456',
      phone: '11999999999', businessName: 'Cliente Teste MEI', cnpj: '12345678000100',
      activityType: 'Serviços', acceptTerms: true
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.subscription.status, 'pending_checkout');
    const customerToken = r.data.token;

    r = await req(port, 'GET', '/api/dashboard', null, customerToken);
    assert.equal(r.status, 402);

    r = await req(port, 'POST', '/api/billing/start-trial', {}, customerToken);
    assert.equal(r.status, 200);
    assert.equal(r.data.subscription.status, 'trialing');

    r = await req(port, 'POST', '/api/launches', { title: 'Serviço entregue', date: '2026-06-25', type: 'revenue', category: 'Prestação de Serviço', amount: 2500, paymentMethod: 'Pix' }, customerToken);
    assert.equal(r.status, 200);
    assert.equal(r.data.launch.amount, 2500);

    r = await req(port, 'GET', '/api/dashboard', null, customerToken);
    assert.equal(r.status, 200);
    assert.equal(r.data.current.revenue, 2500);

    r = await req(port, 'POST', '/api/tickets', { type: 'support', title: 'Preciso de ajuda', category: 'Faturamento', description: 'Não encontrei meu relatório.' }, customerToken);
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

    r = await req(port, 'POST', `/api/tickets/${ticketId}/messages`, { text: 'Mais uma dúvida.' }, customerToken);
    assert.equal(r.status, 409);

    r = await req(port, 'POST', `/api/tickets/${ticketId}/feedback`, { rating: 5, comment: 'Atendimento claro e rápido.' }, customerToken);
    assert.equal(r.status, 200);
    assert.equal(r.data.feedback.rating, 5);
    assert.equal(r.data.feedback.assigneeId, r.data.ticket.assigneeId);

    r = await req(port, 'POST', `/api/tickets/${ticketId}/feedback`, { rating: 4 }, customerToken);
    assert.equal(r.status, 409);

    r = await req(port, 'GET', '/api/admin/feedbacks', null, supportToken);
    assert.equal(r.status, 200);
    assert.equal(r.data.feedbacks.length, 1);
    assert.equal(r.data.ranking[0].ratingAvg, 5);

    r = await req(port, 'POST', '/api/tickets', { type: 'support', title: 'Prioridade no DAS', category: 'DAS e obrigações', description: 'Preciso de prioridade neste atendimento.' }, customerToken);
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

    r = await req(port, 'POST', '/api/team/conversations', { memberIds: [supportUser.id], title: 'Plantão' }, ownerToken);
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
  }
});
