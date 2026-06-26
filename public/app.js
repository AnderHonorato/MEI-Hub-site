const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
const app = $('#app');
const state = {
  token: localStorage.getItem('mei_token') || '',
  user: null, company: null, subscription: null, notifications: [], legal: null,
  tab: localStorage.getItem('mei_tab') || 'dashboard',
  authMode: 'login', modal: null, loading: false, mediaModal: null, profileModal: null, notificationOpen: false,
  ticketFilter: localStorage.getItem('mei_ticket_filter') || 'all',
  supportSubtab: localStorage.getItem('mei_support_subtab') || 'queue',
  dashboard: null, launches: [], obligations: [], tickets: [], currentTicket: null, messages: [], queueInfo: null, ticketFeedback: null,
  metrics: null, users: [], editingUser: null, feedbacks: [], ranking: [],
  teamOpen: false, teamUsers: [], teamConversations: [], teamMessages: [], currentTeamConversation: null
};
let ticketPollTimer = null;
let notificationPollTimer = null;
let teamPollTimer = null;
let notificationBubbleTimer = null;
const money = v => Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const dt = v => v ? new Date(v + (String(v).length === 10 ? 'T12:00:00' : '')).toLocaleDateString('pt-BR') : '—';
const escapeHtml = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const isStaff = () => ['owner','support','moderator'].includes(state.user?.role);
const isCustomer = () => state.user?.role === 'customer';
const planOk = () => ['trialing','active'].includes(state.subscription?.status) || isStaff();
const isTeamRole = role => ['owner','support','moderator'].includes(role);
const fmtDateTime = v => v ? new Date(v).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}) : '—';
const unreadCount = () => (state.notifications||[]).filter(n=>!n.read).length;
function roleBadge(user){ return user?.badgeLabel || ({owner:'Fundador',support:'Suporte',moderator:'Moderador',customer:'Cliente'}[user?.role]||'Usuário'); }
function avatar(user, cls='avatar'){ return user?.avatarUrl ? `<img class="${cls}" src="${user.avatarUrl}" alt="Foto de ${escapeHtml(user.name||'usuário')}">` : `<span class="${cls}">${escapeHtml(user?.initials || String(user?.name||'U').slice(0,1).toUpperCase())}</span>`; }
function stars(value=0){ const v=Number(value||0); return `<span class="stars">${[1,2,3,4,5].map(i=>`<span class="${i<=Math.round(v)?'on':''}">★</span>`).join('')}</span>`; }
function feedbackMood(value){ return ({1:'😞',2:'😕',3:'🙂',4:'😄',5:'🤩'}[Number(value)]||'🙂'); }

function icon(name, cls='icon') {
  const paths = {
    logo:'<path d="M9 21h12a4 4 0 0 0 4-4V9a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v8a4 4 0 0 0 4 4Z"/><path d="M10 16V9l5 4 5-4v7"/><path d="M9 21c1.6-4 3.7-6 6-6s4.4 2 6 6"/>',
    chart:'<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16v-5"/><path d="M12 16V8"/><path d="M16 16v-7"/><path d="M20 16v-3"/>',
    wallet:'<path d="M4 7a3 3 0 0 1 3-3h11v5H7a3 3 0 0 0-3 3v5a3 3 0 0 0 3 3h13V9"/><path d="M17 14h.01"/>',
    receipt:'<path d="M7 4h10a2 2 0 0 1 2 2v15l-3-2-3 2-3-2-3 2V6a2 2 0 0 1 2-2Z"/><path d="M9 8h6"/><path d="M9 12h6"/><path d="M9 16h4"/>',
    calendar:'<path d="M7 3v4"/><path d="M17 3v4"/><path d="M4 9h16"/><path d="M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><path d="m8 14 2 2 5-5"/>',
    shield:'<path d="M12 3 5 6v5c0 5 3.5 8.5 7 10 3.5-1.5 7-5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
    bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    user:'<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/>',
    users:'<path d="M17 21a6 6 0 0 0-12 0"/><circle cx="11" cy="7" r="4"/><path d="M22 21a5 5 0 0 0-4-4.8"/><path d="M17 3.2a4 4 0 0 1 0 7.6"/>',
    lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    card:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18"/><path d="M7 15h3"/>',
    chat:'<path d="M21 12a8 8 0 0 1-8 8H5l-2 2 1.2-4.2A8 8 0 1 1 21 12Z"/><path d="M8 11h8"/><path d="M8 15h5"/>',
    flag:'<path d="M5 21V4"/><path d="M5 5h11l-1.5 4L16 13H5"/>',
    file:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/><path d="M9 14h6"/><path d="M9 17h4"/>',
    plus:'<path d="M12 5v14"/><path d="M5 12h14"/>',
    logout:'<path d="M10 17 15 12 10 7"/><path d="M15 12H3"/><path d="M21 3v18"/>',
    settings:'<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V22a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 1 1 4.2 18l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 7.1 4.2l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1h.1a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
    phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>'
  };
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.logo}</svg>`;
}
function logo() { return `<div class="logo"><div class="logo-mark">${icon('logo')}</div><div><strong>MEI no Controle</strong><small>Faturamento, DAS e obrigações</small></div></div>`; }
function toast(msg, type='ok') { const el=document.createElement('div'); el.className=`toast ${type}`; el.textContent=msg; $('#toast').appendChild(el); setTimeout(()=>el.remove(),4500); }
function notificationSeenKey(){ return `mei_seen_notifications_${state.user?.id||'anon'}`; }
function readSeenNotificationIds(){
  try { return new Set(JSON.parse(localStorage.getItem(notificationSeenKey()) || '[]')); }
  catch { return new Set(); }
}
function saveSeenNotificationIds(ids){ localStorage.setItem(notificationSeenKey(), JSON.stringify([...ids].slice(-250))); }
function iconForNotification(n){ return n?.type === 'billing' ? 'bell' : 'chat'; }
function notificationItem(n, showTime=true){
  return `<button type="button" class="note notification-item ${n.read?'':'unread'}" data-notification-id="${n.id}"><div class="stat-icon">${icon(iconForNotification(n))}</div><div><strong>${escapeHtml(n.title)}</strong><br><span>${escapeHtml(n.body)}</span>${showTime?`<small>${fmtDateTime(n.createdAt)}</small>`:''}</div></button>`;
}
function removeNotificationBubble(){
  if(notificationBubbleTimer){ clearTimeout(notificationBubbleTimer); notificationBubbleTimer=null; }
  $('.notification-bubble')?.remove();
}
function showNotificationBubble(n){
  if(!n) return;
  removeNotificationBubble();
  const bell=$('#notificationBtn');
  const el=document.createElement('button');
  el.type='button';
  el.className='notification-bubble';
  el.innerHTML=`<span class="stat-icon">${icon(iconForNotification(n))}</span><span><strong>${escapeHtml(n.title)}</strong><small>${escapeHtml(n.body)}</small></span>`;
  el.addEventListener('click',()=>openNotification(n));
  document.body.appendChild(el);
  const rect=bell?.getBoundingClientRect();
  if(rect){
    el.style.top=`${Math.round(rect.bottom + 8)}px`;
    el.style.right=`${Math.max(12, Math.round(window.innerWidth - rect.right))}px`;
  } else {
    el.style.top='78px';
    el.style.right='24px';
  }
  notificationBubbleTimer=setTimeout(removeNotificationBubble,8000);
}
function processIncomingNotifications(rows=[]){
  if(!state.user) return;
  const seen=readSeenNotificationIds();
  const unseen=rows.filter(n=>n?.id && !n.read && !seen.has(n.id));
  if(!unseen.length) return;
  unseen.forEach(n=>seen.add(n.id));
  saveSeenNotificationIds(seen);
  showNotificationBubble(unseen[0]);
}
function updateNotificationBadge(){
  const btn=$('#notificationBtn');
  if(btn) btn.innerHTML=`${icon('bell')} ${unreadCount()?`<span class="count-dot">${unreadCount()}</span>`:''}`;
}

async function api(path, opts={}) {
  const headers = {'Content-Type':'application/json', ...(opts.headers||{})};
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(path, {...opts, headers});
  const data = await res.json().catch(()=>({ok:false,message:'Resposta inválida do servidor.'}));
  if (!res.ok || data.ok === false) throw new Error(data.message || 'Falha na requisição.');
  return data;
}
async function fileToDataUrl(input) {
  const file = input?.files?.[0];
  if (!file) return null;
  return await new Promise((resolve, reject) => { const r = new FileReader(); r.onload=()=>resolve({dataUrl:r.result, name:file.name}); r.onerror=reject; r.readAsDataURL(file); });
}
async function bootstrap() {
  if (!state.token) return renderLanding();
  try {
    const data = await api('/api/me');
    Object.assign(state, { user:data.user, company:data.company, subscription:data.subscription, notifications:data.notifications||[], legal:data.legal });
    renderApp();
    processIncomingNotifications(state.notifications);
    startNotificationPolling();
  } catch(e) { localStorage.removeItem('mei_token'); state.token=''; renderLanding(); }
}
function startNotificationPolling(){ if(notificationPollTimer) return; notificationPollTimer=setInterval(refreshNotifications,10000); }
function logout(skipConfirm=false){ if(!skipConfirm && !confirm('Deseja sair da conta?')) return; removeNotificationBubble(); localStorage.removeItem('mei_token'); clearTicketPolling(); clearTeamPolling(); if(notificationPollTimer){clearInterval(notificationPollTimer);notificationPollTimer=null;} Object.assign(state,{token:'',user:null,company:null,subscription:null,tab:'dashboard'}); renderLanding(); }
function setTab(tab){ state.tab=tab; localStorage.setItem('mei_tab',tab); renderApp(); loadTabData(); }

function landingHtml(){return `
<div class="landing">
  <header class="topbar"><div class="topbar-inner">${logo()}<div class="top-actions"><button class="btn ghost" data-open="login">Entrar</button><button class="btn primary" data-open="register">Começar teste grátis</button></div></div></header>
  <main>
    <section class="hero">
      <div>
        <span class="eyebrow">${icon('shield')} Plataforma brasileira para MEI</span>
        <h1>Controle seu MEI sem planilha confusa.</h1>
        <p>Registre faturamento, acompanhe o limite anual, organize o DAS, prepare sua DASN-SIMEI e fale com suporte por protocolo sempre que precisar.</p>
        <div class="hero-actions"><button class="btn primary" data-open="register">Começar teste grátis por 7 dias</button><button class="btn" data-open="login">Já tenho conta</button></div>
        <div class="trust-row"><div class="trust"><strong>R$ 81 mil</strong><span>limite anual de referência</span></div><div class="trust"><strong>DAS</strong><span>alertas de vencimento mensal</span></div><div class="trust"><strong>LGPD</strong><span>privacidade, aceite e exclusão</span></div></div>
      </div>
      <div class="product-card"><div class="mini-browser"><div class="browser-head"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div><div class="browser-body">
        <div class="limit-card"><small>FATURAMENTO ACUMULADO</small><h3>R$ 46.280,00</h3><div class="bar"><span></span></div><p>57% do limite anual utilizado</p></div>
        <div class="dash-grid"><div class="mini-stat"><i>${icon('wallet')}</i><b>R$ 8.750</b><span>Receita do mês</span></div><div class="mini-stat"><i>${icon('calendar')}</i><b>3 dias</b><span>Próximo DAS</span></div><div class="mini-stat"><i>${icon('chat')}</i><b>SUP-00018</b><span>Protocolo aberto</span></div><div class="mini-stat"><i>${icon('shield')}</i><b>Seguro</b><span>Dados com controle</span></div></div>
      </div></div></div>
    </section>
    <section class="section"><div class="section-title"><div><h2>Um sistema simples para rotina real de MEI</h2><p class="lead">Feito para quem vende, presta serviço, emite DAS e precisa enxergar o negócio sem depender de planilha quebrada.</p></div></div>
      <div class="cards">
        ${feature('chart','Limite do MEI','Veja faturamento acumulado, percentual usado e quanto ainda falta para o limite anual.')}
        ${feature('receipt','DAS e DASN-SIMEI','Calendário fiscal com vencimentos, comprovantes e status de pagamento.')}
        ${feature('chat','Suporte com protocolo','Abra chamados, envie imagens e acompanhe atendimento até finalizar.')}
        ${feature('flag','Moderação e denúncias','Canal separado para reportar uso indevido, má fé ou problemas de segurança.')}
        ${feature('card','Assinatura mensal','Teste grátis com checkout de cartão via gateway e avisos de cobrança.')}
        ${feature('shield','LGPD desde o início','Termos, privacidade, cookies, exportação e solicitação de exclusão de conta.')}
      </div>
    </section>
    <section class="section"><div class="pricing"><div><h2>Plano Pro MEI</h2><p>Comece com 7 dias de teste. Após o período gratuito, a assinatura mensal mantém seu painel, relatórios, suporte e histórico seguro.</p><div class="mini-actions"><span class="tag ok">Sem planilha</span><span class="tag ok">Suporte por protocolo</span><span class="tag ok">Dados salvos</span></div></div><div class="price-box"><div class="price">R$ 24,90 <small>/mês</small></div><p>Cancelamento pela plataforma, respeitando cobranças pendentes e regras de retenção legal.</p><button class="btn primary block" data-open="register">Criar minha conta</button></div></div></section>
  </main>
</div>${cookieBanner()}`}
function feature(ic,title,txt){return `<article class="feature"><div class="feat-icon">${icon(ic)}</div><h3>${title}</h3><p>${txt}</p></article>`}
function renderLanding(){ app.innerHTML = landingHtml() + authModal(); bindLanding(); }
function bindLanding(){ $$('[data-open]').forEach(b=>b.onclick=()=>{state.modal=b.dataset.open; state.authMode=b.dataset.open; renderLanding();}); $('.close')?.addEventListener('click',()=>{state.modal=null;renderLanding();}); $('#loginForm')?.addEventListener('submit',loginSubmit); $('#registerForm')?.addEventListener('submit',registerSubmit); bindCookie(); }
function authModal(){ if(!state.modal) return ''; return `<div class="modal-backdrop"><div class="modal"><div class="modal-head"><div><h2>${state.authMode==='login'?'Entrar na conta':'Criar conta MEI'}</h2><p class="lead">${state.authMode==='login'?'Acesse seu painel e protocolos.':'Comece seu teste grátis com dados reais do seu negócio.'}</p></div><button class="close">×</button></div>${state.authMode==='login'?loginForm():registerForm()}</div></div>`; }
function loginForm(){return `<form id="loginForm" class="form"><div class="field"><label>E-mail</label><input name="email" type="email" required value=""></div><div class="field"><label>Senha</label><input name="password" type="password" required></div><button class="btn primary block">Entrar</button><p class="check">Acessos iniciais da equipe: owner@meinocontrole.local, suporte@meinocontrole.local e moderacao@meinocontrole.local. Troque as senhas antes de publicar.</p></form>`}
function registerForm(){return `<form id="registerForm" class="form"><div class="row"><div class="field"><label>Nome do responsável</label><input name="name" required></div><div class="field"><label>E-mail</label><input name="email" type="email" required></div></div><div class="row"><div class="field"><label>Senha</label><input name="password" type="password" minlength="8" required></div><div class="field"><label>Telefone</label><input name="phone"></div></div><div class="row"><div class="field"><label>Nome do negócio</label><input name="businessName" required></div><div class="field"><label>CNPJ MEI</label><input name="cnpj" inputmode="numeric"></div></div><div class="field"><label>Tipo de atividade</label><select name="activityType"><option>Serviços</option><option>Comércio</option><option>Comércio + Serviços</option><option>Caminhoneiro</option></select></div><label class="check"><input type="checkbox" name="acceptTerms" required> Aceito os Termos de Uso, a Política de Privacidade e o tratamento dos dados necessários para funcionamento do sistema.</label><button class="btn primary block">Criar conta e ir para assinatura</button></form>`}
async function loginSubmit(e){e.preventDefault(); const fd=new FormData(e.target); try{const data=await api('/api/auth/login',{method:'POST',body:JSON.stringify(Object.fromEntries(fd))}); state.token=data.token; localStorage.setItem('mei_token',data.token); Object.assign(state,{user:data.user,company:data.company,subscription:data.subscription,modal:null}); toast('Login realizado.'); startNotificationPolling(); renderApp(); loadTabData();}catch(err){toast(err.message,'error')}}
async function registerSubmit(e){e.preventDefault(); const fd=new FormData(e.target); const body=Object.fromEntries(fd); body.acceptTerms=fd.get('acceptTerms')==='on'; try{const data=await api('/api/auth/register',{method:'POST',body:JSON.stringify(body)}); state.token=data.token; localStorage.setItem('mei_token',data.token); Object.assign(state,{user:data.user,company:data.company,subscription:data.subscription,modal:null,tab:'billing'}); toast('Conta criada. Finalize o checkout para liberar o teste.'); startNotificationPolling(); renderApp(); loadTabData();}catch(err){toast(err.message,'error')}}
function navItems(){
  if(state.user?.role==='owner') return [['admin','users','Admin'],['support','chat','Suporte'],['moderation','flag','Moderação'],['account','settings','Conta']];
  if(state.user?.role==='support') return [['support','chat','Atendimentos'],['account','settings','Conta']];
  if(state.user?.role==='moderator') return [['moderation','flag','Denúncias'],['account','settings','Conta']];
  return [['dashboard','chart','Dashboard'],['launches','wallet','Lançamentos'],['obligations','calendar','Obrigações'],['reports','file','Relatórios'],['support','chat','Suporte'],['report','flag','Denúncias'],['billing','card','Assinatura'],['account','settings','Conta']];
}
function normalizeTab(){
  const items = navItems();
  if(items.some(([id])=>id===state.tab)) return;
  state.tab = items[0]?.[0] || 'dashboard';
  localStorage.setItem('mei_tab', state.tab);
}
function titleForTab(){ return ({dashboard:'Dashboard',launches:'Lançamentos',obligations:'Obrigações fiscais',reports:'Relatórios',support:'Suporte por protocolo',report:'Denúncias e uso indevido',moderation:'Fila de moderação',billing:'Assinatura',account:'Conta e privacidade',admin:'Administração'}[state.tab]||'Painel'); }
function subtitleForTab(){ return ({dashboard:'Resumo do faturamento, limite anual e próximos vencimentos.',launches:'Receitas e despesas do seu MEI.',obligations:'DAS, DASN-SIMEI, comprovantes e status.',reports:'Resumo mensal para conferência ou envio ao contador.',support:'Abra ou acompanhe conversas com a equipe de suporte.',report:'Reporte abuso, má fé ou uso indevido da plataforma.',moderation:'Protocolos de denúncia com bloqueio por atendente.',billing:'Teste grátis, checkout e cobranças.',account:'Dados do MEI, notificações, cookies e LGPD.',admin:'Usuários internos, métricas e permissões.'}[state.tab]||''); }
function profileSummary(){
  const u=state.user||{};
  return `<button class="user-card profile-card" id="profileBtn">${avatar(u)}<span><strong>${escapeHtml(u.name)}</strong><small>${escapeHtml(roleBadge(u))} · ${u.ratingCount?`${u.ratingAvg} (${u.ratingCount})`:'sem avaliações'}</small><small>${escapeHtml(u.email)}</small></span></button>`;
}
function notificationPanel(){
  if(!state.notificationOpen) return '';
  const rows=state.notifications||[];
  return `<div class="notifications-pop"><div class="section-title compact"><h3>Notificações</h3><button class="btn" id="markNotificationsBtn">Marcar lidas</button></div>${rows.length?rows.slice(0,12).map(n=>notificationItem(n)).join(''):'<div class="empty">Nenhuma notificação.</div>'}</div>`;
}
function mediaModal(){ if(!state.mediaModal) return ''; const m=state.mediaModal; return `<div class="modal-backdrop media-backdrop"><div class="modal media-view"><div class="modal-head"><div><h2>${escapeHtml(m.name||'Mídia')}</h2><p class="lead">${escapeHtml(m.mime||'Imagem')}</p></div><button class="close" id="closeMediaModal">×</button></div><img src="${m.url}" alt="${escapeHtml(m.name||'Mídia da conversa')}"></div></div>`; }
function profileModal(){ if(!state.profileModal) return ''; const u=state.profileModal; return `<div class="modal-backdrop"><div class="modal profile-modal"><div class="modal-head"><div><h2>${escapeHtml(u.name)}</h2><p class="lead">${escapeHtml(u.email||'')}</p></div><button class="close" id="closeProfileModal">×</button></div><div class="profile-large">${avatar(u,'avatar big')}<div><span class="tag dark">${escapeHtml(roleBadge(u))}</span><div>${stars(u.ratingAvg)} <strong>${u.ratingAvg||'0.0'}</strong> <span class="muted">(${u.ratingCount||0} avaliações)</span></div></div></div></div></div>`; }
function teamMessageBubble(m){
  if(m.system) return `<div class="msg system"><strong>Sistema</strong><div>${escapeHtml(m.text||'')}</div><small>${fmtDateTime(m.createdAt)}</small></div>`;
  const sender=m.sender||{}; const cls=sender.id===state.user.id?'me':'';
  return `<div class="msg team-chat-msg ${cls}"><div class="msg-head">${avatar(sender,'avatar tiny')}<strong>${escapeHtml(sender.name||'Usuário')}</strong><span class="tag dark">${escapeHtml(roleBadge(sender))}</span></div>${m.text?`<div class="msg-text">${escapeHtml(m.text)}</div>`:''}${m.attachment?`<button class="media-thumb" data-media-url="${m.attachment.url}" data-media-name="${escapeHtml(m.attachment.name||'Mídia')}" data-media-mime="${escapeHtml(m.attachment.mime||'Imagem')}"><img src="${m.attachment.url}" alt="Mídia da conversa"></button>`:''}<small>${fmtDateTime(m.createdAt)}</small></div>`;
}
function teamChatModal(){
  if(!state.teamOpen) return '';
  const conv=state.currentTeamConversation;
  const available=(state.teamUsers||[]).filter(u=>u.id!==state.user.id);
  const canAdmin=conv && (conv.adminId===state.user.id || state.user.role==='owner');
  return `<div class="team-floating"><div class="team-head"><strong>Chat da equipe</strong><button class="close" id="closeTeamChat">×</button></div><div class="team-body"><aside class="team-list"><form id="teamConversationForm" class="team-create"><input name="title" placeholder="Nome do grupo opcional"><div class="team-users">${available.map(u=>`<label title="${escapeHtml(u.email)}"><input type="checkbox" name="memberIds" value="${u.id}">${avatar(u,'avatar tiny')} ${escapeHtml(u.name)}</label>`).join('')}</div><button class="btn primary block">Nova conversa</button></form><div class="team-convs">${(state.teamConversations||[]).map(c=>`<button class="${conv?.id===c.id?'active':''}" data-open-team="${c.id}"><strong>${escapeHtml(c.title||c.members?.filter(m=>m?.id!==state.user.id).map(m=>m.name).join(', ')||'Conversa')}</strong><small>${escapeHtml(c.lastMessage?.text||'Sem mensagens')}</small></button>`).join('')||'<div class="empty">Nenhuma conversa.</div>'}</div></aside><main class="team-thread">${conv?`<div class="team-thread-head"><div><strong>${escapeHtml(conv.title||'Conversa')}</strong><small>${conv.members?.map(m=>`${m.name} (${roleBadge(m)})`).join(' · ')}</small></div><div class="mini-actions">${canAdmin&&conv.type==='group'?`<select id="addTeamMember"><option value="">Adicionar membro</option>${available.filter(u=>!conv.members.some(m=>m.id===u.id)).map(u=>`<option value="${u.id}">${escapeHtml(u.name)}</option>`).join('')}</select><select id="removeTeamMember"><option value="">Remover membro</option>${conv.members.filter(m=>m.id!==state.user.id).map(m=>`<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('')}</select>`:''}<button class="btn danger" id="deleteTeamConversation">Excluir</button></div></div><div class="chat team-chat">${(state.teamMessages||[]).map(teamMessageBubble).join('')}</div><form id="teamMessageForm" class="form chat-compose"><textarea name="text" placeholder="Mensagem para a equipe"></textarea><label class="file-inline">Imagem <input name="attachment" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label><button class="btn primary">Enviar</button></form>`:'<div class="empty">Abra ou crie uma conversa.</div>'}</main></div></div>`;
}
function renderApp(){
  if(!state.user) return renderLanding();
  normalizeTab();
  app.innerHTML = `<div class="shell"><aside class="sidebar" id="sidebar">${logo()}${profileSummary()}<nav class="nav">${navItems().map(([id,ic,label])=>`<button class="${state.tab===id?'active':''}" data-tab="${id}">${icon(ic)} ${label}</button>`).join('')}</nav><div class="sidebar-foot">${isStaff()?'<button class="btn block" id="teamChatBtn">'+icon('chat')+' Chat equipe</button>':''}<button class="btn block" id="refreshBtn">Atualizar</button><button class="btn danger block" id="logoutBtn">${icon('logout')} Sair</button></div></aside><main class="main"><header class="main-top"><div><button class="btn mobile-menu" id="menuBtn">Menu</button><h1>${titleForTab()}</h1><p>${subtitleForTab()}</p></div><div class="mini-actions">${state.subscription?statusTag(state.subscription.status):''}<button class="btn" id="notificationBtn">${icon('bell')} ${unreadCount()?`<span class="count-dot">${unreadCount()}</span>`:''}</button>${isStaff()?'<button class="btn" id="teamChatTopBtn">'+icon('chat')+' Equipe</button>':''}<button class="btn primary" id="quickAction">${quickActionLabel()}</button></div>${notificationPanel()}</header><section class="content" id="content">${renderTab()}</section></main></div>${ticketModal()}${mediaModal()}${profileModal()}${userEditModal()}${teamChatModal()}${cookieBanner()}`;
  bindShell(); bindTab(); bindCookie();
}
function bindShell(){
  $$('.nav button').forEach(b=>b.onclick=()=>{setTab(b.dataset.tab); $('#sidebar')?.classList.remove('open')});
  $('#logoutBtn')?.addEventListener('click',()=>logout()); $('#logoutBtn')?.setAttribute('aria-label','Sair'); $('#refreshBtn')?.addEventListener('click',()=>loadTabData(true)); $('#menuBtn')?.addEventListener('click',()=>$('#sidebar')?.classList.add('open'));
  $('#profileBtn')?.addEventListener('click',()=>{state.profileModal=state.user;renderApp();});
  $('#notificationBtn')?.addEventListener('click',()=>{state.notificationOpen=!state.notificationOpen;renderApp();});
  $('#markNotificationsBtn')?.addEventListener('click',markNotificationsRead);
  $$('[data-notification-id]').forEach(b=>b.onclick=()=>openNotificationById(b.dataset.notificationId));
  $('#teamChatBtn')?.addEventListener('click',openTeamChat);
  $('#teamChatTopBtn')?.addEventListener('click',openTeamChat);
  $('#quickAction')?.addEventListener('click',()=>{ if(state.tab==='launches') $('#launchTitle')?.focus(); else if(isCustomer()&&!planOk()) setTab('billing'); else if(isCustomer()) setTab('launches'); else setTab(state.user.role==='moderator'?'moderation':'support'); });
}
function openNotificationById(id){
  const notification=(state.notifications||[]).find(n=>n.id===id);
  if(notification) openNotification(notification);
}
async function openNotification(notification){
  if(!notification) return;
  removeNotificationBubble();
  state.notificationOpen=false;
  state.notifications=state.notifications.map(n=>n.id===notification.id?{...n,read:true}:n);
  updateNotificationBadge();
  try{ await api('/api/notifications/read',{method:'POST',body:JSON.stringify({ids:[notification.id]})}); }catch{}
  const target=notification.target||{};
  if(target.kind==='ticket' && target.ticketId){
    const tab=target.ticketType==='report' ? (isStaff()?'moderation':'report') : 'support';
    state.tab=tab; localStorage.setItem('mei_tab',tab);
    renderApp();
    await loadTabData();
    await openTicket(target.ticketId);
    return;
  }
  if(target.kind==='team-chat' && target.conversationId && isStaff()){
    await openTeamChat();
    await openTeamConversation(target.conversationId);
    return;
  }
  if(target.kind==='billing'){ setTab('billing'); return; }
  if(notification.type==='team-chat' && isStaff()){ await openTeamChat(); return; }
  if(['ticket','feedback'].includes(notification.type)){ setTab(isStaff() ? (state.user.role==='moderator'?'moderation':'support') : 'support'); return; }
  renderApp();
}
function quickActionLabel(){ if(isCustomer()&&!planOk()) return 'Liberar teste'; if(state.tab==='launches') return 'Novo lançamento'; if(isCustomer()) return 'Novo lançamento'; return 'Ver fila'; }
function statusTag(s){ const map={pending_checkout:['warn','Checkout pendente'],trialing:['ok','Teste grátis'],active:['ok','Plano ativo'],past_due:['danger','Pagamento pendente'],canceled:['danger','Cancelado']}; const m=map[s]||['dark',s]; return `<span class="tag ${m[0]}">${m[1]}</span>`; }
function renderTab(){
  if(isCustomer() && !planOk() && !['billing','support','report','account'].includes(state.tab)) return lockView();
  return ({dashboard:dashboardView, launches:launchesView, obligations:obligationsView, reports:reportsView, support:supportView, report:reportView, moderation:moderationView, billing:billingView, account:accountView, admin:adminView}[state.tab] || dashboardView)();
}
function lockView(){ return `<div class="lock"><div><h2>Finalize o checkout para liberar o painel</h2><p>Seu cadastro está pronto. Para iniciar o teste grátis de 7 dias, valide o método de pagamento pelo checkout seguro. Depois disso, os módulos de faturamento, obrigações e relatórios ficam disponíveis.</p><div class="mini-actions"><span class="tag ok">7 dias grátis</span><span class="tag ok">Dados salvos</span><span class="tag ok">Cancelamento pela conta</span></div></div><div><button class="btn primary block" id="startTrialBtn">Iniciar teste com checkout</button><button class="btn block" onclick="setTab('support')">Falar com suporte</button></div></div>`; }
function dashboardView(){
  const d=state.dashboard; if(!d) return loadingPanel('Carregando dashboard...'); const c=d.current||{}; const pct=Math.min(100,c.percent||0); const statusClass=c.status==='limit_exceeded'?'danger':c.status==='warning'?'warn':'ok';
  return `<div class="grid"><div class="panel soft"><div class="section-title"><div><h2>Faturamento acumulado de ${d.year}</h2><p class="lead">${money(c.accumulated)} de ${money(d.company.annualLimit)} usados no limite de referência.</p></div><span class="tag ${statusClass}">${c.percent||0}% do limite</span></div><div class="progress"><span style="width:${pct}%"></span></div></div>
  <div class="grid cols-4">${stat('wallet','Receita do mês',money(c.revenue), 'ok')}${stat('receipt','Despesas do mês',money(c.expenses),'danger')}${stat('chart','Saldo do mês',money((c.revenue||0)-(c.expenses||0)),'dark')}${stat('shield','Disponível no limite',money(Math.max(0,d.company.annualLimit-(c.accumulated||0))),'ok')}</div>
  <div class="grid cols-2"><div class="panel"><h3>Resumo por mês</h3>${monthsTable(d.months)}</div><div class="panel"><h3>Próximas obrigações</h3>${obligationsList(d.obligations)}</div></div>
  <div class="panel"><h3>Últimos lançamentos</h3>${launchesTable(d.launches,true)}</div></div>`;
}
function stat(ic,label,value,type='ok'){return `<div class="panel"><div class="stat"><div class="stat-icon">${icon(ic)}</div><div><span>${label}</span><b>${value}</b></div></div></div>`}
function monthsTable(rows=[]){ return `<div class="table-wrap"><table><thead><tr><th>Mês</th><th>Receita</th><th>Acumulado</th><th>Limite</th><th>Status</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.name}</td><td>${money(r.revenue)}</td><td>${money(r.accumulated)}</td><td>${r.percent}%</td><td>${statusTag(r.status==='limit_exceeded'?'past_due':r.status==='warning'?'pending_checkout':'active')}</td></tr>`).join('')}</tbody></table></div>`}
function obligationsList(rows=[]){ if(!rows.length) return `<div class="empty">Nenhuma obrigação pendente.</div>`; return `<div class="timeline">${rows.map(o=>`<div class="note"><div class="stat-icon">${icon('calendar')}</div><div><strong>${escapeHtml(o.title)}</strong><br><span>${dt(o.dueDate)} · ${money(o.amount)} · ${obligationStatus(o.status)}</span></div></div>`).join('')}</div>`; }
function obligationStatus(s){return ({pending:'Pendente',paid:'Pago',late:'Atrasado'}[s]||s)}
function launchesView(){ return `<div class="grid cols-2"><div class="panel"><h2>Novo lançamento</h2><form id="launchForm" class="form"><div class="field"><label>Descrição</label><input id="launchTitle" name="title" required placeholder="Venda para cliente, compra de material, serviço recebido"></div><div class="row"><div class="field"><label>Data</label><input name="date" type="date" required value="${new Date().toISOString().slice(0,10)}"></div><div class="field"><label>Tipo</label><select name="type"><option value="revenue">Receita</option><option value="expense">Despesa</option></select></div></div><div class="row"><div class="field"><label>Categoria</label><select name="category"><option>Prestação de Serviço</option><option>Venda de Produto</option><option>Imposto/DAS</option><option>Fornecedor</option><option>Equipamento</option><option>Marketing</option><option>Retirada do dono</option><option>Outros</option></select></div><div class="field"><label>Valor</label><input name="amount" type="number" step="0.01" min="0.01" required></div></div><div class="row"><div class="field"><label>Cliente/fornecedor</label><input name="contactName"></div><div class="field"><label>Forma de pagamento</label><select name="paymentMethod"><option>Pix</option><option>Cartão</option><option>Dinheiro</option><option>Transferência</option><option>Boleto</option></select></div></div><label class="check"><input type="checkbox" name="invoiceIssued"> Nota fiscal emitida</label><div class="field"><label>Observações</label><textarea name="notes"></textarea></div><button class="btn primary block">Salvar lançamento</button></form></div><div class="panel"><h2>Lançamentos registrados</h2>${launchesTable(state.launches)}</div></div>`; }
function launchesTable(rows=[],compact=false){ if(!rows.length)return `<div class="empty">Nenhum lançamento registrado.</div>`; return `<div class="table-wrap"><table><thead><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th>Categoria</th><th>Valor</th>${compact?'':'<th></th>'}</tr></thead><tbody>${rows.map(l=>`<tr><td>${dt(l.date)}</td><td>${escapeHtml(l.title)}</td><td><span class="tag ${l.type==='revenue'?'ok':'danger'}">${l.type==='revenue'?'Receita':'Despesa'}</span></td><td>${escapeHtml(l.category)}</td><td><strong>${money(l.amount)}</strong></td>${compact?'':`<td><button class="btn danger" data-del-launch="${l.id}">Excluir</button></td>`}</tr>`).join('')}</tbody></table></div>`; }
function obligationsView(){ return `<div class="panel"><div class="section-title"><div><h2>Obrigações fiscais</h2><p class="lead">Marque como pago e anexe comprovantes quando necessário.</p></div></div>${obligationsTable(state.obligations)}</div>`; }
function obligationsTable(rows=[]){ if(!rows.length)return loadingPanel('Carregando obrigações...'); return `<div class="table-wrap"><table><thead><tr><th>Obrigação</th><th>Tipo</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Comprovante</th><th>Ação</th></tr></thead><tbody>${rows.map(o=>`<tr><td>${escapeHtml(o.title)}</td><td>${escapeHtml(o.type)}</td><td>${dt(o.dueDate)}</td><td>${money(o.amount)}</td><td><span class="tag ${o.status==='paid'?'ok':o.status==='late'?'danger':'warn'}">${obligationStatus(o.status)}</span></td><td>${o.receiptUrl?`<a href="${o.receiptUrl}" target="_blank">Ver arquivo</a>`:'—'}</td><td><button class="btn" data-ob-paid="${o.id}">Marcar pago</button></td></tr>`).join('')}</tbody></table></div>`; }
function reportsView(){ const month=new Date().getMonth()+1; return `<div class="grid cols-2"><div class="panel"><h2>Gerar relatório mensal</h2><form id="reportForm" class="form"><div class="row"><div class="field"><label>Ano</label><input name="year" type="number" value="${new Date().getFullYear()}"></div><div class="field"><label>Mês</label><select name="month">${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${i+1===month?'selected':''}>${new Date(2026,i,1).toLocaleString('pt-BR',{month:'long'})}</option>`).join('')}</select></div></div><button class="btn primary">Gerar resumo</button></form></div><div class="panel" id="reportResult"><div class="empty">Escolha o período para gerar o resumo.</div></div></div>`; }
function loadingPanel(txt){ return `<div class="panel"><div class="empty">${txt}</div></div>` }
function supportView(){ if(isCustomer()) return `<div class="grid cols-2"><div class="panel"><h2>Abrir solicitação</h2>${ticketForm('support')}</div><div class="panel"><h2>Meus protocolos</h2>${ticketQueue('support')}</div></div>`; return staffTicketsView('support','Atendimento de suporte'); }
function reportView(){ return `<div class="grid cols-2"><div class="panel"><h2>Registrar denúncia</h2><p class="lead">Use este canal para reportar uso indevido, má fé, abuso, fraude ou problema de segurança.</p>${ticketForm('report')}</div><div class="panel"><h2>Minhas denúncias</h2>${ticketQueue('report')}</div></div>`; }
function moderationView(){ return staffTicketsView('report','Moderação e denúncias'); }
function ticketForm(type){return `<form id="ticketForm" class="form" data-type="${type}"><div class="field"><label>Título</label><input name="title" required placeholder="Descreva o assunto principal"></div><div class="field"><label>Categoria</label><select name="category">${type==='report'?'<option>Uso indevido</option><option>Fraude ou má fé</option><option>Abuso</option><option>Segurança</option>':'<option>Pagamento</option><option>DAS e obrigações</option><option>Faturamento</option><option>Erro no sistema</option><option>Conta e dados</option>'}</select></div><div class="field"><label>Mensagem</label><textarea name="description" required></textarea></div><div class="field"><label>Imagem opcional</label><input name="attachment" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></div><button class="btn primary block">Abrir protocolo</button></form>`}
function staffTicketsView(type,title){
  return `<div class="grid"><div class="panel"><div class="section-title compact"><div><h2>${title}</h2><p class="lead">Urgentes aparecem no topo; use os filtros para separar abertos, em atendimento e finalizados.</p></div><div class="segmented"><button class="${state.supportSubtab==='queue'?'active':''}" data-support-subtab="queue">Fila</button><button class="${state.supportSubtab==='experience'?'active':''}" data-support-subtab="experience">Experiência</button></div></div>${state.supportSubtab==='experience'?experienceView(type):`${ticketFilters()}${ticketQueue(type)}`}</div></div>`;
}
function ticketFilters(){ return `<div class="filters"><label>Status <select id="ticketFilter"><option value="all">Todos</option><option value="open">Abertos</option><option value="in_progress">Em atendimento</option><option value="closed">Finalizados</option><option value="urgent">Urgentes</option></select></label></div>`; }
function filteredTickets(type){
  let rows=(state.tickets||[]).filter(t=>t.type===type);
  if(state.ticketFilter==='urgent') rows=rows.filter(t=>t.priority==='urgent');
  else if(state.ticketFilter!=='all') rows=rows.filter(t=>t.status===state.ticketFilter);
  return rows;
}
function ticketQueue(type){ const rows=filteredTickets(type); if(!rows.length)return `<div class="empty">Nenhum protocolo encontrado.</div>`; return `<div class="grid">${rows.map(t=>`<article class="ticket ${t.priority==='urgent'?'urgent':''}"><div><h3>${escapeHtml(t.title)} <span class="tag dark">${t.protocol}</span> ${t.priority==='urgent'?'<span class="tag danger">Urgente</span>':''}</h3><p>${escapeHtml(t.category)} · ${ticketStatus(t.status)} · Aberto em ${fmtDateTime(t.createdAt)} · Cliente: ${escapeHtml(t.customer?.name||'—')} ${t.assignee?`· Atendimento: ${escapeHtml(t.assignee.name)} (${escapeHtml(roleBadge(t.assignee))})`:''}</p>${t.queueInfo?.message?`<small class="queue-note">${escapeHtml(t.queueInfo.message)}</small>`:''}</div><div class="mini-actions">${isStaff()&&t.status==='open'?`<button class="btn primary" data-start-ticket="${t.id}">Iniciar</button>`:''}<button class="btn" data-open-ticket="${t.id}">Abrir conversa</button>${t.status!=='closed'?`<button class="btn danger" data-close-ticket="${t.id}">Finalizar</button>`:''}</div></article>`).join('')}</div>`; }
function experienceView(type){
  const rows=(state.feedbacks||[]).filter(f=>f.ticket?.type===type);
  const ranking=(state.ranking||[]).filter(r=>r.ratingCount);
  return `<div class="grid cols-2"><div class="panel flat"><h3>Feedback dos usuários</h3>${rows.length?`<div class="table-wrap"><table><thead><tr><th>Nota</th><th>Cliente</th><th>Atendente</th><th>Comentário</th><th>Conversa</th></tr></thead><tbody>${rows.map(f=>`<tr><td>${stars(f.rating)} ${feedbackMood(f.rating)}</td><td>${escapeHtml(f.customer?.name||'—')}</td><td>${escapeHtml(f.assignee?.name||'Sem atendente')}</td><td>${escapeHtml(f.comment||'—')}</td><td><button class="btn" data-open-ticket="${f.ticketId}">Abrir</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Nenhuma avaliação registrada ainda.</div>'}</div><div class="panel flat"><h3>Ranking de atendimento</h3>${ranking.length?`<div class="ranking">${ranking.map((r,i)=>`<div class="rank-row"><strong>${i+1}</strong>${avatar(r.user,'avatar tiny')}<span>${escapeHtml(r.user.name)}<small>${escapeHtml(roleBadge(r.user))}</small></span><b>${r.ratingAvg}</b>${stars(r.ratingAvg)}</div>`).join('')}</div>`:'<div class="empty">O ranking aparece após as primeiras avaliações.</div>'}</div></div>`;
}
function ticketStatus(s){return ({open:'Aberto',in_progress:'Em atendimento',closed:'Finalizado'}[s]||s)}
function messageBubble(m){
  if(m.system) return `<div class="msg system"><strong>Sistema</strong><div>${escapeHtml(m.text||'')}</div><small>${fmtDateTime(m.createdAt)}</small></div>`;
  const sender=m.sender||{}; const team=isTeamRole(sender.role);
  const cls=isCustomer() ? (sender.id===state.user.id?'customer me':'team') : (team?(sender.id===state.user.id?'team me':'team other-team'):'customer');
  return `<div class="msg ${cls}"><div class="msg-head">${avatar(sender,'avatar tiny')}<strong>${escapeHtml(sender.name||'Usuário')}</strong><span class="tag dark">${escapeHtml(roleBadge(sender))}</span></div>${m.text?`<div class="msg-text">${escapeHtml(m.text)}</div>`:''}${m.attachment?`<button class="media-thumb" data-media-url="${m.attachment.url}" data-media-name="${escapeHtml(m.attachment.name||'Mídia')}" data-media-mime="${escapeHtml(m.attachment.mime||'Imagem')}"><img src="${m.attachment.url}" alt="Mídia da conversa"></button>`:''}<small>${fmtDateTime(m.createdAt)}</small></div>`;
}
function feedbackPrompt(t){
  if(t.status!=='closed') return '';
  if(!isCustomer()) return '<div class="empty compact-empty">Este protocolo foi finalizado. Ninguém pode escrever novas mensagens neste chamado.</div>';
  if(state.ticketFeedback) return `<div class="feedback-done"><strong>Avaliação enviada</strong>${stars(state.ticketFeedback.rating)}<span>${feedbackMood(state.ticketFeedback.rating)}</span><p>${escapeHtml(state.ticketFeedback.comment||'Sem comentário.')}</p></div>`;
  return `<form id="feedbackForm" class="feedback-form"><strong>Como foi sua experiência?</strong><div class="rating-picker">${[1,2,3,4,5].map(i=>`<label><input type="radio" name="rating" value="${i}" required><span>${'★'.repeat(i)}</span><b>${feedbackMood(i)}</b></label>`).join('')}</div><textarea name="comment" placeholder="Comentário opcional"></textarea><button class="btn primary">Enviar avaliação</button></form>`;
}
function ticketMetaText(t){ return `${ticketStatus(t.status)} · Aberto em ${fmtDateTime(t.createdAt)}${t.assignee?` · Atendente: ${t.assignee.name}`:''}`; }
function ticketChatHtml(){
  const t=state.currentTicket;
  const queue=state.queueInfo?.message?`<div class="msg system queue-system"><strong>Sistema de fila</strong><div>${escapeHtml(state.queueInfo.message)}</div></div>`:'';
  return `${queue}${(state.messages||[]).map(messageBubble).join('')}${feedbackPrompt(t)}`;
}
function ticketComposeHtml(t){
  return t.status==='closed'
    ? '<div class="empty compact-empty">Conversa encerrada. Para continuar, abra um novo protocolo.</div>'
    : `<form id="messageForm" class="form chat-compose"><textarea id="messageText" name="text" placeholder="Escreva sua resposta"></textarea><label class="file-inline">Imagem <input name="attachment" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label><button class="btn primary">Enviar</button><button type="button" class="btn danger" id="closeTicketBtn">Finalizar</button></form>`;
}
function ticketModal(){ if(!state.currentTicket) return ''; const t=state.currentTicket; return `<div class="modal-backdrop"><div class="modal wide chat-modal"><div class="modal-head chat-head"><div><h2>${escapeHtml(t.protocol)} · ${escapeHtml(t.title)}</h2><p class="lead" id="ticketModalMeta">${escapeHtml(ticketMetaText(t))}</p></div><button class="close" id="closeTicketModal">×</button></div><div class="chat" id="ticketChatBody">${ticketChatHtml()}</div><div id="ticketComposeArea">${ticketComposeHtml(t)}</div></div></div>`; }
function bindTicketDynamic(){
  if($('#messageForm')) $('#messageForm').onsubmit=sendMessage;
  if($('#closeTicketBtn')) $('#closeTicketBtn').onclick=()=>closeTicket(state.currentTicket.id);
  if($('#feedbackForm')) $('#feedbackForm').onsubmit=sendFeedback;
  $$('[data-media-url]', $('.chat-modal') || document).forEach(b=>b.onclick=()=>{state.mediaModal={url:b.dataset.mediaUrl,name:b.dataset.mediaName,mime:b.dataset.mediaMime};renderApp();});
}
function syncTicketModal(draft='', updateCompose=false){
  if(!$('.chat-modal') || !state.currentTicket){ renderApp(); return; }
  const chat=$('#ticketChatBody');
  if(chat) chat.innerHTML=ticketChatHtml();
  const meta=$('#ticketModalMeta');
  if(meta) meta.textContent=ticketMetaText(state.currentTicket);
  const compose=$('#ticketComposeArea');
  if(compose && updateCompose) compose.innerHTML=ticketComposeHtml(state.currentTicket);
  bindTicketDynamic();
  const input=$('#messageText');
  if(input && draft) input.value=draft;
  scrollChatBottom();
}
function billingView(){ const s=state.subscription||{}; return `<div class="grid cols-2"><div class="panel soft"><h2>Assinatura</h2><div class="kpi-line"><span>Status</span>${statusTag(s.status||'pending_checkout')}</div><div class="kpi-line"><span>Plano</span><strong>${escapeHtml(s.planName||'Plano Pro MEI no Controle')}</strong></div><div class="kpi-line"><span>Valor</span><strong>${money(s.price||24.9)}/mês</strong></div><div class="kpi-line"><span>Fim do teste</span><strong>${s.trialEndAt?new Date(s.trialEndAt).toLocaleString('pt-BR'):'Após checkout validado'}</strong></div><div class="kpi-line"><span>Próxima cobrança</span><strong>${s.nextBillingAt?new Date(s.nextBillingAt).toLocaleString('pt-BR'):'Pendente'}</strong></div><div class="mini-actions" style="margin-top:16px"><button class="btn primary" id="startTrialBtn">${['trialing','active'].includes(s.status)?'Assinatura liberada':'Iniciar teste com checkout'}</button>${s.checkoutUrl?`<a class="btn" href="${s.checkoutUrl}" target="_blank">Abrir checkout</a>`:''}<button class="btn danger" id="cancelPlanBtn">Cancelar assinatura</button></div></div><div class="panel"><h2>Como funciona a cobrança</h2><ul class="legal-list"><li>O teste grátis começa depois da validação do método de pagamento.</li><li>A plataforma avisa durante o teste e antes das próximas cobranças.</li><li>Em produção, o cartão é informado no checkout seguro do gateway. O sistema não salva número completo do cartão.</li><li>Se houver pagamento pendente, alguns recursos podem ficar restritos até regularização.</li></ul></div></div>`; }
function profileSettingsForm(){ return `<form id="profileForm" class="form"><div class="profile-large small">${avatar(state.user,'avatar big')}<div><span class="tag dark">${escapeHtml(roleBadge(state.user))}</span><div>${stars(state.user?.ratingAvg)} <strong>${state.user?.ratingAvg||'0.0'}</strong></div></div></div><div class="field"><label>Nome</label><input name="name" value="${escapeHtml(state.user?.name||'')}"></div><div class="field"><label>Telefone</label><input name="phone" value="${escapeHtml(state.user?.phone||'')}"></div><div class="field"><label>Foto de perfil</label><input name="avatar" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></div><button class="btn primary block">Salvar perfil</button></form>`; }
function accountView(){ return `<div class="grid cols-2"><div class="panel"><h2>Perfil</h2>${profileSettingsForm()}</div><div class="panel"><h2>Dados do MEI</h2><form id="companyForm" class="form"><div class="field"><label>Razão/Nome do negócio</label><input name="businessName" value="${escapeHtml(state.company?.businessName||'')}"></div><div class="field"><label>Nome fantasia</label><input name="tradeName" value="${escapeHtml(state.company?.tradeName||'')}"></div><div class="row"><div class="field"><label>CNPJ</label><input name="cnpj" value="${escapeHtml(state.company?.cnpj||'')}"></div><div class="field"><label>Atividade</label><select name="activityType">${['Serviços','Comércio','Comércio + Serviços','Caminhoneiro'].map(x=>`<option ${state.company?.activityType===x?'selected':''}>${x}</option>`).join('')}</select></div></div><div class="row"><div class="field"><label>Limite anual</label><input name="annualLimit" type="number" step="0.01" value="${state.company?.annualLimit||81000}"></div><div class="field"><label>Valor DAS mensal</label><input name="dasValue" type="number" step="0.01" value="${state.company?.dasValue||86.05}"></div></div><button class="btn primary block">Salvar dados</button></form></div><div class="panel"><h2>Notificações</h2>${notificationsView()}</div><div class="panel"><h2>Privacidade e cookies</h2><ul class="legal-list"><li>Você pode exportar seus dados solicitando pelo suporte.</li><li>Você pode solicitar exclusão da conta, desde que não exista pagamento pendente.</li><li>Dados obrigatórios podem ser mantidos por prazo legal ou defesa de direitos.</li></ul><button class="btn" id="cookieResetBtn">Revisar cookies</button></div><div class="panel danger-zone"><h2>Zona de risco</h2><p class="lead">A exclusão desativa sua conta e inicia o processo de remoção dos dados não obrigatórios.</p><button class="btn danger" id="deleteAccountBtn">Solicitar exclusão da conta</button></div></div>`; }
function notificationsView(){ const rows=state.notifications||[]; if(!rows.length)return '<div class="empty">Nenhuma notificação.</div>'; return `<div class="timeline">${rows.slice(0,10).map(n=>notificationItem(n,false)).join('')}</div>`; }
function adminView(){ return `<div class="grid"><div class="grid cols-4">${stat('users','Clientes',state.metrics?.customers??'—')}${stat('card','Assinaturas',state.metrics?.activeSubscriptions??'—')}${stat('chat','Suporte aberto',state.metrics?.pendingTickets??'—')}${stat('flag','Denúncias abertas',state.metrics?.pendingReports??'—')}</div><div class="grid cols-2"><div class="panel"><h2>Criar usuário interno</h2><form id="staffForm" class="form"><div class="field"><label>Nome</label><input name="name" required></div><div class="field"><label>E-mail</label><input name="email" type="email" required></div><div class="row"><div class="field"><label>Cargo</label><select name="role"><option value="support">Suporte</option><option value="moderator">Moderação</option><option value="owner">Founder/Owner</option></select></div><div class="field"><label>Senha temporária</label><input name="password" value="Equipe@123456!"></div></div><button class="btn primary block">Criar usuário</button></form></div><div class="panel"><div class="section-title compact"><h2>Usuários</h2><p class="lead">Owner pode editar cargo, status, senha, perfil e excluir contas.</p></div>${usersTable()}</div></div></div>`; }
function usersTable(){ if(!state.users?.length)return '<div class="empty">Carregando usuários.</div>'; return `<div class="table-wrap"><table><thead><tr><th>Perfil</th><th>E-mail</th><th>Cargo</th><th>Status</th><th>Avaliação</th><th>Ações</th></tr></thead><tbody>${state.users.map(u=>`<tr><td><div class="user-line">${avatar(u,'avatar tiny')}<span>${escapeHtml(u.name)}</span></div></td><td>${escapeHtml(u.email)}</td><td>${escapeHtml(roleBadge(u))}</td><td>${escapeHtml(u.status)}</td><td>${stars(u.ratingAvg)} ${u.ratingCount||0}</td><td><div class="mini-actions"><button class="btn" data-edit-user="${u.id}">Editar</button>${u.id!==state.user.id?`<button class="btn danger" data-delete-user="${u.id}">Excluir</button>`:''}</div></td></tr>`).join('')}</tbody></table></div>`; }
function userEditModal(){ const u=state.editingUser; if(!u)return ''; return `<div class="modal-backdrop"><div class="modal"><div class="modal-head"><div><h2>Editar usuário</h2><p class="lead">${escapeHtml(u.email)}</p></div><button class="close" id="closeUserEdit">×</button></div><form id="adminUserForm" class="form"><input type="hidden" name="id" value="${u.id}"><div class="field"><label>Nome</label><input name="name" value="${escapeHtml(u.name||'')}" required></div><div class="field"><label>E-mail</label><input name="email" type="email" value="${escapeHtml(u.email||'')}" required></div><div class="row"><div class="field"><label>Cargo</label><select name="role">${[['customer','Cliente'],['support','Suporte'],['moderator','Moderador'],['owner','Founder/Owner']].map(([id,label])=>`<option value="${id}" ${u.role===id?'selected':''}>${label}</option>`).join('')}</select></div><div class="field"><label>Status</label><select name="status">${['active','blocked','deleted'].map(s=>`<option value="${s}" ${u.status===s?'selected':''}>${s}</option>`).join('')}</select></div></div><div class="row"><div class="field"><label>Telefone</label><input name="phone" value="${escapeHtml(u.phone||'')}"></div><div class="field"><label>CPF/CNPJ</label><input name="cpfCnpj" value="${escapeHtml(u.cpfCnpj||'')}"></div></div><div class="field"><label>Nova senha (opcional)</label><input name="password" type="password"></div><label class="check"><input type="checkbox" name="forcePasswordChange" ${u.forcePasswordChange?'checked':''}> Forçar troca de senha no próximo acesso</label><div class="field"><label>Foto de perfil</label><input name="avatar" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></div><button class="btn primary block">Salvar alterações</button></form></div></div>`; }
function cookieBanner(){ if(localStorage.getItem('mei_cookie_ok')) return ''; return `<div class="cookie"><div><strong>Preferências de cookies</strong><p>Usamos cookies necessários para login e segurança. Você pode liberar ou recusar cookies analíticos e de marketing.</p></div><div class="mini-actions"><button class="btn" id="cookieNecessary">Somente necessários</button><button class="btn primary" id="cookieAccept">Aceitar todos</button></div></div>`; }
function bindCookie(){ $('#cookieNecessary')?.addEventListener('click',()=>saveCookie(false,false)); $('#cookieAccept')?.addEventListener('click',()=>saveCookie(true,true)); }
async function saveCookie(analytics,marketing){ localStorage.setItem('mei_cookie_ok','true'); if(state.token){ try{await api('/api/cookies/consent',{method:'POST',body:JSON.stringify({analytics,marketing})});}catch{} } renderApp(); }
function bindTab(){
  $('#startTrialBtn')?.addEventListener('click',startTrial);
  $('#cancelPlanBtn')?.addEventListener('click',cancelPlan);
  $('#launchForm')?.addEventListener('submit',createLaunch);
  $$('[data-del-launch]').forEach(b=>b.onclick=()=>deleteLaunch(b.dataset.delLaunch));
  $$('[data-ob-paid]').forEach(b=>b.onclick=()=>markObligationPaid(b.dataset.obPaid));
  $('#reportForm')?.addEventListener('submit',generateReport);
  $('#ticketForm')?.addEventListener('submit',createTicket);
  $('#ticketFilter')?.addEventListener('change',e=>{state.ticketFilter=e.target.value;localStorage.setItem('mei_ticket_filter',state.ticketFilter);renderApp();});
  if($('#ticketFilter')) $('#ticketFilter').value=state.ticketFilter;
  $$('[data-support-subtab]').forEach(b=>b.onclick=()=>{state.supportSubtab=b.dataset.supportSubtab;localStorage.setItem('mei_support_subtab',state.supportSubtab);renderApp();loadTabData();});
  $$('[data-open-ticket]').forEach(b=>b.onclick=()=>openTicket(b.dataset.openTicket));
  $$('[data-start-ticket]').forEach(b=>b.onclick=()=>startTicket(b.dataset.startTicket));
  $$('[data-close-ticket]').forEach(b=>b.onclick=()=>closeTicket(b.dataset.closeTicket));
  $('#closeTicketModal')?.addEventListener('click',()=>{clearTicketPolling();state.currentTicket=null;state.messages=[];state.queueInfo=null;renderApp();});
  bindTicketDynamic();
  $$('[data-media-url]').forEach(b=>b.onclick=()=>{state.mediaModal={url:b.dataset.mediaUrl,name:b.dataset.mediaName,mime:b.dataset.mediaMime};renderApp();});
  $('#closeMediaModal')?.addEventListener('click',()=>{state.mediaModal=null;renderApp();});
  $('#closeProfileModal')?.addEventListener('click',()=>{state.profileModal=null;renderApp();});
  $('#profileForm')?.addEventListener('submit',saveProfile);
  $('#companyForm')?.addEventListener('submit',saveCompany);
  $('#deleteAccountBtn')?.addEventListener('click',deleteAccount);
  $('#cookieResetBtn')?.addEventListener('click',()=>{localStorage.removeItem('mei_cookie_ok');renderApp();});
  $('#staffForm')?.addEventListener('submit',createStaff);
  $$('[data-edit-user]').forEach(b=>b.onclick=()=>{state.editingUser=state.users.find(u=>u.id===b.dataset.editUser);renderApp();});
  $$('[data-delete-user]').forEach(b=>b.onclick=()=>deleteAdminUser(b.dataset.deleteUser));
  $('#closeUserEdit')?.addEventListener('click',()=>{state.editingUser=null;renderApp();});
  $('#adminUserForm')?.addEventListener('submit',saveAdminUser);
  $('#closeTeamChat')?.addEventListener('click',()=>{state.teamOpen=false;clearTeamPolling();renderApp();});
  $('#teamConversationForm')?.addEventListener('submit',createTeamConversation);
  $$('[data-open-team]').forEach(b=>b.onclick=()=>openTeamConversation(b.dataset.openTeam));
  $('#teamMessageForm')?.addEventListener('submit',sendTeamMessage);
  $('#deleteTeamConversation')?.addEventListener('click',deleteTeamConversation);
  $('#addTeamMember')?.addEventListener('change',e=>{if(e.target.value) addTeamMember(e.target.value);});
  $('#removeTeamMember')?.addEventListener('change',e=>{if(e.target.value) removeTeamMember(e.target.value);});
}
async function loadTabData(force=false){
  if(!state.token) return;
  try{
    const me=await api('/api/me'); Object.assign(state,{user:me.user,company:me.company,subscription:me.subscription,notifications:me.notifications||[],legal:me.legal});
    normalizeTab();
    if(state.tab==='dashboard' && planOk()){ const d=await api('/api/dashboard'); state.dashboard=d; }
    if(state.tab==='launches' && planOk()) state.launches=(await api('/api/launches')).launches;
    if(state.tab==='obligations' && planOk()) state.obligations=(await api('/api/obligations')).obligations;
    if(['support','report','moderation'].includes(state.tab)) state.tickets=(await api('/api/tickets')).tickets;
    if(isStaff() && ['support','moderation'].includes(state.tab) && state.supportSubtab==='experience'){ const f=await api('/api/admin/feedbacks'); state.feedbacks=f.feedbacks; state.ranking=f.ranking; }
    if(state.tab==='admin' && state.user.role==='owner'){ state.metrics=(await api('/api/admin/metrics')).metrics; state.users=(await api('/api/admin/users')).users; }
    if(state.teamOpen) await loadTeamData(false);
    if(force) toast('Dados atualizados.'); renderApp(); processIncomingNotifications(state.notifications);
  }catch(err){toast(err.message,'error'); renderApp();}
}
async function startTrial(){ try{ const data=await api('/api/billing/start-trial',{method:'POST',body:'{}'}); state.subscription=data.subscription; toast(data.message||'Checkout criado.'); if(data.checkoutUrl) window.open(data.checkoutUrl,'_blank'); renderApp(); }catch(err){toast(err.message,'error')} }
async function cancelPlan(){ if(!confirm('Cancelar assinatura? Seus dados continuarão disponíveis conforme as regras da plataforma.'))return; try{const data=await api('/api/billing/cancel',{method:'POST',body:'{}'}); state.subscription=data.subscription; toast('Assinatura cancelada.'); renderApp();}catch(err){toast(err.message,'error')} }
async function createLaunch(e){ e.preventDefault(); const fd=new FormData(e.target); const body=Object.fromEntries(fd); body.invoiceIssued=fd.get('invoiceIssued')==='on'; try{await api('/api/launches',{method:'POST',body:JSON.stringify(body)}); toast('Lançamento salvo.'); e.target.reset(); await loadTabData();}catch(err){toast(err.message,'error')} }
async function deleteLaunch(id){ if(!confirm('Excluir este lançamento?'))return; try{await api(`/api/launches/${id}`,{method:'DELETE'}); toast('Lançamento excluído.'); await loadTabData();}catch(err){toast(err.message,'error')} }
async function markObligationPaid(id){ try{await api(`/api/obligations/${id}`,{method:'PATCH',body:JSON.stringify({status:'paid'})}); toast('Obrigação marcada como paga.'); await loadTabData();}catch(err){toast(err.message,'error')} }
async function generateReport(e){ e.preventDefault(); const fd=new FormData(e.target); try{const data=await api(`/api/reports/monthly?year=${fd.get('year')}&month=${fd.get('month')}`); const r=data.report; $('#reportResult').innerHTML=`<h2>${escapeHtml(r.monthName)} de ${r.year}</h2><div class="grid"><div class="kpi-line"><span>Receita</span><strong>${money(r.revenue)}</strong></div><div class="kpi-line"><span>Despesa</span><strong>${money(r.expenses)}</strong></div><div class="kpi-line"><span>Saldo</span><strong>${money(r.balance)}</strong></div></div><h3>Lançamentos</h3>${launchesTable(r.launches,true)}<button class="btn" onclick="window.print()">Imprimir / salvar PDF</button>`;}catch(err){toast(err.message,'error')} }
async function createTicket(e){ e.preventDefault(); const fd=new FormData(e.target); const body=Object.fromEntries(fd); body.type=e.target.dataset.type; const attachment=await fileToDataUrl(e.target.attachment); if(attachment){body.attachmentDataUrl=attachment.dataUrl;body.attachmentName=attachment.name;} try{const data=await api('/api/tickets',{method:'POST',body:JSON.stringify(body)}); toast(`Protocolo ${data.ticket.protocol} aberto.`); e.target.reset(); await loadTabData();}catch(err){toast(err.message,'error')} }
function clearTicketPolling(){ if(ticketPollTimer){clearInterval(ticketPollTimer);ticketPollTimer=null;} }
function scrollChatBottom(){ setTimeout(()=>{ const el=$('.chat'); if(el) el.scrollTop=el.scrollHeight; },40); }
async function openTicket(id, silent=false){ try{const data=await api(`/api/tickets/${id}/messages`); state.currentTicket=data.ticket; state.messages=data.messages; state.queueInfo=data.queueInfo; state.ticketFeedback=data.feedback; if(!silent){clearTicketPolling(); ticketPollTimer=setInterval(()=>refreshCurrentTicket(),2500);} renderApp(); scrollChatBottom();}catch(err){toast(err.message,'error')} }
async function refreshCurrentTicket(){ if(!state.currentTicket) return; const draft=$('#messageText')?.value||''; try{const data=await api(`/api/tickets/${state.currentTicket.id}/messages`); const oldLast=state.messages?.at(-1)?.id||''; const newLast=data.messages?.at(-1)?.id||''; const oldStatus=state.currentTicket?.status; const oldFeedback=state.ticketFeedback?.id||''; const changed=(data.messages?.length!==state.messages?.length)||(oldLast!==newLast)||(data.ticket?.status!==oldStatus)||(data.ticket?.priority!==state.currentTicket?.priority)||((data.feedback?.id||'')!==oldFeedback)||(data.queueInfo?.message!==state.queueInfo?.message); if(!changed) return; state.currentTicket=data.ticket; state.messages=data.messages; state.queueInfo=data.queueInfo; state.ticketFeedback=data.feedback; if($('.chat-modal')) syncTicketModal(draft, oldStatus!==data.ticket?.status || oldFeedback!==(data.feedback?.id||'')); else renderApp();}catch{} }
async function startTicket(id){ try{await api(`/api/tickets/${id}/start`,{method:'POST',body:'{}'}); toast('Atendimento iniciado.'); await loadTabData();}catch(err){toast(err.message,'error')} }
async function closeTicket(id){ if(!confirm('Finalizar esta conversa? Depois disso não será possível enviar novas mensagens neste protocolo.'))return; try{await api(`/api/tickets/${id}/close`,{method:'POST',body:'{}'}); toast('Conversa finalizada.'); if(state.currentTicket?.id===id) await refreshCurrentTicket(); else await loadTabData();}catch(err){toast(err.message,'error')} }
async function sendMessage(e){ e.preventDefault(); const fd=new FormData(e.target); const body={text:fd.get('text')}; const attachment=await fileToDataUrl(e.target.elements.attachment); if(attachment){body.attachmentDataUrl=attachment.dataUrl;body.attachmentName=attachment.name;} try{await api(`/api/tickets/${state.currentTicket.id}/messages`,{method:'POST',body:JSON.stringify(body)}); e.target.reset(); await refreshCurrentTicket();}catch(err){toast(err.message,'error')} }
async function sendFeedback(e){ e.preventDefault(); const fd=new FormData(e.target); try{await api(`/api/tickets/${state.currentTicket.id}/feedback`,{method:'POST',body:JSON.stringify({rating:Number(fd.get('rating')),comment:fd.get('comment')||''})}); toast('Avaliação enviada. Obrigado!'); await refreshCurrentTicket();}catch(err){toast(err.message,'error')} }
async function saveProfile(e){ e.preventDefault(); const fd=new FormData(e.target); const body={name:fd.get('name'),phone:fd.get('phone')}; const avatarFile=await fileToDataUrl(e.target.elements.avatar); if(avatarFile){body.avatarDataUrl=avatarFile.dataUrl;body.avatarName=avatarFile.name;} try{const data=await api('/api/account/profile',{method:'PUT',body:JSON.stringify(body)}); state.user=data.user; toast('Perfil atualizado.'); renderApp();}catch(err){toast(err.message,'error')} }
async function saveCompany(e){ e.preventDefault(); const body=Object.fromEntries(new FormData(e.target)); try{const data=await api('/api/company',{method:'PUT',body:JSON.stringify(body)}); state.company=data.company; toast('Dados salvos.'); renderApp();}catch(err){toast(err.message,'error')} }
async function deleteAccount(){ if(!confirm('Solicitar exclusão da conta? Esta ação desativa o acesso.'))return; try{await api('/api/account/delete-request',{method:'POST',body:'{}'}); toast('Solicitação registrada.'); logout(true);}catch(err){toast(err.message,'error')} }
async function createStaff(e){ e.preventDefault(); const body=Object.fromEntries(new FormData(e.target)); try{const data=await api('/api/admin/users',{method:'POST',body:JSON.stringify(body)}); toast(`Usuário criado. Senha temporária: ${data.temporaryPassword}`); await loadTabData();}catch(err){toast(err.message,'error')} }
async function saveAdminUser(e){ e.preventDefault(); const fd=new FormData(e.target); const id=fd.get('id'); const body=Object.fromEntries(fd); body.forcePasswordChange=fd.get('forcePasswordChange')==='on'; if(!body.password) delete body.password; const avatarFile=await fileToDataUrl(e.target.elements.avatar); if(avatarFile){body.avatarDataUrl=avatarFile.dataUrl;body.avatarName=avatarFile.name;} try{await api(`/api/admin/users/${id}`,{method:'PATCH',body:JSON.stringify(body)}); state.editingUser=null; toast('Usuário atualizado.'); await loadTabData(true);}catch(err){toast(err.message,'error')} }
async function deleteAdminUser(id){ if(!confirm('Excluir esta conta? O acesso será desativado.'))return; try{await api(`/api/admin/users/${id}`,{method:'DELETE'}); toast('Conta excluída.'); await loadTabData(true);}catch(err){toast(err.message,'error')} }
async function markNotificationsRead(){ try{await api('/api/notifications/read',{method:'POST',body:JSON.stringify({ids:[]})}); state.notifications=state.notifications.map(n=>({...n,read:true})); state.notificationOpen=false; renderApp();}catch(err){toast(err.message,'error')} }
async function refreshNotifications(){ if(!state.token) return; try{const data=await api('/api/me'); state.user=data.user; state.company=data.company; state.subscription=data.subscription; state.notifications=data.notifications||[]; if(state.notificationOpen) renderApp(); else updateNotificationBadge(); processIncomingNotifications(state.notifications);}catch{} }
function clearTeamPolling(){ if(teamPollTimer){clearInterval(teamPollTimer);teamPollTimer=null;} }
async function openTeamChat(){ state.teamOpen=true; await loadTeamData(); clearTeamPolling(); teamPollTimer=setInterval(()=>loadTeamData(true),3000); renderApp(); scrollChatBottom(); }
async function loadTeamData(silent=false){ if(!isStaff()) return; const oldCount=state.teamMessages.length; const oldLast=state.teamMessages.at(-1)?.id; const [users,convs]=await Promise.all([api('/api/team/users'),api('/api/team/conversations')]); state.teamUsers=users.users; state.teamConversations=convs.conversations; if(state.currentTeamConversation){ const exists=state.teamConversations.find(c=>c.id===state.currentTeamConversation.id); if(exists){ const data=await api(`/api/team/conversations/${exists.id}/messages`); state.currentTeamConversation=data.conversation; state.teamMessages=data.messages; } else { state.currentTeamConversation=null; state.teamMessages=[]; } } const changed=oldCount!==state.teamMessages.length||oldLast!==state.teamMessages.at(-1)?.id; if(!silent||changed){ renderApp(); if(changed) scrollChatBottom(); } }
async function createTeamConversation(e){ e.preventDefault(); const fd=new FormData(e.target); const memberIds=fd.getAll('memberIds'); try{const data=await api('/api/team/conversations',{method:'POST',body:JSON.stringify({title:fd.get('title'),memberIds,type:memberIds.length>1?'group':'direct'})}); state.currentTeamConversation=data.conversation; await loadTeamData(); toast('Conversa criada.');}catch(err){toast(err.message,'error')} }
async function openTeamConversation(id){ try{const data=await api(`/api/team/conversations/${id}/messages`); state.currentTeamConversation=data.conversation; state.teamMessages=data.messages; renderApp(); scrollChatBottom();}catch(err){toast(err.message,'error')} }
async function sendTeamMessage(e){ e.preventDefault(); const fd=new FormData(e.target); const body={text:fd.get('text')}; const attachment=await fileToDataUrl(e.target.attachment); if(attachment){body.attachmentDataUrl=attachment.dataUrl;body.attachmentName=attachment.name;} try{await api(`/api/team/conversations/${state.currentTeamConversation.id}/messages`,{method:'POST',body:JSON.stringify(body)}); e.target.reset(); await openTeamConversation(state.currentTeamConversation.id);}catch(err){toast(err.message,'error')} }
async function deleteTeamConversation(){ if(!state.currentTeamConversation||!confirm('Excluir esta conversa da sua lista?'))return; try{await api(`/api/team/conversations/${state.currentTeamConversation.id}`,{method:'DELETE'}); state.currentTeamConversation=null; state.teamMessages=[]; await loadTeamData();}catch(err){toast(err.message,'error')} }
async function addTeamMember(memberId){ if(!state.currentTeamConversation)return; try{await api(`/api/team/conversations/${state.currentTeamConversation.id}/members`,{method:'POST',body:JSON.stringify({memberIds:[memberId]})}); await openTeamConversation(state.currentTeamConversation.id);}catch(err){toast(err.message,'error')} }
async function removeTeamMember(memberId){ if(!state.currentTeamConversation||!confirm('Remover este membro do grupo?'))return; try{await api(`/api/team/conversations/${state.currentTeamConversation.id}/members/${memberId}`,{method:'DELETE'}); await openTeamConversation(state.currentTeamConversation.id);}catch(err){toast(err.message,'error')} }

window.setTab=setTab;
bootstrap().then(()=>{ if(state.token) loadTabData(); });
