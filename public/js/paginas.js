function itensNavegacao(){
  if(estado.usuario?.cargo==='owner') return [['admin','usuarios','Admin'],['suporte','chat','Suporte'],['moderacao','bandeira','Moderação'],['conta','configuracoes','Conta']]
  if(estado.usuario?.cargo==='support') return [['suporte','chat','Atendimentos'],['conta','configuracoes','Conta']]
  if(estado.usuario?.cargo==='moderator') return [['moderacao','bandeira','Denúncias'],['conta','configuracoes','Conta']]
  return [['dashboard','grafico','Dashboard'],['lancamentos','carteira','Lançamentos'],['obrigacoes','calendario','Obrigações'],['relatorios','arquivo','Relatórios'],['suporte','chat','Suporte'],['denuncia','bandeira','Denúncias'],['conta','configuracoes','Conta']]
}

function estatistica(ic,rotulo,valor,tipo='ok'){
  return `<div class="painel"><div class="estatistica"><div class="icone-estatistica">${icone(ic)}</div><div><span>${rotulo}</span><b>${valor}</b></div></div></div>`
}

function tabelaMeses(linhas=[]){
  return `<div class="envoltorio-tabela"><table><thead><tr><th>Mês</th><th>Receita</th><th>Acumulado</th><th>Limite</th><th>Status</th></tr></thead><tbody>${linhas.map(r=>`<tr><td>${r.nome}</td><td>${dinheiroValor(r.receita)}</td><td>${dinheiroValor(r.acumulado)}</td><td>${r.percentual}%</td><td>${marcadorStatus(r.status==='limit_exceeded'?'past_due':r.status==='warning'?'pending_checkout':'active')}</td></tr>`).join('')}</tbody></table></div>`
}

function listaObrigacoes(linhas=[]){
  if(!linhas.length) return `<div class="vazio">Nenhuma obrigação pendente.</div>`
  return `<div class="linha-do-tempo">${linhas.map(o=>`<div class="nota"><div class="icone-estatistica">${icone('calendario')}</div><div><strong>${escaparHtml(o.titulo)}</strong><br><span>${dataFormatada(o.dataVencimento)} · ${dinheiroValor(o.valor)} · ${statusObrigacao(o.status)}</span></div></div>`).join('')}</div>`
}

function filaChamadosFiltrado(tipo){
  let linhas=(estado.chamados||[]).filter(t=>t.tipo===tipo)
  if(estado.filtroChamados==='urgent') linhas=linhas.filter(t=>t.prioridade==='urgent')
  else if(estado.filtroChamados!=='all' && estado.filtroChamados!=='todos') linhas=linhas.filter(t=>t.status===estado.filtroChamados)
  return linhas
}

function textoMetaChamado(t){
  return `${statusChamado(t.status)} · Aberto em ${dataHoraFormatada(t.criadoEm)}${t.atendente?` · Atendente: ${t.atendente.nome}`:''}`
}

function visaoDashboard(){
  const d=estado.dashboard
  if(!d) return painelCarregando('Carregando dashboard...')
  const c=d.atual||{}
  const pct=Math.min(120,c.percentual||0)
  const classeStatus=c.percentual>120?'perigo':c.percentual>=100?'alerta':c.percentual>=80?'alerta':'ok'
  const primeiraAno = d.limiteProporcional && d.limiteProporcional < (d.empresa?.limiteAnual||81000)
  const infoLimite = primeiraAno
    ? `<p class="texto-guia" style="margin-top:4px">Sua empresa foi aberta no mês ${d.mesesAtivos ? 13 - d.mesesAtivos : '?'}. Limite proporcional este ano: <strong>${dinheiroValor(d.limiteProporcional)}</strong> (${d.mesesAtivos}/12 meses).</p>`
    : ''
  const infoRitmo = d.mesesRestantes && d.mesesRestantes > 0
    ? `<p class="texto-guia" style="margin-top:4px">No ritmo atual (média de ${dinheiroValor(d.mediaMensal)}/mês), voce atingiria o limite em <strong>${d.mesesRestantes} meses</strong>.</p>`
    : ''
  const infoCpf = d.receitasCpf > 0
    ? `<p class="texto-guia" style="margin-top:4px">Receitas via CPF relacionadas à atividade: ${dinheiroValor(d.receitasCpf)} (total fiscal: ${dinheiroValor(d.accCpf)}).</p>`
    : ''
  const avisoDas = d.dasConsecutivos?.consecutivos >= 2
    ? `<div class="aviso-alerta"><strong>Atenção:</strong> ${d.dasConsecutivos.consecutivos} DAS consecutivos vencidos. Dois anos seguidos em débito podem levar ao cancelamento do CNPJ.</div>`
    : ''
  const dasnInfo = d.diasAteDasn !== null && d.diasAteDasn >= 0
    ? `<div class="painel plano" style="margin-top:8px"><div class="secao-titulo compacto"><h3>DASN-SIMEI: ${d.diasAteDasn} dias restantes</h3><span class="marcador ${d.diasAteDasn<=30?'perigo':'alerta'}">até 31 de maio</span></div><ol class="lista-legal"><li>Acesse o Portal do Simples Nacional.</li><li>Informe seu CNPJ.</li><li>Informe o total de receita bruta do ano anterior (use o relatório abaixo).</li></ol></div>`
    : ''
  const reforma = `<div class="painel plano" style="margin-top:8px;border-left:3px solid var(--primario)"><p style="font-size:12px;color:var(--opaco);margin:0"><strong>Novo:</strong> A partir de 2027, a nota fiscal eletrônica será obrigatória em todas as vendas do MEI (inclusive para pessoa física). O regime de transição da Reforma Tributária (CBS/IBS) vai até 2033. Acompanhe atualizações no Portal do Empreendedor.</p></div>`
  return `<div class="grade">${avisoDas}<div class="painel suave"><div class="secao-titulo"><div><h2>Faturamento acumulado de ${d.ano}</h2><p class="texto-guia">${dinheiroValor(c.acumulado)} de ${dinheiroValor(d.empresa.limiteAnual)} usados no limite de referência.${infoLimite}${infoRitmo}${infoCpf}</p></div><span class="marcador ${classeStatus}">${c.percentual||0}% do limite</span></div><div class="progresso"><span style="width:${pct}%"></span></div></div>
  <div class="grade colunas-4">${estatistica('carteira','Receita do mês',dinheiroValor(c.receita),'ok')}${estatistica('recibo','Despesas do mês',dinheiroValor(c.despesas),'perigo')}${estatistica('grafico','Saldo do mês',dinheiroValor((c.receita||0)-(c.despesas||0)),'escuro')}${estatistica('escudo','Disponível no limite',dinheiroValor(Math.max(0,(d.empresa?.limiteAnual||81000)-(c.acumulado||0))),'ok')}</div>
  <div class="grade colunas-2"><div class="painel"><h3>Resumo por mês</h3>${tabelaMeses(d.meses)}</div><div class="painel"><h3>Próximas obrigações</h3>${listaObrigacoesDashboard(d.obrigacoes)}</div></div>
  ${dasnInfo}${reforma}
  <div class="painel"><h3>Últimos lançamentos</h3>${tabelaLancamentos(d.lancamentos,true)}</div></div>`
}

function listaObrigacoesDashboard(linhas=[]){
  if(!linhas.length) return `<div class="vazio">Nenhuma obrigação pendente.</div>`
  return `<div class="linha-do-tempo">${linhas.map(o=>{
    const multaInfo = o.multa ? ` · Multa est.: ${dinheiroValor(o.multa)}` : ''
    const atrasoInfo = o.diasAtraso > 0 ? ` · ${o.diasAtraso} dias atraso` : ''
    return `<div class="nota"><div class="icone-estatistica">${icone('calendario')}</div><div><strong>${escaparHtml(o.titulo)}</strong><br><span>${dataFormatada(o.dataVencimento)} · ${dinheiroValor(o.valor)} · ${statusObrigacao(o.status)}${atrasoInfo}${multaInfo}</span></div></div>`
  }).join('')}</div>`
}
}

function visaoLancamentos(){
  return `<div class="grade colunas-2"><div class="painel"><h2>Novo lançamento</h2><form id="formularioLancamento" class="formulario"><div class="campo"><label>Descrição</label><input id="tituloLancamento" name="title" required placeholder="Venda para cliente, compra de material, serviço recebido"></div><div class="linha"><div class="campo"><label>Data</label><input name="date" type="date" required value="${new Date().toISOString().slice(0,10)}"></div><div class="campo"><label>Tipo</label><select name="type"><option value="revenue">Receita</option><option value="expense">Despesa</option></select></div></div><div class="linha"><div class="campo"><label>Categoria</label><select name="category"><option>Prestação de Serviço</option><option>Venda de Produto</option><option>Imposto/DAS</option><option>Fornecedor</option><option>Equipamento</option><option>Marketing</option><option>Retirada do dono</option><option>Outros</option></select></div><div class="campo"><label>Valor</label><input name="amount" type="number" step="0.01" min="0.01" required></div></div><div class="linha"><div class="campo"><label>Cliente/fornecedor</label><input name="contactName"></div><div class="campo"><label>Forma de pagamento</label><select name="paymentMethod"><option>Pix</option><option>Cartão</option><option>Dinheiro</option><option>Transferência</option><option>Boleto</option></select></div></div><label class="check"><input type="checkbox" name="invoiceIssued"> Nota fiscal emitida</label><label class="check"><input type="checkbox" name="cpfsReceita"> Esta receita veio como pessoa física (CPF), mas é da mesma atividade do meu MEI.</label><p class="texto-guia" style="font-size:10px;margin-top:-4px">Conforme Resolução CGSN 183/2025, rendimentos CPF da mesma atividade somam ao faturamento do CNPJ para fins de limite.</p><div class="campo"><label>Observações</label><textarea name="notes"></textarea></div><button class="btn primary bloco">Salvar lançamento</button></form></div><div class="painel"><h2>Lançamentos registrados</h2>${tabelaLancamentos(estado.lancamentos)}</div></div>`
}

function visaoObrigacoes(){
  return `<div class="painel"><div class="secao-titulo"><div><h2>Obrigações fiscais</h2><p class="texto-guia">Marque como pago e anexe comprovantes quando necessário.</p></div></div>${tabelaObrigacoes(estado.obrigacoes)}</div>`
}

function visaoRelatorios(){
  const mes=new Date().getMonth()+1
  const anoAnterior = new Date().getFullYear() - 1
  return `<div class="grade colunas-2"><div class="painel"><h2>Gerar relatório mensal</h2><form id="formularioRelatorio" class="formulario"><div class="linha"><div class="campo"><label>Ano</label><input name="year" type="number" value="${new Date().getFullYear()}"></div><div class="campo"><label>Mês</label><select name="month">${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${i+1===mes?'selected':''}>${new Date(2026,i,1).toLocaleString('pt-BR',{month:'long'})}</option>`).join('')}</select></div></div><button class="btn primary">Gerar resumo</button></form></div><div class="painel" id="resultadoRelatorio"><div class="vazio">Escolha o período para gerar o resumo.</div></div></div>
  <div class="painel" style="margin-top:12px"><div class="secao-titulo"><div><h2>Resumo para DASN-SIMEI ${anoAnterior}</h2><p class="texto-guia">Use este resumo para preencher a declaração anual no Portal do Simples Nacional. A entrega vai de 1º de janeiro até 31 de maio de ${new Date().getFullYear()}.</p></div></div><button class="btn primary" id="btnGerarDasn">Gerar resumo DASN-SIMEI</button><div id="resultadoDasn" style="margin-top:12px"></div></div>`
}

function visaoSuporte(){
  if(ehCliente()) return `<div class="grade colunas-2"><div class="painel"><h2>Abrir solicitação</h2>${formularioChamado('support')}</div><div class="painel"><h2>Meus protocolos</h2>${filaChamados('support')}</div></div>`
  return visaoEquipeChamados('support','Atendimento de suporte')
}

function visaoDenuncia(){
  return `<div class="grade colunas-2"><div class="painel"><h2>Registrar denúncia</h2><p class="texto-guia">Use este canal para reportar uso indevido, má fé, abuso, fraude ou problema de segurança.</p>${formularioChamado('report')}</div><div class="painel"><h2>Minhas denúncias</h2>${filaChamados('report')}</div></div>`
}

function visaoModeracao(){
  return visaoEquipeChamados('report','Moderação e denúncias')
}

function visaoEquipeChamados(tipo,titulo){
  return `<div class="grade"><div class="painel"><div class="secao-titulo compacto"><div><h2>${titulo}</h2><p class="texto-guia">Urgentes aparecem no topo; use os filtros para separar abertos, em atendimento e finalizados.</p></div><div class="segmentado"><button class="${estado.subAbaSuporte==='fila'?'ativo':''}" data-subaba-suporte="fila">Fila</button><button class="${estado.subAbaSuporte==='experiencia'?'ativo':''}" data-subaba-suporte="experiencia">Experiência</button><button class="${estado.subAbaSuporte==='modelos'?'ativo':''}" data-subaba-suporte="modelos">Modelos</button></div></div>${estado.subAbaSuporte==='experiencia'?visaoExperiencia():estado.subAbaSuporte==='modelos'?visaoModelos():`${filtrosChamados()}${filaChamados(tipo)}`}</div></div>`
}

function filaChamados(tipo){
  const linhas=filaChamadosFiltrado(tipo)
  if(!linhas.length) return `<div class="vazio">Nenhum protocolo encontrado.</div>`
  return `<div class="grade">${linhas.map(t=>`<article class="chamado ${t.prioridade==='urgent'?'urgente':''}"><div><h3>${escaparHtml(t.titulo)} <span class="marcador escuro">${t.protocolo}</span> ${t.prioridade==='urgent'?'<span class="marcador perigo">Urgente</span>':''}</h3><p>${escaparHtml(t.categoria)} · ${statusChamado(t.status)} · Aberto em ${dataHoraFormatada(t.criadoEm)} · Cliente: ${escaparHtml(t.cliente?.nome||'—')} ${ehEquipe()?`<button class="btn" data-usuario-detalhe="${t.cliente?.id||''}" style="font-size:10px;padding:3px 6px">Ver perfil</button>`:''} ${t.atendente?`· Atendimento: ${escaparHtml(t.atendente.nome)} (${escaparHtml(tipoMarcador(t.atendente))})`:''}</p>${t.infoFila?.mensagem?`<small class="nota-fila">${escaparHtml(t.infoFila.mensagem)}</small>`:''}</div><div class="mini-acoes">${ehEquipe()&&t.status==='open'?`<button class="btn primary" data-iniciar-chamado="${t.id}">Iniciar</button>`:''}<button class="btn" data-abrir-chamado="${t.id}">Abrir conversa</button>${t.status!=='closed'?`<button class="btn perigo" data-fechar-chamado="${t.id}">Finalizar</button>`:''}</div></article>`).join('')}</div>`
}

function tabelaLancamentos(linhas=[],compacto=false){
  if(!linhas.length) return `<div class="vazio">Nenhum lançamento registrado.</div>`
  return `<div class="envoltorio-tabela"><table><thead><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th>Categoria</th><th>Valor</th>${compacto?'':'<th></th>'}</tr></thead><tbody>${linhas.map(l=>{ const d=l.data||l.date; const t=l.titulo||l.title||''; const tp=l.tipo||l.type||'expense'; const c=l.categoria||l.category||''; const v=l.valor!==undefined?l.valor:l.amount||0; return`<tr><td>${dataFormatada(d)}</td><td>${escaparHtml(t)}</td><td><span class="marcador ${tp==='revenue'?'ok':'perigo'}">${tp==='revenue'?'Receita':'Despesa'}</span></td><td>${escaparHtml(c)}</td><td><strong>${dinheiroValor(v)}</strong></td>${compacto?'':`<td><button class="btn perigo" data-excluir-lancamento="${l.id}">Excluir</button></td>`}</tr>`}).join('')}</tbody></table></div>`
}

function tabelaObrigacoes(linhas=[]){
  if(!linhas.length) return painelCarregando('Carregando obrigações...')
  return `<div class="envoltorio-tabela"><table><thead><tr><th>Obrigação</th><th>Tipo</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Comprovante</th><th>Ação</th></tr></thead><tbody>${linhas.map(o=>{ const ti=o.titulo||o.title||''; const tp=o.tipo||o.type||''; const dv=o.dataVencimento||o.dueDate; const vl=o.valor!==undefined?o.valor:o.amount||0; const uc=o.urlComprovante||o.receiptUrl; return`<tr><td>${escaparHtml(ti)}</td><td>${escaparHtml(tp)}</td><td>${dataFormatada(dv)}</td><td>${dinheiroValor(vl)}</td><td><span class="marcador ${o.status==='paid'?'ok':o.status==='late'?'perigo':'alerta'}">${statusObrigacao(o.status)}</span></td><td>${uc?`<a href="${uc}" target="_blank">Ver arquivo</a>`:'—'}</td><td><div class="mini-acoes"><label class="btn" style="cursor:pointer">Comprovante<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-ob-anexo="${o.id}" style="display:none" onchange="anexarComprovante(this)"></label><button class="btn" data-ob-paga="${o.id}">Marcar pago</button></div></td></tr>`}).join('')}</tbody></table></div>`
}

function tabelaUsuarios(){
  if(!estado.usuarios?.length) return '<div class="vazio">Carregando usuários.</div>'
  return `<div class="envoltorio-tabela"><table><thead><tr><th>Perfil</th><th>E-mail</th><th>Cargo</th><th>Status</th><th>Ações</th></tr></thead><tbody>${estado.usuarios.map(u=>`<tr><td><button class="btn" style="padding:0;background:transparent;border:0" data-usuario-detalhe="${u.id}">${avatar(u,'avatar pequeno')} <span>${escaparHtml(u.nome)}</span></button></td><td>${escaparHtml(u.email)}</td><td>${escaparHtml(tipoMarcador(u))}</td><td><span class="marcador ${u.status==='active'?'ok':u.status==='blocked'?'alerta':'perigo'}">${escaparHtml(u.status)}</span></td><td><div class="mini-acoes"><button class="btn" data-editar-usuario="${u.id}">Editar</button>${u.id!==estado.usuario.id?`<button class="btn perigo" data-excluir-usuario="${u.id}">Excluir</button>`:''}${ehEquipe()&&u.cargo==='customer'?`<button class="btn" data-notificar-usuario="${u.id}">Notificar</button>`:''}</div></td></tr>`).join('')}</tbody></table></div>`
}

function formularioPerfil(){
  return `<form id="formularioPerfil" class="formulario modo-leitura">
    <div class="perfil-grande pequeno">${avatar(estado.usuario,'avatar grande')}<div><span class="marcador escuro">${escaparHtml(tipoMarcador(estado.usuario))}</span><div>${estrelas(estado.usuario?.mediaAvaliacao)} <strong>${estado.usuario?.mediaAvaliacao||'0.0'}</strong></div></div></div>
    <div class="campo"><label>Nome</label><input name="name" value="${escaparHtml(estado.usuario?.nome||'')}" disabled></div>
    <div class="campo"><label>Telefone</label><input name="phone" value="${escaparHtml(estado.usuario?.telefone||'')}" disabled></div>
    <div class="campo"><label>Foto de perfil</label><input name="avatar" type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled></div>
    <div class="acoes-edicao">
      <button type="button" class="btn" data-editar-formulario>Editar informações</button>
      <button type="submit" class="btn primary" data-salvar-formulario style="display:none">Salvar perfil</button>
      <button type="button" class="btn" data-cancelar-formulario style="display:none">Cancelar</button>
    </div>
  </form>`
}

function visaoNotificacoes(){
  const linhas=estado.notificacoes||[]
  if(!linhas.length) return '<div class="vazio">Nenhuma notificação.</div>'
  return `<div class="linha-do-tempo">${linhas.slice(0,10).map(n=>itemNotificacao(n,false)).join('')}</div>`
}

function visaoAssinatura(){
  const s=estado.assinatura||{}
  const atrasado=s.status==='past_due'
  return `<div class="grade colunas-2"><div class="painel suave"><h2>Assinatura</h2>${atrasado?`<div class="aviso-alerta">Seu pagamento está pendente. Regularize para continuar usando todos os recursos do sistema.</div>`:''}<div class="linha-kpi"><span>Status</span>${marcadorStatus(s.status||'pending_checkout')}</div><div class="linha-kpi"><span>Plano</span><strong>${escaparHtml(s.nomePlano||'Plano Pro MEI no Controle')}</strong></div><div class="linha-kpi"><span>Valor</span><strong>${dinheiroValor(s.preco||24.9)}/mês</strong></div><div class="linha-kpi"><span>Fim do teste</span><strong>${s.fimTesteEm?new Date(s.fimTesteEm).toLocaleString('pt-BR'):'Após checkout validado'}</strong></div><div class="linha-kpi"><span>Próxima cobrança</span><strong>${s.proximaCobrancaEm?new Date(s.proximaCobrancaEm).toLocaleString('pt-BR'):'Pendente'}</strong></div><div class="mini-acoes" style="margin-top:14px"><button class="btn primary" id="btnIniciarTeste">${['trialing','active'].includes(s.status)?'Assinatura liberada':'Iniciar teste com checkout'}</button>${s.urlCheckout?`<a class="btn" href="${s.urlCheckout}" target="_blank">Abrir checkout</a>`:''}<button class="btn perigo" id="btnCancelarPlano">Cancelar assinatura</button></div></div><div class="painel"><h2>Como funciona a cobrança</h2><ul class="lista-legal"><li>O teste grátis começa depois da validação do método de pagamento.</li><li>A plataforma avisa durante o teste e antes das próximas cobranças.</li><li>Em produção, o cartão é informado no checkout seguro do gateway. O sistema não salva número completo do cartão.</li><li>Se houver pagamento pendente, alguns recursos podem ficar restritos até regularização.</li></ul></div></div>`
}

function visaoConta(){
  const s=estado.assinatura||{}
  const atrasado=s.status==='past_due'
  return `<div class="grade colunas-2"><div class="painel"><h2>Perfil</h2>${formularioPerfil()}</div><div class="painel"><h2>Dados do MEI</h2><form id="formularioEmpresa" class="formulario modo-leitura"><div class="campo"><label>Razao/Nome do negocio</label><input name="businessName" value="${escaparHtml(estado.empresa?.nomeNegocio||'')}" disabled></div><div class="campo"><label>Nome fantasia</label><input name="tradeName" value="${escaparHtml(estado.empresa?.nomeFantasia||'')}" disabled></div><div class="linha"><div class="campo"><label>CNPJ</label><input name="cnpj" value="${escaparHtml(estado.empresa?.cnpj||'')}" disabled></div><div class="campo"><label>Atividade</label><select name="activityType" disabled>${['Servicos','Comercio','Comercio + Servicos','Caminhoneiro'].map(x=>`<option ${estado.empresa?.tipoAtividade===x?'selected':''}>${x}</option>`).join('')}</select></div></div><div class="linha"><div class="campo"><label>Limite anual</label><input name="annualLimit" type="number" step="0.01" value="${estado.empresa?.limiteAnual||81000}" disabled></div><div class="campo"><label>Valor DAS mensal</label><input name="dasValue" type="number" step="0.01" value="${estado.empresa?.valorDas||86.05}" disabled></div></div><div class="acoes-edicao"><button type="button" class="btn" data-editar-formulario>Editar informações</button><button type="submit" class="btn primary" data-salvar-formulario style="display:none">Salvar dados</button><button type="button" class="btn" data-cancelar-formulario style="display:none">Cancelar</button></div></form></div><div class="painel"><h2>Seguranca</h2>${secaoSeguranca()}</div><div class="painel"><h2>Assinatura e cobranca</h2>${atrasado?`<div class="aviso-alerta">Seu pagamento esta pendente. Regularize para continuar usando todos os recursos do sistema.</div>`:''}<div class="linha-kpi"><span>Status</span>${marcadorStatus(s.status||'pending_checkout')}</div><div class="linha-kpi"><span>Plano</span><strong>${escaparHtml(s.nomePlano||'Plano Pro MEI no Controle')}</strong></div><div class="linha-kpi"><span>Valor</span><strong>${dinheiroValor(s.preco||24.9)}/mes</strong></div><div class="linha-kpi"><span>Fim do teste</span><strong>${s.fimTesteEm?new Date(s.fimTesteEm).toLocaleString('pt-BR'):'Apos checkout validado'}</strong></div><div class="linha-kpi"><span>Proxima cobranca</span><strong>${s.proximaCobrancaEm?new Date(s.proximaCobrancaEm).toLocaleString('pt-BR'):'Pendente'}</strong></div><div class="mini-acoes" style="margin-top:14px"><button class="btn primary" id="btnIniciarTeste">${['trialing','active'].includes(s.status)?'Assinatura liberada':'Iniciar teste com checkout'}</button>${s.urlCheckout?`<a class="btn" href="${s.urlCheckout}" target="_blank">Abrir checkout</a>`:''}<button class="btn perigo" id="btnCancelarPlano">Cancelar assinatura</button></div></div><div class="painel"><h2>Privacidade e cookies</h2><ul class="lista-legal"><li>Voce pode exportar seus dados solicitando pelo suporte.</li><li>Voce pode solicitar exclusao da conta, desde que nao exista pagamento pendente.</li><li>Dados obrigatorios podem ser mantidos por prazo legal ou defesa de direitos.</li></ul><button class="btn" id="btnRedefinirCookie">Revisar cookies</button></div><div class="painel zona-perigo"><h2>Zona de risco</h2><p class="texto-guia">A exclusao desativa sua conta e inicia o processo de remocao dos dados nao obrigatorios.</p><button class="btn perigo" id="btnExcluirConta">Solicitar exclusao da conta</button></div></div>`
}

function visaoAdmin(){
  return `<div class="grade"><div class="grade colunas-4">${estatistica('usuarios','Clientes',estado.metricas?.clientes??'—')}${estatistica('cartao','Assinaturas',estado.metricas?.assinaturasAtivas??'—')}${estatistica('chat','Suporte aberto',estado.metricas?.chamadosPendentes??'—')}${estatistica('bandeira','Denúncias abertas',estado.metricas?.denunciasPendentes??'—')}</div><div class="grade colunas-2"><div class="painel"><h2>Criar usuário interno</h2><form id="formularioEquipe" class="formulario"><div class="campo"><label>Nome</label><input name="name" required></div><div class="campo"><label>E-mail</label><input name="email" type="email" required></div><div class="linha"><div class="campo"><label>Cargo</label><select name="role"><option value="support">Suporte</option><option value="moderator">Moderação</option><option value="owner">Founder/Owner</option></select></div><div class="campo"><label>Senha temporária</label><input name="password" value="Equipe@123456!"></div></div><button class="btn primary bloco">Criar usuário</button></form></div><div class="painel"><div class="secao-titulo compacto"><h2>Usuários</h2><p class="texto-guia">Owner pode editar cargo, status, senha, perfil e excluir contas. Clique no perfil para ver detalhes.</p></div>${tabelaUsuarios()}</div></div></div>`
}

function bolhaMensagem(m){
  if(m.sistema) return `<div class="msg sistema"><strong>Sistema</strong><div>${formatarTexto(m.texto||'')}</div><small>${dataHoraFormatada(m.criadoEm)}</small></div>`
  const remetente=m.remetente||{}
  const souEu=remetente.id===estado.usuario.id
  return `<div class="msg-linha ${souEu?'eu':'outro'}"><div class="msg ${souEu?'eu':'outro'}"><div class="msg-cabecalho">${avatar(remetente,'avatar pequeno')}<strong>${escaparHtml(remetente.nome||'Usuário')}</strong>${iconeCargo(remetente)}</div>${m.texto?`<div class="msg-texto">${formatarTexto(m.texto)}</div>`:''}${m.anexo?`<button class="miniatura-midia" data-midia-url="${m.anexo.url}" data-midia-nome="${escaparHtml(m.anexo.nome||'Mídia')}" data-midia-mime="${escaparHtml(m.anexo.mime||'Imagem')}"><img src="${m.anexo.url}" alt="Mídia da conversa"></button>`:''}</div><small class="msg-hora">${dataHoraFormatada(m.criadoEm)}</small></div>`
}

function conversaChamadoHtml(){
  const t=estado.chamadoAtual
  const filaMsg=estado.infoFila?.mensagem?`<div class="msg sistema fila-sistema"><strong>Sistema de fila</strong><div>${escaparHtml(estado.infoFila.mensagem)}</div></div>`:''
  return `${filaMsg}${(estado.mensagens||[]).map(bolhaMensagem).join('')}`
}

function modalChamado(){
  if(!estado.chamadoAtual) return ''
  const t=estado.chamadoAtual
  const podeFechar = (ehEquipe()||ehCliente()) && t.status!=='closed'
  const podeTransferir = ehEquipe() && t.atendente && t.atendente.id === estado.usuario.id && t.status==='in_progress'
  const equipe = (estado.usuariosEquipe||[]).filter(u=>u.id!==estado.usuario.id)
  const modelos = estado.modelos||[]
  return `<div class="modal-superposicao"><div class="modal largo chat-modal"><div class="chat-modal-topo modal-cabecalho"><div><h2>${escaparHtml(t.protocolo)} · ${escaparHtml(t.titulo)}</h2><p class="texto-guia" id="metaModalChamado">${escaparHtml(textoMetaChamado(t))}</p></div><div class="mini-acoes">${modelos.length?`<select id="seletorModeloTopo" onchange="aplicarModelo(this)" style="font-size:11px;border:1px solid var(--linha);border-radius:12px;padding:6px 8px;background:#fff"><option value="">Modelos</option>${modelos.map(m=>`<option value="${m.id}">${escaparHtml(m.titulo)}</option>`).join('')}</select>`:''}${podeTransferir?`<select id="transferirAtendimento" style="font-size:11px;border:1px solid var(--linha);border-radius:12px;padding:6px 8px;background:#fff"><option value="">Transferir</option>${equipe.map(u=>`<option value="${u.id}">${escaparHtml(u.nome)}</option>`).join('')}</select>`:''}${podeFechar?`<button class="btn perigo" id="btnFecharChamadoTopo">Finalizar</button>`:''}<button class="fechar" id="btnFecharModalChamado">×</button></div></div><div class="chat" id="corpoChatChamado">${conversaChamadoHtml()}</div><div id="areaComporChamado">${comporConversa(t)}${t.status==='closed'&&ehCliente()&&!t.feedback?formularioAvaliacao():''}</div></div></div>`
}

function visaoBloqueio(){
  if(estado.assinatura?.status==='past_due'){
    return `<div class="bloqueio"><div><h2>Pagamento pendente</h2><p>Seu plano está com pagamento em atraso. Regularize a assinatura para liberar todos os recursos do painel.</p></div><div><button class="btn primary bloco" onclick="mudarAba('conta')">Ver assinatura</button><button class="btn bloco" onclick="mudarAba('suporte')">Falar com suporte</button></div></div>`
  }
  return `<div class="bloqueio"><div><h2>Finalize o checkout para liberar o painel</h2><p>Seu cadastro está pronto. Para iniciar o teste grátis de 7 dias, valide o método de pagamento pelo checkout seguro.</p><div class="mini-acoes"><span class="marcador ok">7 dias grátis</span><span class="marcador ok">Dados salvos</span><span class="marcador ok">Cancelamento pela conta</span></div></div><div><button class="btn primary bloco" id="btnIniciarTeste">Iniciar teste com checkout</button><button class="btn bloco" onclick="mudarAba('suporte')">Falar com suporte</button></div></div>`
}

function secaoSeguranca(){
  const u = estado.usuario || {}
  if(estado.codigosBackup2fa){
    return `<div><p class="texto-guia"><strong>2FA ativado!</strong> Guarde estes codigos de backup em local seguro:</p><pre style="background:#f5f5f5;padding:12px;border-radius:8px;overflow-x:auto">${(estado.codigosBackup2fa||[]).join('\n')}</pre><button class="btn bloco" onclick="estado.codigosBackup2fa=null;renderizarApp()">Entendi</button></div>`
  }
  if(u.totpAtivo){
    return `<p class="texto-guia">Autenticacao de dois fatores esta <strong>ativa</strong>.</p>
      <form id="formularioDesativar2fa" class="formulario"><div class="campo"><label>Senha atual</label><input name="senha" type="password" required></div><button class="btn perigo bloco">Desativar 2FA</button></form>`
  }
  if(estado.qrCode2fa){
    return `<div style="text-align:center"><img src="${estado.qrCode2fa}" alt="QR Code 2FA" style="max-width:200px;margin-bottom:12px"><p class="texto-guia">Escaneie o QR code com Google Authenticator ou use o codigo manual: <code style="word-break:break-all">${escaparHtml(estado.segredoManual2fa||'')}</code></p><form id="formularioConfirmar2fa" class="formulario"><div class="campo"><label>Codigo do aplicativo</label><input name="codigo" required inputmode="numeric" maxlength="6"></div><button class="btn primary bloco">Ativar 2FA</button></form></div>`
  }
  return `<button class="btn bloco" id="btnIniciar2fa">Ativar autenticacao de dois fatores</button>`
}
