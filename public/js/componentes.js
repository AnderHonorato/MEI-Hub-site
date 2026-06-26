function itemNotificacao(n, mostrarHora=true){
  return `<button type="button" class="nota-item ${n.lida?'':'nao-lida'}" data-notificacao-id="${n.id}"><div class="icone-estatistica">${icone(iconeNotificacao(n))}</div><div><strong>${escaparHtml(n.titulo)}</strong><br><span>${escaparHtml(n.corpo)}</span>${mostrarHora?`<small>${dataHoraFormatada(n.criadoEm)}</small>`:''}</div></button>`
}

function resumoPerfil(){
  const u=estado.usuario||{}
  return `<button class="cartao-usuario perfil-cartao" id="btnPerfil">${avatar(u)}<span><strong>${escaparHtml(u.nome)}</strong><small>${escaparHtml(tipoMarcador(u))}</small><small>${escaparHtml(u.email)}</small></span></button>`
}

function painelNotificacoes(){
  if(!estado.notificacaoAberta) return ''
  const linhas=estado.notificacoes||[]
  return `<div class="notificacoes-pop"><div class="secao-titulo compacto"><h3>Notificações</h3><button class="btn" id="btnMarcarNotificacoes">Marcar lidas</button></div>${linhas.length?linhas.slice(0,12).map(n=>itemNotificacao(n)).join(''):'<div class="vazio">Nenhuma notificação.</div>'}</div>`
}

function modalMidia(){
  if(!estado.midiaModal) return ''
  const m=estado.midiaModal
  return `<div class="modal-superposicao midia-superposicao"><div class="modal visualizacao-midia"><div class="modal-cabecalho"><div><h2>${escaparHtml(m.nome||'Mídia')}</h2><p class="texto-guia">${escaparHtml(m.mime||'Imagem')}</p></div><button class="fechar" id="btnFecharMidia">×</button></div><img src="${m.url}" alt="${escaparHtml(m.nome||'Mídia da conversa')}"></div></div>`
}

function modalPerfilDetalhe(){
  if(!estado.usuarioDetalhe) return ''
  const u=estado.usuarioDetalhe
  const sub=estado.detalheAssinatura||{}
  const cmp=estado.detalheEmpresa||{}
  const sinalizacoes=estado.sinalizacoesUsuario||[]
  const podeSinalizar=ehEquipe() && u.id!==estado.usuario.id && u.cargo!=='owner'
  const podeRemover=estado.usuario?.cargo==='owner'
  return `<div class="modal-superposicao"><div class="modal largo"><div class="modal-cabecalho"><div><h2>${escaparHtml(u.nome)}</h2><p class="texto-guia">${escaparHtml(u.email||'')}</p></div><button class="fechar" id="btnFecharPerfilDetalhe">×</button></div><div class="perfil-detalhe"><div class="perfil-grande">${avatar(u,'avatar grande')}<div><span class="marcador escuro">${escaparHtml(tipoMarcador(u))}</span><div>${estrelas(u.mediaAvaliacao)} <strong>${u.mediaAvaliacao||'0.0'}</strong> <span class="opaco">(${u.quantidadeAvaliacoes||0} avaliações)</span></div></div></div><div class="linha-kpi"><span>E-mail</span><strong>${escaparHtml(u.email||'—')}</strong></div><div class="linha-kpi"><span>Telefone</span><strong>${escaparHtml(u.telefone||'—')}</strong></div><div class="linha-kpi"><span>CPF/CNPJ</span><strong>${escaparHtml(u.cpfCnpj||'—')}</strong></div><div class="linha-kpi"><span>Status</span>${marcadorStatus(u.status)}</div><div class="linha-kpi"><span>Cadastro</span><strong>${dataHoraFormatada(u.criadoEm)}</strong></div><div class="linha-kpi"><span>Último acesso</span><strong>${dataHoraFormatada(u.ultimoLoginEm)}</strong></div>${cmp?.nomeNegocio?`<div class="linha-kpi"><span>Negócio</span><strong>${escaparHtml(cmp.nomeNegocio)}</strong></div><div class="linha-kpi"><span>CNPJ</span><strong>${escaparHtml(cmp.cnpj||'—')}</strong></div><div class="linha-kpi"><span>Atividade</span><strong>${escaparHtml(cmp.tipoAtividade||'—')}</strong></div>`:''}${sub?.nomePlano?`<div class="linha-kpi"><span>Plano</span><strong>${escaparHtml(sub.nomePlano)}</strong></div><div class="linha-kpi"><span>Assinatura</span>${marcadorStatus(sub.status)}</div>`:''}</div><div style="margin-top:14px"><h3 style="font-size:15px">Sinalizações</h3>${sinalizacoes.length?sinalizacoes.map(f=>`<div class="sinalizacao-item"><div><div class="sinalizacao-texto">${escaparHtml(f.texto)}</div><div class="sinalizacao-meta">Por ${escaparHtml(f.criadoPor?.nome||'Equipe')} em ${dataHoraFormatada(f.criadoEm)}</div></div>${podeRemover?`<button class="btn perigo" data-remover-sinalizacao="${f.id}">Remover</button>`:''}</div>`).join(''):'<div class="vazio">Nenhuma sinalização registrada.</div>'}</div>${podeSinalizar?`<div style="margin-top:14px"><button class="btn perigo" id="btnAlternarSinalizacao">Sinalizar cliente</button><form id="formularioSinalizacao" class="formulario" style="display:none;margin-top:8px"><div class="campo"><label>Motivo</label><textarea name="texto" required placeholder="Descreva o motivo da sinalização..."></textarea></div><button class="btn perigo bloco">Registrar sinalização</button></form></div>`:''}</div></div></div>`
}

function bolhaMensagemEquipe(m){
  if(m.sistema) return `<div class="msg sistema"><strong>Sistema</strong><div>${escaparHtml(m.texto||'')}</div><small>${dataHoraFormatada(m.criadoEm)}</small></div>`
  const remetente=m.remetente||{}
  const cls=remetente.id===estado.usuario.id?'eu':'outro'
  return `<div class="msg ${cls}"><div class="msg-cabecalho">${avatar(remetente,'avatar pequeno')}<strong>${escaparHtml(remetente.nome||'Usuário')}</strong><span class="marcador escuro">${escaparHtml(tipoMarcador(remetente))}</span></div>${m.texto?`<div class="msg-texto">${escaparHtml(m.texto)}</div>`:''}${m.anexo?`<button class="miniatura-midia" data-midia-url="${m.anexo.url}" data-midia-nome="${escaparHtml(m.anexo.nome||'Mídia')}" data-midia-mime="${escaparHtml(m.anexo.mime||'Imagem')}"><img src="${m.anexo.url}" alt="Mídia da conversa"></button>`:''}<small>${dataHoraFormatada(m.criadoEm)}</small></div>`
}

function modalChatEquipe(){
  if(!estado.chatEquipeAberto) return ''
  const conv=estado.conversaEquipeAtual
  const disponiveis=(estado.usuariosEquipe||[]).filter(u=>u.id!==estado.usuario.id)
  const podeAdmin=conv && (conv.adminId===estado.usuario.id || estado.usuario.cargo==='owner')
  return `<div class="chat-equipe"><div class="chat-equipe-topo"><strong>Chat da equipe</strong><button class="fechar" id="btnFecharChatEquipe">×</button></div><div class="chat-equipe-corpo"><aside class="lista-equipe"><form id="formularioConversaEquipe" class="criar-equipe"><input name="titulo" placeholder="Nome do grupo opcional"><div class="usuarios-equipe">${disponiveis.map(u=>`<label title="${escaparHtml(u.email)}"><input type="checkbox" name="idsMembros" value="${u.id}">${avatar(u,'avatar pequeno')} ${escaparHtml(u.nome)}</label>`).join('')}</div><button class="btn primary bloco">Nova conversa</button></form><div class="conversas-equipe">${(estado.conversasEquipe||[]).map(c=>`<button class="${conv?.id===c.id?'ativo':''}" data-abrir-equipe="${c.id}"><strong>${escaparHtml(c.titulo||c.membros?.filter(m=>m?.id!==estado.usuario.id).map(m=>m.nome).join(', ')||'Conversa')}</strong><small>${escaparHtml(c.ultimaMensagem?.texto||'Sem mensagens')}</small></button>`).join('')||'<div class="vazio">Nenhuma conversa.</div>'}</div></aside><main class="thread-equipe">${conv?`<div class="thread-equipe-topo"><div><strong>${escaparHtml(conv.titulo||'Conversa')}</strong><small>${conv.membros?.map(m=>`${m.nome} (${tipoMarcador(m)})`).join(' · ')}</small></div><div class="mini-acoes">${podeAdmin&&conv.tipo==='grupo'?`<select id="adicionarMembroEquipe"><option value="">Adicionar membro</option>${disponiveis.filter(u=>!conv.membros.some(m=>m.id===u.id)).map(u=>`<option value="${u.id}">${escaparHtml(u.nome)}</option>`).join('')}</select><select id="removerMembroEquipe"><option value="">Remover membro</option>${conv.membros.filter(m=>m.id!==estado.usuario.id).map(m=>`<option value="${m.id}">${escaparHtml(m.nome)}</option>`).join('')}</select>`:''}<button class="btn perigo" id="btnExcluirConversaEquipe">Excluir</button></div></div><div class="chat-equipe-mensagens">${(estado.mensagensEquipe||[]).map(bolhaMensagemEquipe).join('')}</div><form id="formularioMensagemEquipe" class="chat-compor"><textarea name="text" placeholder="Mensagem para a equipe"></textarea><label class="arquivo-inline" title="Anexar imagem">${icone('anexo')}<input name="attachment" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label><button class="btn primary">${icone('enviar')}</button></form>`:`<div class="vazio">Selecione ou crie uma conversa com a equipe.</div>`}</main></div></div>`
}

function modalFlutuante(){
  if(!estado.flutuanteAberto) return ''
  const podeVerComum=ehEquipe()
  return `<div class="flutuante-modal"><div class="flutuante-modal-topo"><strong>Conversas</strong><button class="fechar" id="btnFecharFlutuante">×</button></div><div class="flutuante-modal-corpo">${podeVerComum?`<button class="flutuante-chat-item" id="btnFlutuanteComum"><div class="icone-estatistica">${icone('usuarios')}</div><div><strong>Chat comum</strong><span style="display:block;font-size:10px;color:var(--opaco)">Conversa entre equipe</span></div></button>`:''}<button class="flutuante-chat-item" id="btnFlutuanteSuporte"><div class="icone-estatistica">${icone('chat')}</div><div><strong>Chat suporte</strong><span style="display:block;font-size:10px;color:var(--opaco)">Protocolos de atendimento</span></div></button><button class="flutuante-chat-item" id="btnFlutuanteModeracao"><div class="icone-estatistica">${icone('bandeira')}</div><div><strong>Chat moderação</strong><span style="display:block;font-size:10px;color:var(--opaco)">Protocolos de denúncia</span></div></button></div></div>`
}

function comporConversa(t){
  if(t.status==='closed') return '<div class="chat-compor"><div class="vazio vazio-compacto">Conversa encerrada. Para continuar, abra um novo protocolo.</div></div>'
  const podeResponder = ehCliente() || estado.usuario.cargo==='owner' || (t.atendente?.id === estado.usuario.id)
  if(!podeResponder) return '<div class="chat-compor"><div class="vazio vazio-compacto">Este chamado está sendo atendido por outro membro da equipe.</div></div>'
  const podeTransferir = ehEquipe() && t.atendente && t.atendente.id === estado.usuario.id && t.status==='in_progress'
  const equipe = (estado.usuariosEquipe||[]).filter(u=>u.id!==estado.usuario.id)
  return `<form id="formularioMensagem" class="chat-compor"><textarea id="textoMensagem" name="text" placeholder="Escreva sua resposta"></textarea><label class="arquivo-inline" title="Anexar imagem">${icone('anexo')}<input name="attachment" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label><button class="btn primary">${icone('enviar')}</button>${podeTransferir?`<select id="transferirAtendimento" style="font-size:11px;border:1px solid var(--linha);border-radius:12px;padding:8px;background:#fff"><option value="">Transferir</option>${equipe.map(u=>`<option value="${u.id}">${escaparHtml(u.nome)}</option>`).join('')}</select>`:''}<button type="button" class="btn perigo" id="btnFecharChamado">Finalizar</button></form>`
}

function formularioChamado(tipo){
  return `<form id="formularioChamado" class="formulario" data-tipo="${tipo}"><div class="campo"><label>Título</label><input name="title" required placeholder="Descreva o assunto principal"></div><div class="campo"><label>Categoria</label><select name="category">${tipo==='report'?'<option>Uso indevido</option><option>Fraude ou má fé</option><option>Abuso</option><option>Segurança</option>':'<option>Pagamento</option><option>DAS e obrigações</option><option>Faturamento</option><option>Erro no sistema</option><option>Conta e dados</option>'}</select></div><div class="campo"><label>Mensagem</label><textarea name="description" required></textarea></div><div class="campo"><label>Imagem opcional</label><input name="attachment" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></div><button class="btn primary bloco">Abrir protocolo</button></form>`
}

function filtrosChamados(){
  return `<div class="filtros"><label>Status <select id="filtroChamado"><option value="all">Todos</option><option value="open">Abertos</option><option value="in_progress">Em atendimento</option><option value="closed">Finalizados</option><option value="urgent">Urgentes</option></select></label></div>`
}

function visaoExperiencia(){
  const linhas=(estado.avaliacoes||[])
  const ranking=(estado.ranking||[]).filter(r=>r.quantidadeAvaliacoes)
  return `<div class="grade colunas-2"><div class="painel plano"><h3>Feedback dos usuários</h3>${linhas.length?`<div class="envoltorio-tabela"><table><thead><tr><th>Nota</th><th>Cliente</th><th>Atendente</th><th>Comentário</th><th>Conversa</th></tr></thead><tbody>${linhas.map(f=>`<tr><td>${estrelas(f.nota)}</td><td>${escaparHtml(f.cliente?.nome||'—')}</td><td>${escaparHtml(f.atendente?.nome||'Sem atendente')}</td><td>${escaparHtml(f.comentario||'—')}</td><td><button class="btn" data-abrir-chamado="${f.chamadoId}">Abrir</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="vazio">Nenhuma avaliação registrada ainda.</div>'}</div><div class="painel plano"><h3>Ranking de atendimento</h3>${ranking.length?`<div class="ranking">${ranking.map((r,i)=>`<div class="linha-rank"><strong>${i+1}</strong>${avatar(r.usuario,'avatar pequeno')}<span>${escaparHtml(r.usuario.nome)}<small>${escaparHtml(tipoMarcador(r.usuario))}</small></span><b>${r.mediaAvaliacao}</b>${estrelas(r.mediaAvaliacao)}</div>`).join('')}</div>`:'<div class="vazio">O ranking aparece após as primeiras avaliações.</div>'}</div></div>`
}

function formularioAvaliacao(){
  return `<form id="formularioAvaliacao" class="formulario" style="padding:14px;border-top:1px solid var(--linha);background:#fff"><div class="campo"><label>Avalie sua experiência (1 a 5)</label><div class="mini-acoes" style="gap:4px">${[1,2,3,4,5].map(i=>`<label style="cursor:pointer;font-size:20px"><input type="radio" name="rating" value="${i}" required style="display:none">${'★'.repeat(i)}</label>`).join('')}</div></div><div class="campo"><label>Comentário (opcional)</label><textarea name="comment" placeholder="Conte como foi sua experiência..."></textarea></div><button class="btn primary">Enviar avaliação</button></form>`
}
