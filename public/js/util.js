function dinheiroValor(v){ return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function dataFormatada(v){ return v ? new Date(v + (String(v).length === 10 ? 'T12:00:00' : '')).toLocaleDateString('pt-BR') : '—'; }
function escaparHtml(s){ return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function dataHoraFormatada(v){ return v ? new Date(v).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}) : '—'; }
function naoPagos(){ return (estado.notificacoes||[]).filter(n=>!n.lida).length; }
function iconeNotificacao(n){ if(n?.tipo==='cobranca') return 'cartao'; if(n?.tipo==='sinalizacao') return 'bandeira'; return n?.tipo==='equipe'?'chat':'sino'; }
function formatarTexto(t){
  if(!t) return ''
  let txt = escaparHtml(t)
  txt = txt.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  txt = txt.replace(/\*(.+?)\*/g, '<em>$1</em>')
  txt = txt.replace(/`(.+?)`/g, '<code>$1</code>')
  txt = txt.replace(/\n/g, '<br>')
  return txt
}
function iconeCargo(usuario){
  if(usuario?.cargo==='customer') return ''
  const mapa = {owner:{ic:'escudo',titulo:'Fundador'},support:{ic:'chat',titulo:'Suporte'},moderator:{ic:'bandeira',titulo:'Moderador'}}
  const c = mapa[usuario?.cargo]
  if(!c) return ''
  return `<span class="icone-cargo" title="${c.titulo}">${icone(c.ic,'icone icone-cargo-svg')}</span>`
}

function tipoMarcador(usuario){ return usuario?.marcadorRotulo || ({owner:'Fundador',support:'Suporte',moderator:'Moderador',customer:'Cliente'}[usuario?.cargo]||'Usuário'); }
function avatar(usuario, classe='avatar'){ return usuario?.avatarUrl ? `<img class="${classe}" src="${usuario.avatarUrl}" alt="Foto de ${escaparHtml(usuario.nome||'usuário')}">` : `<span class="${classe}">${escaparHtml(usuario?.iniciais || String(usuario?.nome||'U').slice(0,1).toUpperCase())}</span>`; }
function estrelas(valor=0){ const v=Number(valor||0); return `<span class="estrelas">${[1,2,3,4,5].map(i=>`<span class="${i<=Math.round(v)?'acesa':''}">★</span>`).join('')}</span>`; }
function ehEquipe(){ return ['owner','support','moderator'].includes(estado.usuario?.cargo); }
function ehCliente(){ return estado.usuario?.cargo === 'customer'; }
function planoOk(){ return ['trialing','active'].includes(estado.assinatura?.status) || ehEquipe(); }
function cargoEquipe(cargo){ return ['owner','support','moderator'].includes(cargo); }
function marcadorStatus(s){ const mapa={pending_checkout:['alerta','Checkout pendente'],trialing:['ok','Teste grátis'],active:['ok','Plano ativo'],past_due:['perigo','Pagamento pendente'],canceled:['perigo','Cancelado']}; const m=mapa[s]||['escuro',s]; return `<span class="marcador ${m[0]}">${m[1]}</span>`; }
function rotuloRapido(){ if(ehCliente()&&!planoOk()) return 'Liberar teste'; if(estado.aba==='lancamentos') return 'Novo lançamento'; if(ehCliente()) return 'Novo lançamento'; return 'Ver fila'; }
function statusChamado(s){return ({open:'Aberto',in_progress:'Em atendimento',closed:'Finalizado'}[s]||s)}
function statusObrigacao(s){return ({pending:'Pendente',paid:'Pago',late:'Atrasado'}[s]||s)}
function painelCarregando(txt){ return `<div class="painel"><div class="vazio">${txt}</div></div>` }
function tituloAba(){ return ({dashboard:'Dashboard',lancamentos:'Lançamentos',obrigacoes:'Obrigações fiscais',relatorios:'Relatórios',suporte:'Suporte por protocolo',denuncia:'Denúncias e uso indevido',moderacao:'Fila de moderação',assinatura:'Assinatura',conta:'Conta e privacidade',admin:'Administração'}[estado.aba]||'Painel'); }
function subtituloAba(){ return ({dashboard:'Resumo do faturamento, limite anual e próximos vencimentos.',lancamentos:'Receitas e despesas do seu MEI.',obrigacoes:'DAS, DASN-SIMEI, comprovantes e status.',relatorios:'Resumo mensal para conferência ou envio ao contador.',suporte:'Abra ou acompanhe conversas com a equipe de suporte.',denuncia:'Reporte abuso, má fé ou uso indevido da plataforma.',moderacao:'Protocolos de denúncia com bloqueio por atendente.',assinatura:'Teste grátis, checkout e cobranças.',conta:'Dados do MEI, notificações, cookies e LGPD.',admin:'Usuários, métricas e permissões da equipe.'}[estado.aba]||''); }
