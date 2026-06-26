const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];

let temporizadorChamado = null;
let temporizadorNotificacoes = null;
let temporizadorEquipe = null;

async function iniciar() {
  if (!estado.token) return renderizarInicio();
  try {
    const dados = await api('/api/me');
    Object.assign(estado, { usuario:dados.user, empresa:dados.company, assinatura:dados.subscription, notificacoes:dados.notifications||[], legal:dados.legal });
    renderizarApp();
    processarNotificacoesRecebidas(estado.notificacoes);
    iniciarVerificacaoNotificacoes();
  } catch(e) { localStorage.removeItem('mei_token'); estado.token=''; renderizarInicio(); }
}

function iniciarVerificacaoNotificacoes(){ if(temporizadorNotificacoes) return; temporizadorNotificacoes=setInterval(atualizarNotificacoes,10000); }

function saida(pularConfirmacao=false){
  if(!pularConfirmacao){ mostrarConfirmacao('Sair da conta','Deseja sair da conta?',()=>executarSaida()); return; }
  executarSaida();
}
function executarSaida(){
  removerBolhaNotificacao(); localStorage.removeItem('mei_token');
  pararChamado(); pararEquipe();
  if(temporizadorNotificacoes){clearInterval(temporizadorNotificacoes);temporizadorNotificacoes=null;}
  Object.assign(estado,{token:'',usuario:null,empresa:null,assinatura:null,aba:'dashboard'});
  renderizarInicio();
}

function mudarAba(aba){ estado.aba=aba; localStorage.setItem('mei_aba',aba); renderizarApp(); carregarDadosAba(); }

function normalizarAba(){ const itens=itensNavegacao(); if(itens.some(([id])=>id===estado.aba)) return; estado.aba=itens[0]?.[0]||'dashboard'; localStorage.setItem('mei_aba', estado.aba); }

function renderizarInicio(){
  document.querySelector('#app').innerHTML = paginaInicial() + (estado.modal?modalAutenticacao():'');
  vincularInicio();
}

function paginaInicial(){
return `<div class="inicio">
  <header class="barra-superior"><div class="barra-superior-interna">${logotipo()}<div class="acoes-superiores"><button class="btn fantasma" data-abrir="login">Entrar</button><button class="btn primary" data-abrir="registro">Começar teste grátis</button></div></div></header>
  <main>
    <section class="heroi"><div><span class="sobrancelha">${icone('escudo')} Plataforma brasileira para MEI</span><h1>Controle seu MEI sem planilha confusa.</h1><p>Registre faturamento, acompanhe o limite anual, organize o DAS, prepare sua DASN-SIMEI e fale com suporte por protocolo sempre que precisar.</p><div class="heroi-acoes"><button class="btn primary" data-abrir="registro">Começar teste grátis por 7 dias</button><button class="btn" data-abrir="login">Já tenho conta</button></div><div class="linha-confianca"><div class="confianca"><strong>R$ 81 mil</strong><span>limite anual de referência</span></div><div class="confianca"><strong>DAS</strong><span>alertas de vencimento mensal</span></div><div class="confianca"><strong>LGPD</strong><span>privacidade, aceite e exclusão</span></div></div></div><div class="cartao-produto"><div class="mini-navegador"><div class="navegador-topo"><span class="ponto"></span><span class="ponto"></span><span class="ponto"></span></div><div class="navegador-corpo"><div class="cartao-limite"><small>FATURAMENTO ACUMULADO</small><h3>R$ 46.280,00</h3><div class="barra-progresso"><span></span></div><p>57% do limite anual utilizado</p></div><div class="grade-painel"><div class="mini-estatistica"><i>${icone('carteira')}</i><b>R$ 8.750</b><span>Receita do mês</span></div><div class="mini-estatistica"><i>${icone('calendario')}</i><b>3 dias</b><span>Próximo DAS</span></div><div class="mini-estatistica"><i>${icone('chat')}</i><b>SUP-00018</b><span>Protocolo aberto</span></div><div class="mini-estatistica"><i>${icone('escudo')}</i><b>Seguro</b><span>Dados com controle</span></div></div></div></div></div></section>
    <section class="secao"><div class="secao-titulo"><div><h2>Um sistema simples para rotina real de MEI</h2><p class="texto-guia">Feito para quem vende, presta serviço, emite DAS e precisa enxergar o negócio sem depender de planilha quebrada.</p></div></div><div class="cartoes">${recurso('grafico','Limite do MEI','Veja faturamento acumulado, percentual usado e quanto ainda falta para o limite anual.')}${recurso('recibo','DAS e DASN-SIMEI','Calendário fiscal com vencimentos, comprovantes e status de pagamento.')}${recurso('chat','Suporte com protocolo','Abra chamados, envie imagens e acompanhe atendimento até finalizar.')}${recurso('bandeira','Moderação e denúncias','Canal separado para reportar uso indevido, má fé ou problemas de segurança.')}${recurso('cartao','Assinatura mensal','Teste grátis com checkout de cartão via gateway e avisos de cobrança.')}${recurso('escudo','LGPD desde o início','Termos, privacidade, cookies, exportação e solicitação de exclusão de conta.')}</div></section>
    <section class="secao"><div class="precos"><div><h2>Plano Pro MEI</h2><p>Comece com 7 dias de teste. Após o período gratuito, a assinatura mensal mantém seu painel, relatórios, suporte e histórico seguro.</p><div class="mini-acoes"><span class="marcador ok">Sem planilha</span><span class="marcador ok">Suporte por protocolo</span><span class="marcador ok">Dados salvos</span></div></div><div class="caixa-preco"><div class="preco">R$ 24,90 <small>/mês</small></div><p>Cancelamento pela plataforma, respeitando cobranças pendentes e regras de retenção legal.</p><button class="btn primary bloco" data-abrir="registro">Criar minha conta</button></div></div></section>
  </main>
</div>${barraCookie()}`;
}

function recurso(ic,titulo,txt){return `<article class="recurso"><div class="recurso-icone">${icone(ic)}</div><h3>${titulo}</h3><p>${txt}</p></article>`}

function vincularInicio(){
  $$('[data-abrir]').forEach(b=>b.onclick=()=>{estado.modal=b.dataset.abrir; estado.modoAutenticacao=b.dataset.abrir; renderizarInicio();});
  document.querySelector('.fechar')?.addEventListener('click',()=>{estado.modal=null;renderizarInicio();});
  document.querySelector('#formularioLogin')?.addEventListener('submit',enviarLogin);
  document.querySelector('#formularioRegistro')?.addEventListener('submit',enviarRegistro);
  vincularCookie();
}

function modalAutenticacao(){
  if(!estado.modal) return '';
  return `<div class="modal-superposicao"><div class="modal"><div class="modal-cabecalho"><div><h2>${estado.modoAutenticacao==='login'?'Entrar na conta':'Criar conta MEI'}</h2><p class="texto-guia">${estado.modoAutenticacao==='login'?'Acesse seu painel e protocolos.':'Comece seu teste grátis com dados reais do seu negócio.'}</p></div><button class="fechar">×</button></div>${estado.modoAutenticacao==='login'?formularioLogin():formularioRegistro()}</div></div>`;
}
function formularioLogin(){return `<form id="formularioLogin" class="formulario"><div class="campo"><label>E-mail</label><input name="email" type="email" required></div><div class="campo"><label>Senha</label><input name="password" type="password" required></div><button class="btn primary bloco">Entrar</button><p class="check">Acessos iniciais: owner@meinocontrole.local, suporte@meinocontrole.local, moderacao@meinocontrole.local</p></form>`}
function formularioRegistro(){return `<form id="formularioRegistro" class="formulario"><div class="linha"><div class="campo"><label>Nome do responsável</label><input name="name" required></div><div class="campo"><label>E-mail</label><input name="email" type="email" required></div></div><div class="linha"><div class="campo"><label>Senha</label><input name="password" type="password" minlength="8" required></div><div class="campo"><label>Telefone</label><input name="phone"></div></div><div class="linha"><div class="campo"><label>Nome do negócio</label><input name="businessName" required></div><div class="campo"><label>CNPJ MEI</label><input name="cnpj" inputmode="numeric"></div></div><div class="campo"><label>Tipo de atividade</label><select name="activityType"><option>Serviços</option><option>Comércio</option><option>Comércio + Serviços</option><option>Caminhoneiro</option></select></div><label class="check"><input type="checkbox" name="acceptTerms" required> Aceito os Termos de Uso e a Política de Privacidade.</label><button class="btn primary bloco">Criar conta e ir para assinatura</button></form>`}

async function enviarLogin(e){e.preventDefault(); const fd=new FormData(e.target); try{const dados=await api('/api/auth/login',{method:'POST',body:JSON.stringify(Object.fromEntries(fd))}); estado.token=dados.token; localStorage.setItem('mei_token',dados.token); Object.assign(estado,{usuario:dados.user,empresa:dados.company,assinatura:dados.subscription,modal:null}); toast('Login realizado.'); iniciarVerificacaoNotificacoes(); renderizarApp(); carregarDadosAba();}catch(err){toast(err.message,'error')}}
async function enviarRegistro(e){e.preventDefault(); const fd=new FormData(e.target); const corpo=Object.fromEntries(fd); corpo.acceptTerms=fd.get('acceptTerms')==='on'; try{const dados=await api('/api/auth/register',{method:'POST',body:JSON.stringify(corpo)}); estado.token=dados.token; localStorage.setItem('mei_token',dados.token); Object.assign(estado,{usuario:dados.user,empresa:dados.company,assinatura:dados.subscription,modal:null,aba:'assinatura'}); toast('Conta criada.'); iniciarVerificacaoNotificacoes(); renderizarApp(); carregarDadosAba();}catch(err){toast(err.message,'error')}}

function renderizarApp(){
  if(!estado.usuario) return renderizarInicio();
  normalizarAba();
  const recolhida = estado.barraRecolhida;
  document.querySelector('#app').innerHTML = `<div class="concha ${recolhida?'barra-recolhida':''}"><aside class="barra-lateral${recolhida?' recolhida':''}" id="barraLateral">${logotipo()}${resumoPerfil()}<nav class="navegacao">${itensNavegacao().map(([id,ic,rotulo])=>`<button class="${estado.aba===id?'ativo':''}" data-aba="${id}">${icone(ic)} <span class="rotulo-icone-navegacao">${rotulo}</span></button>`).join('')}</nav><div class="barra-lateral-rodape">${ehEquipe()?`<button class="btn bloco" id="btnChatEquipe">${icone('chat')} <span class="rotulo-icone-navegacao">Chat equipe</span></button>`:''}<button class="btn bloco" id="btnAtualizar">${icone('grafico')} <span class="rotulo-icone-navegacao">Atualizar</span></button><button class="btn perigo bloco" id="btnSair">${icone('saida')} <span class="rotulo-icone-navegacao">Sair</span></button></div></aside><main class="principal"><header class="principal-topo"><div style="display:flex;align-items:center;gap:10px"><button class="btn" id="btnMenu" style="display:none">${icone('menu')}</button><button class="btn" id="btnAlternarBarra">${icone('seta')}</button><div><h1>${tituloAba()}</h1><p>${subtituloAba()}</p></div></div><div class="mini-acoes">${estado.assinatura?marcadorStatus(estado.assinatura.status):''}<button class="btn" id="btnNotificacoes">${icone('sino')} ${naoPagos()?`<span class="ponto-contador">${naoPagos()}</span>`:''}</button>${ehEquipe()?`<button class="btn" id="btnChatEquipeTopo">${icone('chat')} Equipe</button>`:''}<button class="btn primary" id="btnAcaoRapida">${rotuloRapido()}</button></div>${painelNotificacoes()}</header><section class="conteudo" id="conteudo">${renderizarAba()}</section></main></div>${modalChamado()}${modalMidia()}${modalPerfilDetalhe()}${modalEditarUsuario()}${modalNotificar()}${modalChatEquipe()}${ehEquipe()?`<button class="flutuante-chat" id="btnFlutuante" title="Conversas">${icone('chat')}</button>${modalFlutuante()}`:''}${barraCookie()}`;
  vincularConcha(); vincularAba(); vincularCookie();
}

function alternarBarra(){
  estado.barraRecolhida = !estado.barraRecolhida;
  localStorage.setItem('mei_barra', estado.barraRecolhida?'recolhida':'expandida');
  renderizarApp();
}

function vincularConcha(){
  $$('.navegacao button').forEach(b=>b.onclick=()=>{mudarAba(b.dataset.aba); document.querySelector('#barraLateral')?.classList.remove('aberta')});
  document.querySelector('#btnSair')?.addEventListener('click',()=>saida());
  document.querySelector('#btnAtualizar')?.addEventListener('click',()=>carregarDadosAba(true));
  document.querySelector('#btnMenu')?.addEventListener('click',()=>document.querySelector('#barraLateral')?.classList.toggle('aberta'));
  document.querySelector('#btnAlternarBarra')?.addEventListener('click',alternarBarra);
  document.querySelector('#btnPerfil')?.addEventListener('click',()=>{
    if(ehEquipe()){ abrirDetalheUsuario(estado.usuario.id) }
    else { estado.usuarioDetalhe=estado.usuario; estado.detalheAssinatura=estado.assinatura; estado.detalheEmpresa=estado.empresa; estado.sinalizacoesUsuario=[]; renderizarApp(); }
  });
  document.querySelector('#btnNotificacoes')?.addEventListener('click',()=>{estado.notificacaoAberta=!estado.notificacaoAberta;renderizarApp();});
  document.querySelector('#btnMarcarNotificacoes')?.addEventListener('click',marcarNotificacoesLidas);
  $$('[data-notificacao-id]').forEach(b=>b.onclick=()=>abrirNotificacaoPorId(b.dataset.notificacaoId));
  document.querySelector('#btnChatEquipe')?.addEventListener('click',abrirChatEquipe);
  document.querySelector('#btnChatEquipeTopo')?.addEventListener('click',abrirChatEquipe);
  document.querySelector('#btnFlutuante')?.addEventListener('click',()=>{estado.flutuanteAberto=!estado.flutuanteAberto;renderizarApp();});
  document.querySelector('#btnFecharFlutuante')?.addEventListener('click',()=>{estado.flutuanteAberto=false;renderizarApp();});
  document.querySelector('#btnFlutuanteSuporte')?.addEventListener('click',()=>{estado.flutuanteAberto=false;mudarAba('suporte');});
  document.querySelector('#btnFlutuanteModeracao')?.addEventListener('click',()=>{estado.flutuanteAberto=false;mudarAba(ehEquipe()?'moderacao':'denuncia');});
  document.querySelector('#btnFlutuanteComum')?.addEventListener('click',()=>{estado.flutuanteAberto=false;abrirChatEquipe();});
  document.querySelector('#btnFecharPerfilDetalhe')?.addEventListener('click',()=>{estado.usuarioDetalhe=null;renderizarApp();});
  document.querySelector('#btnAcaoRapida')?.addEventListener('click',()=>{ if(estado.aba==='lancamentos') document.querySelector('#tituloLancamento')?.focus(); else if(ehCliente()&&!planoOk()) mudarAba('assinatura'); else if(ehCliente()) mudarAba('lancamentos'); else mudarAba(estado.usuario.cargo==='moderator'?'moderacao':'suporte'); });
}

async function abrirDetalheUsuario(usuarioId){
  try{
    const dados = await api(`/api/admin/users/${usuarioId}`);
    estado.usuarioDetalhe = dados.user;
    estado.detalheAssinatura = dados.subscription;
    estado.detalheEmpresa = dados.company;
    estado.sinalizacoesUsuario = dados.flags||[];
    renderizarApp();
  }catch(err){toast(err.message,'error')}
}

async function abrirNotificacaoPorId(id){ const n=(estado.notificacoes||[]).find(n=>n.id===id); if(n) abrirNotificacao(n); }

async function abrirNotificacao(notificacao){
  if(!notificacao) return;
  removerBolhaNotificacao(); estado.notificacaoAberta=false;
  estado.notificacoes=estado.notificacoes.map(n=>n.id===notificacao.id?{...n,lida:true}:n);
  atualizarEmblemaNotificacoes();
  try{ await api('/api/notifications/read',{method:'POST',body:JSON.stringify({ids:[notificacao.id]})}); }catch{}
  const alvo=notificacao.target||{};
  if(alvo.kind==='ticket' && alvo.ticketId){
    const aba=alvo.ticketType==='report' ? (ehEquipe()?'moderacao':'denuncia') : 'suporte';
    estado.aba=aba; localStorage.setItem('mei_aba',aba);
    renderizarApp(); await carregarDadosAba(); await abrirChamado(alvo.ticketId); return;
  }
  if(alvo.kind==='team-chat' && alvo.conversationId && ehEquipe()){ await abrirChatEquipe(); await abrirConversaEquipe(alvo.conversationId); return; }
  if(alvo.kind==='admin' && alvo.userId && ehEquipe()){ mudarAba('admin'); await carregarDadosAba(); setTimeout(()=>abrirDetalheUsuario(alvo.userId),200); return; }
  if(alvo.kind==='billing'){ mudarAba('assinatura'); return; }
  if(notificacao.tipo==='team-chat' && ehEquipe()){ await abrirChatEquipe(); return; }
  if(notificacao.tipo==='sinalizacao' && ehEquipe()){ mudarAba('admin'); return; }
  if(['ticket','feedback'].includes(notificacao.tipo)){ mudarAba(ehEquipe() ? (estado.usuario.cargo==='moderator'?'moderacao':'suporte') : 'suporte'); return; }
  renderizarApp();
}

function renderizarAba(){
  if(ehCliente() && !planoOk() && !['assinatura','suporte','denuncia','conta'].includes(estado.aba)) return visaoBloqueio();
  return ({dashboard:visaoDashboard, lancamentos:visaoLancamentos, obrigacoes:visaoObrigacoes, relatorios:visaoRelatorios, suporte:visaoSuporte, denuncia:visaoDenuncia, moderacao:visaoModeracao, assinatura:visaoAssinatura, conta:visaoConta, admin:visaoAdmin}[estado.aba] || visaoDashboard)();
}

function vincularAba(){
  document.querySelector('#btnIniciarTeste')?.addEventListener('click',iniciarTeste);
  document.querySelector('#btnCancelarPlano')?.addEventListener('click',cancelarPlano);
  document.querySelector('#formularioLancamento')?.addEventListener('submit',criarLancamento);
  $$('[data-excluir-lancamento]').forEach(b=>b.onclick=()=>excluirLancamento(b.dataset.excluirLancamento));
  $$('[data-ob-paga]').forEach(b=>b.onclick=()=>marcarObrigacaoPaga(b.dataset.obPaga));
  document.querySelector('#formularioRelatorio')?.addEventListener('submit',gerarRelatorio);
  document.querySelector('#formularioChamado')?.addEventListener('submit',criarChamado);
  document.querySelector('#filtroChamado')?.addEventListener('change',e=>{estado.filtroChamados=e.target.value;localStorage.setItem('mei_filtro_chamados',estado.filtroChamados);renderizarApp();});
  if(document.querySelector('#filtroChamado')) document.querySelector('#filtroChamado').value=estado.filtroChamados;
  $$('[data-subaba-suporte]').forEach(b=>b.onclick=()=>{estado.subAbaSuporte=b.dataset.subabaSuporte;localStorage.setItem('mei_suba_suporte',estado.subAbaSuporte);renderizarApp();carregarDadosAba();});
  $$('[data-abrir-chamado]').forEach(b=>b.onclick=()=>abrirChamado(b.dataset.abrirChamado));
  $$('[data-iniciar-chamado]').forEach(b=>b.onclick=()=>iniciarChamado(b.dataset.iniciarChamado));
  $$('[data-fechar-chamado]').forEach(b=>b.onclick=()=>fecharChamado(b.dataset.fecharChamado));
  $$('[data-usuario-detalhe]').forEach(b=>b.onclick=()=>abrirDetalheUsuario(b.dataset.usuarioDetalhe));
  $$('[data-notificar-usuario]').forEach(b=>b.onclick=()=>{estado.notificarUsuarioId=b.dataset.notificarUsuario;estado.notificarModalAberto=true;renderizarApp();});
  document.querySelector('#btnFecharModalChamado')?.addEventListener('click',()=>{pararChamado();estado.chamadoAtual=null;estado.mensagens=[];estado.infoFila=null;renderizarApp();});
  vincularChamadoDinamico();
  $$('[data-midia-url]').forEach(b=>b.onclick=()=>{estado.midiaModal={url:b.dataset.midiaUrl,nome:b.dataset.midiaNome,mime:b.dataset.midiaMime};renderizarApp();});
  document.querySelector('#btnFecharMidia')?.addEventListener('click',()=>{estado.midiaModal=null;renderizarApp();});
  document.querySelector('#formularioPerfil')?.addEventListener('submit',salvarPerfil);
  document.querySelector('#formularioEmpresa')?.addEventListener('submit',salvarEmpresa);
  document.querySelector('#btnExcluirConta')?.addEventListener('click',excluirConta);
  document.querySelector('#btnRedefinirCookie')?.addEventListener('click',()=>{localStorage.removeItem('mei_cookie_ok');renderizarApp();});
  document.querySelector('#formularioEquipe')?.addEventListener('submit',criarEquipe);
  $$('[data-editar-usuario]').forEach(b=>b.onclick=()=>{estado.editandoUsuario=estado.usuarios.find(u=>u.id===b.dataset.editarUsuario);renderizarApp();});
  $$('[data-excluir-usuario]').forEach(b=>b.onclick=()=>excluirAdminUsuario(b.dataset.excluirUsuario));
  document.querySelector('#btnFecharEdicaoUsuario')?.addEventListener('click',()=>{estado.editandoUsuario=null;renderizarApp();});
  document.querySelector('#formularioAdminUsuario')?.addEventListener('submit',salvarAdminUsuario);
  document.querySelector('#btnFecharChatEquipe')?.addEventListener('click',()=>{estado.chatEquipeAberto=false;pararEquipe();renderizarApp();});
  document.querySelector('#formularioConversaEquipe')?.addEventListener('submit',criarConversaEquipe);
  $$('[data-abrir-equipe]').forEach(b=>b.onclick=()=>abrirConversaEquipe(b.dataset.abrirEquipe));
  document.querySelector('#formularioMensagemEquipe')?.addEventListener('submit',enviarMensagemEquipe);
  document.querySelector('#btnExcluirConversaEquipe')?.addEventListener('click',excluirConversaEquipe);
  document.querySelector('#adicionarMembroEquipe')?.addEventListener('change',e=>{if(e.target.value) adicionarMembroEquipe(e.target.value);});
  document.querySelector('#removerMembroEquipe')?.addEventListener('change',e=>{if(e.target.value) removerMembroEquipe(e.target.value);});
  document.querySelector('#btnNotificarFechar')?.addEventListener('click',()=>{estado.notificarModalAberto=false;estado.notificarUsuarioId=null;renderizarApp();});
  document.querySelector('#formularioEnviarNotificacao')?.addEventListener('submit',enviarNotificacaoAdmin);
}

function vincularChamadoDinamico(){
  if(document.querySelector('#formularioMensagem')) document.querySelector('#formularioMensagem').onsubmit=enviarMensagem;
  if(document.querySelector('#btnFecharChamado')) document.querySelector('#btnFecharChamado').onclick=()=>fecharChamado(estado.chamadoAtual.id);
  if(document.querySelector('#transferirAtendimento')) document.querySelector('#transferirAtendimento').onchange=function(){if(this.value) transferirAtendimento(this.value)};
  $$('[data-midia-url]', document.querySelector('.chat-modal') || document).forEach(b=>b.onclick=()=>{estado.midiaModal={url:b.dataset.midiaUrl,nome:b.dataset.midiaNome,mime:b.dataset.midiaMime};renderizarApp();});
  $$('[data-usuario-detalhe]', document.querySelector('.chat-modal') || document).forEach(b=>b.onclick=()=>abrirDetalheUsuario(b.dataset.usuarioDetalhe));
}

function sincronizarModalChamado(rascunho='', atualizarCompor=false){
  if(!document.querySelector('.chat-modal') || !estado.chamadoAtual){ renderizarApp(); return; }
  const chat=document.querySelector('#corpoChatChamado'); if(chat) chat.innerHTML=conversaChamadoHtml();
  const meta=document.querySelector('#metaModalChamado'); if(meta) meta.textContent=textoMetaChamado(estado.chamadoAtual);
  const compor=document.querySelector('#areaComporChamado'); if(compor && atualizarCompor) compor.innerHTML=comporConversa(estado.chamadoAtual);
  vincularChamadoDinamico();
  const entrada=document.querySelector('#textoMensagem'); if(entrada && rascunho) entrada.value=rascunho;
  rolarChatFim();
}

async function carregarDadosAba(forcar=false){
  if(!estado.token) return;
  try{
    const eu=await api('/api/me'); Object.assign(estado,{usuario:eu.user,empresa:eu.company,assinatura:eu.subscription,notificacoes:eu.notifications||[],legal:eu.legal});
    normalizarAba();
    const aba=estado.aba;
    if(aba==='dashboard' && planoOk()){ const d=await api('/api/dashboard'); estado.dashboard=d; }
    if(aba==='lancamentos' && planoOk()) estado.lancamentos=(await api('/api/launches')).launches;
    if(aba==='obrigacoes' && planoOk()) estado.obrigacoes=(await api('/api/obligations')).obligations;
    if(['suporte','denuncia','moderacao'].includes(aba)) estado.chamados=(await api('/api/tickets')).tickets;
    if(ehEquipe() && ['suporte','moderacao'].includes(aba) && estado.subAbaSuporte==='experiencia'){ const f=await api('/api/admin/feedbacks'); estado.avaliacoes=f.feedbacks; estado.ranking=f.ranking; }
    if(aba==='admin' && estado.usuario.cargo==='owner'){ estado.metricas=(await api('/api/admin/metrics')).metrics; estado.usuarios=(await api('/api/admin/users')).users; }
    if(estado.chatEquipeAberto) await carregarDadosEquipe(false);
    if(forcar) toast('Dados atualizados.'); renderizarApp(); processarNotificacoesRecebidas(estado.notificacoes);
  }catch(err){toast(err.message,'error'); renderizarApp();}
}

async function iniciarTeste(){ try{ const dados=await api('/api/billing/start-trial',{method:'POST',body:'{}'}); estado.assinatura=dados.subscription; toast(dados.message||'Checkout criado.'); if(dados.checkoutUrl) window.open(dados.checkoutUrl,'_blank'); renderizarApp(); }catch(err){toast(err.message,'error')} }
async function cancelarPlano(){ mostrarConfirmacao('Cancelar assinatura','Deseja cancelar sua assinatura?',async()=>{try{const dados=await api('/api/billing/cancel',{method:'POST',body:'{}'}); estado.assinatura=dados.subscription; toast('Assinatura cancelada.'); renderizarApp();}catch(err){toast(err.message,'error')}}) }
async function criarLancamento(e){ e.preventDefault(); const fd=new FormData(e.target); const corpo=Object.fromEntries(fd); corpo.invoiceIssued=fd.get('invoiceIssued')==='on'; try{await api('/api/launches',{method:'POST',body:JSON.stringify(corpo)}); toast('Lançamento salvo.'); e.target.reset(); await carregarDadosAba();}catch(err){toast(err.message,'error')} }
async function excluirLancamento(id){ mostrarConfirmacao('Excluir','Excluir este lançamento?',async()=>{try{await api(`/api/launches/${id}`,{method:'DELETE'}); toast('Lançamento excluído.'); await carregarDadosAba();}catch(err){toast(err.message,'error')}}) }
async function marcarObrigacaoPaga(id){ try{await api(`/api/obligations/${id}`,{method:'PATCH',body:JSON.stringify({status:'paid'})}); toast('Obrigação marcada como paga.'); await carregarDadosAba();}catch(err){toast(err.message,'error')} }
async function gerarRelatorio(e){ e.preventDefault(); const fd=new FormData(e.target); try{const dados=await api(`/api/reports/monthly?year=${fd.get('year')}&month=${fd.get('month')}`); const r=dados.report; document.querySelector('#resultadoRelatorio').innerHTML=`<h2>${escaparHtml(r.monthName)} de ${r.year}</h2><div class="grade"><div class="linha-kpi"><span>Receita</span><strong>${dinheiroValor(r.revenue)}</strong></div><div class="linha-kpi"><span>Despesa</span><strong>${dinheiroValor(r.expenses)}</strong></div><div class="linha-kpi"><span>Saldo</span><strong>${dinheiroValor(r.balance)}</strong></div></div><h3>Lançamentos</h3>${tabelaLancamentos(r.launches,true)}<button class="btn" onclick="window.print()">Imprimir / salvar PDF</button>`;}catch(err){toast(err.message,'error')} }
async function criarChamado(e){ e.preventDefault(); const fd=new FormData(e.target); const corpo=Object.fromEntries(fd); corpo.type=e.target.dataset.tipo; const anexo=await arquivoParaDataUrl(e.target.attachment); if(anexo){corpo.attachmentDataUrl=anexo.dataUrl;corpo.attachmentName=anexo.nome;} try{const dados=await api('/api/tickets',{method:'POST',body:JSON.stringify(corpo)}); toast(`Protocolo ${dados.ticket.protocol} aberto.`); e.target.reset(); await carregarDadosAba();}catch(err){toast(err.message,'error')} }

function pararChamado(){ if(temporizadorChamado){clearInterval(temporizadorChamado);temporizadorChamado=null;} }
function rolarChatFim(){ setTimeout(()=>{ const el=document.querySelector('.chat'); if(el) el.scrollTop=el.scrollHeight; },40); }

async function abrirChamado(id, silencioso=false){
  try{const dados=await api(`/api/tickets/${id}/messages`); estado.chamadoAtual=dados.ticket; estado.mensagens=dados.messages; estado.infoFila=dados.queueInfo; if(!silencioso){pararChamado(); temporizadorChamado=setInterval(()=>atualizarChamadoAtual(),2500);} if(ehEquipe()){try{const u=await api('/api/team/users'); estado.usuariosEquipe=u.users;}catch{}} renderizarApp(); rolarChatFim();}catch(err){toast(err.message,'error')}
}
async function atualizarChamadoAtual(){
  if(!estado.chamadoAtual) return; const rascunho=document.querySelector('#textoMensagem')?.value||'';
  try{const dados=await api(`/api/tickets/${estado.chamadoAtual.id}/messages`);
    const antigaUltima=estado.mensagens?.at(-1)?.id||''; const novaUltima=dados.messages?.at(-1)?.id||'';
    const estadoAntigo=estado.chamadoAtual?.status;
    const mudou=(dados.messages?.length!==estado.mensagens?.length)||(antigaUltima!==novaUltima)||(dados.ticket?.status!==estadoAntigo)||(dados.ticket?.priority!==estado.chamadoAtual?.priority)||(dados.queueInfo?.message!==estado.infoFila?.mensagem);
    if(!mudou) return;
    estado.chamadoAtual=dados.ticket; estado.mensagens=dados.messages; estado.infoFila=dados.queueInfo;
    sincronizarModalChamado(rascunho, estadoAntigo!==dados.ticket?.status);
  }catch{}
}
async function iniciarChamado(id){ try{await api(`/api/tickets/${id}/start`,{method:'POST',body:'{}'}); toast('Atendimento iniciado.'); await carregarDadosAba();}catch(err){toast(err.message,'error')} }
async function fecharChamado(id){
  mostrarConfirmacao('Finalizar conversa','Depois disso não será possível enviar novas mensagens neste protocolo.',async()=>{
    try{await api(`/api/tickets/${id}/close`,{method:'POST',body:'{}'}); toast('Conversa finalizada.');
    if(estado.chamadoAtual?.id===id) await atualizarChamadoAtual(); else await carregarDadosAba();}catch(err){toast(err.message,'error')}
  })
}
async function transferirAtendimento(novoAtendenteId){
  if(!estado.chamadoAtual) return
  mostrarConfirmacao('Transferir atendimento','Deseja transferir este atendimento para outro membro da equipe?',async()=>{
    try{await api(`/api/tickets/${estado.chamadoAtual.id}/transfer`,{method:'POST',body:JSON.stringify({assigneeId:novoAtendenteId})}); toast('Atendimento transferido.'); await atualizarChamadoAtual();}catch(err){toast(err.message,'error')}
  })
}
async function enviarMensagem(e){
  e.preventDefault(); const fd=new FormData(e.target); const corpo={text:fd.get('text')};
  const anexo=await arquivoParaDataUrl(e.target.elements.attachment);
  if(anexo){corpo.attachmentDataUrl=anexo.dataUrl;corpo.attachmentName=anexo.nome;}
  try{await api(`/api/tickets/${estado.chamadoAtual.id}/messages`,{method:'POST',body:JSON.stringify(corpo)}); e.target.reset(); await atualizarChamadoAtual();}catch(err){toast(err.message,'error')}
}
async function salvarPerfil(e){ e.preventDefault(); const fd=new FormData(e.target); const corpo={name:fd.get('name'),phone:fd.get('phone')}; const avatarArquivo=await arquivoParaDataUrl(e.target.elements.avatar); if(avatarArquivo){corpo.avatarDataUrl=avatarArquivo.dataUrl;corpo.avatarName=avatarArquivo.nome;} try{const dados=await api('/api/account/profile',{method:'PUT',body:JSON.stringify(corpo)}); estado.usuario=dados.user; toast('Perfil atualizado.'); renderizarApp();}catch(err){toast(err.message,'error')} }
async function salvarEmpresa(e){ e.preventDefault(); const corpo=Object.fromEntries(new FormData(e.target)); try{const dados=await api('/api/company',{method:'PUT',body:JSON.stringify(corpo)}); estado.empresa=dados.company; toast('Dados salvos.'); renderizarApp();}catch(err){toast(err.message,'error')} }
async function excluirConta(){ mostrarConfirmacao('Solicitar exclusão','Deseja solicitar a exclusão da sua conta?',async()=>{try{await api('/api/account/delete-request',{method:'POST',body:'{}'}); toast('Solicitação registrada.'); executarSaida();}catch(err){toast(err.message,'error')}}) }
async function criarEquipe(e){ e.preventDefault(); const corpo=Object.fromEntries(new FormData(e.target)); try{const dados=await api('/api/admin/users',{method:'POST',body:JSON.stringify(corpo)}); toast(`Usuário criado. Senha temporária: ${dados.temporaryPassword}`); await carregarDadosAba();}catch(err){toast(err.message,'error')} }
async function salvarAdminUsuario(e){ e.preventDefault(); const fd=new FormData(e.target); const id=fd.get('id'); const corpo=Object.fromEntries(fd); corpo.forcePasswordChange=fd.get('forcePasswordChange')==='on'; if(!corpo.password) delete corpo.password; const avatarArquivo=await arquivoParaDataUrl(e.target.elements.avatar); if(avatarArquivo){corpo.avatarDataUrl=avatarArquivo.dataUrl;corpo.avatarName=avatarArquivo.nome;} try{await api(`/api/admin/users/${id}`,{method:'PATCH',body:JSON.stringify(corpo)}); estado.editandoUsuario=null; toast('Usuário atualizado.'); await carregarDadosAba(true);}catch(err){toast(err.message,'error')} }
async function excluirAdminUsuario(id){ mostrarConfirmacao('Excluir conta','Excluir esta conta?',async()=>{try{await api(`/api/admin/users/${id}`,{method:'DELETE'}); toast('Conta excluída.'); await carregarDadosAba(true);}catch(err){toast(err.message,'error')}}) }
async function marcarNotificacoesLidas(){ try{await api('/api/notifications/read',{method:'POST',body:JSON.stringify({ids:[]})}); estado.notificacoes=estado.notificacoes.map(n=>({...n,lida:true})); estado.notificacaoAberta=false; renderizarApp();}catch(err){toast(err.message,'error')} }
async function atualizarNotificacoes(){ if(!estado.token) return; try{const dados=await api('/api/me'); estado.usuario=dados.user; estado.empresa=dados.company; estado.assinatura=dados.subscription; estado.notificacoes=dados.notifications||[]; if(estado.notificacaoAberta) renderizarApp(); else atualizarEmblemaNotificacoes(); processarNotificacoesRecebidas(estado.notificacoes);}catch{} }

function pararEquipe(){ if(temporizadorEquipe){clearInterval(temporizadorEquipe);temporizadorEquipe=null;} }
async function abrirChatEquipe(){ estado.chatEquipeAberto=true; await carregarDadosEquipe(); pararEquipe(); temporizadorEquipe=setInterval(()=>carregarDadosEquipe(true),3000); renderizarApp(); rolarChatFim(); }
async function carregarDadosEquipe(silencioso=false){ if(!ehEquipe()) return; const contagemAntiga=estado.mensagensEquipe.length; const ultimaAntiga=estado.mensagensEquipe.at(-1)?.id; const [usuarios,convs]=await Promise.all([api('/api/team/users'),api('/api/team/conversations')]); estado.usuariosEquipe=usuarios.users; estado.conversasEquipe=convs.conversations; if(estado.conversaEquipeAtual){ const existe=estado.conversasEquipe.find(c=>c.id===estado.conversaEquipeAtual.id); if(existe){ const dados=await api(`/api/team/conversations/${existe.id}/messages`); estado.conversaEquipeAtual=dados.conversation; estado.mensagensEquipe=dados.messages; } else { estado.conversaEquipeAtual=null; estado.mensagensEquipe=[]; } } const mudou=contagemAntiga!==estado.mensagensEquipe.length||ultimaAntiga!==estado.mensagensEquipe.at(-1)?.id; if(!silencioso||mudou){ renderizarApp(); if(mudou) rolarChatFim(); } }
async function criarConversaEquipe(e){ e.preventDefault(); const fd=new FormData(e.target); const idsMembros=fd.getAll('idsMembros'); try{const dados=await api('/api/team/conversations',{method:'POST',body:JSON.stringify({title:fd.get('titulo'),memberIds:idsMembros,type:idsMembros.length>1?'group':'direct'})}); estado.conversaEquipeAtual=dados.conversation; await carregarDadosEquipe(); toast('Conversa criada.');}catch(err){toast(err.message,'error')} }
async function abrirConversaEquipe(id){ try{const dados=await api(`/api/team/conversations/${id}/messages`); estado.conversaEquipeAtual=dados.conversation; estado.mensagensEquipe=dados.messages; renderizarApp(); rolarChatFim();}catch(err){toast(err.message,'error')} }
async function enviarMensagemEquipe(e){ e.preventDefault(); const fd=new FormData(e.target); const corpo={text:fd.get('text')}; const anexo=await arquivoParaDataUrl(e.target.elements.attachment); if(anexo){corpo.attachmentDataUrl=anexo.dataUrl;corpo.attachmentName=anexo.nome;} try{await api(`/api/team/conversations/${estado.conversaEquipeAtual.id}/messages`,{method:'POST',body:JSON.stringify(corpo)}); e.target.reset(); await abrirConversaEquipe(estado.conversaEquipeAtual.id);}catch(err){toast(err.message,'error')} }
async function excluirConversaEquipe(){ if(!estado.conversaEquipeAtual)return; mostrarConfirmacao('Excluir conversa','Excluir esta conversa?',async()=>{try{await api(`/api/team/conversations/${estado.conversaEquipeAtual.id}`,{method:'DELETE'}); estado.conversaEquipeAtual=null; estado.mensagensEquipe=[]; await carregarDadosEquipe();}catch(err){toast(err.message,'error')}}) }
async function adicionarMembroEquipe(membroId){ if(!estado.conversaEquipeAtual)return; try{await api(`/api/team/conversations/${estado.conversaEquipeAtual.id}/members`,{method:'POST',body:JSON.stringify({memberIds:[membroId]})}); await abrirConversaEquipe(estado.conversaEquipeAtual.id);}catch(err){toast(err.message,'error')} }
async function removerMembroEquipe(membroId){ if(!estado.conversaEquipeAtual)return; mostrarConfirmacao('Remover membro','Remover este membro?',async()=>{try{await api(`/api/team/conversations/${estado.conversaEquipeAtual.id}/members/${membroId}`,{method:'DELETE'}); await abrirConversaEquipe(estado.conversaEquipeAtual.id);}catch(err){toast(err.message,'error')}}) }

async function enviarNotificacaoAdmin(e){
  e.preventDefault(); const fd=new FormData(e.target);
  const corpo = { userId: estado.notificarUsuarioId, type: fd.get('type'), title: fd.get('title'), text: fd.get('text') };
  try{ await api('/api/admin/notifications',{method:'POST',body:JSON.stringify(corpo)}); toast('Notificação enviada.'); estado.notificarModalAberto=false; estado.notificarUsuarioId=null; renderizarApp(); }catch(err){toast(err.message,'error')}
}

function modalNotificar(){
  if(!estado.notificarModalAberto || !estado.notificarUsuarioId) return ''
  const alvo = (estado.usuarios||[]).find(u=>u.id===estado.notificarUsuarioId)||{}
  return `<div class="modal-superposicao"><div class="modal"><div class="modal-cabecalho"><div><h2>Enviar notificação</h2><p class="texto-guia">Para: ${escaparHtml(alvo.nome||'Usuário')} (${escaparHtml(alvo.email||'—')})</p></div><button class="fechar" id="btnNotificarFechar">×</button></div><form id="formularioEnviarNotificacao" class="formulario"><div class="campo"><label>Tipo</label><select name="type"><option value="assinatura">Assinatura / Cobrança</option><option value="suporte">Suporte</option><option value="moderação">Moderação</option><option value="info">Informação geral</option></select></div><div class="campo"><label>Título</label><input name="title" required placeholder="Ex: Pagamento necessário"></div><div class="campo"><label>Mensagem</label><textarea name="text" required placeholder="Escreva a mensagem para o cliente..."></textarea></div><button class="btn primary bloco">Enviar notificação</button></form></div></div>`
}

function modalEditarUsuario(){
  const u=estado.editandoUsuario; if(!u) return '';
  return `<div class="modal-superposicao"><div class="modal"><div class="modal-cabecalho"><div><h2>Editar usuário</h2><p class="texto-guia">${escaparHtml(u.email)}</p></div><button class="fechar" id="btnFecharEdicaoUsuario">×</button></div><form id="formularioAdminUsuario" class="formulario"><input type="hidden" name="id" value="${u.id}"><div class="campo"><label>Nome</label><input name="name" value="${escaparHtml(u.nome||'')}" required></div><div class="campo"><label>E-mail</label><input name="email" type="email" value="${escaparHtml(u.email||'')}" required></div><div class="linha"><div class="campo"><label>Cargo</label><select name="role">${[['customer','Cliente'],['support','Suporte'],['moderator','Moderador'],['owner','Founder/Owner']].map(([id,rotulo])=>`<option value="${id}" ${u.cargo===id?'selected':''}>${rotulo}</option>`).join('')}</select></div><div class="campo"><label>Status</label><select name="status">${['active','blocked','deleted'].map(s=>`<option value="${s}" ${u.status===s?'selected':''}>${s}</option>`).join('')}</select></div></div><div class="linha"><div class="campo"><label>Telefone</label><input name="phone" value="${escaparHtml(u.telefone||'')}"></div><div class="campo"><label>CPF/CNPJ</label><input name="cpfCnpj" value="${escaparHtml(u.cpfCnpj||'')}"></div></div><div class="campo"><label>Nova senha (opcional)</label><input name="password" type="password"></div><label class="check"><input type="checkbox" name="forcePasswordChange" ${u.forcePasswordChange?'checked':''}> Forçar troca de senha no próximo acesso</label><div class="campo"><label>Foto de perfil</label><input name="avatar" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></div><button class="btn primary bloco">Salvar alterações</button></form></div></div>`;
}

function vincularCookie(){
  document.querySelector('#cookieNecessario')?.addEventListener('click',()=>salvarCookie(false,false));
  document.querySelector('#cookieAceitar')?.addEventListener('click',()=>salvarCookie(true,true));
}
async function salvarCookie(analytics,marketing){ localStorage.setItem('mei_cookie_ok','true'); if(estado.token){ try{await api('/api/cookies/consent',{method:'POST',body:JSON.stringify({analytics,marketing})});}catch{} } renderizarApp(); }

window.mudarAba = mudarAba;
iniciar().then(()=>{ if(estado.token) carregarDadosAba(); });
