async function api(caminho, opcoes={}) {
  const cabecalhos = {'Content-Type':'application/json', ...(opcoes.cabecalhos||{})};
  if (estado.token) cabecalhos.Authorization = `Bearer ${estado.token}`;
  const resposta = await fetch(caminho, {...opcoes, headers: cabecalhos});
  const dados = await resposta.json().catch(()=>({ok:false,message:'Resposta inválida do servidor.'}));
  if (dados.precisaAceitarTermos) {
    estado.precisaAceitarTermos = true
    estado.versaoTermos = dados.version
    renderizarApp()
    throw new Error('Você precisa aceitar os novos Termos de Uso e Política de Privacidade para continuar.')
  }
  if (!resposta.ok || dados.ok === false) throw new Error(dados.message || 'Falha na requisição.');
  return dados;
}
async function arquivoParaDataUrl(entrada) {
  const arquivo = entrada?.files?.[0];
  if (!arquivo) return null;
  return await new Promise((resolve, reject) => { const r = new FileReader(); r.onload=()=>resolve({dataUrl:r.result, nome:arquivo.name}); r.onerror=reject; r.readAsDataURL(arquivo); });
}
function toast(msg, tipo='ok') { const el=document.createElement('div'); el.className=`toast ${tipo}`; el.textContent=msg; document.querySelector('#toast').appendChild(el); setTimeout(()=>el.remove(),4500); }
function mostrarConfirmacao(titulo, mensagem, aoOk) {
  const id = 'confirmar-' + Date.now();
  const html = `<div class="confirmar-modal" id="${id}"><div class="confirmar-caixa"><h3>${escaparHtml(titulo)}</h3><p>${escaparHtml(mensagem)}</p><div class="mini-acoes"><button class="btn" id="${id}-nao">Cancelar</button><button class="btn primary" id="${id}-sim">Confirmar</button></div></div></div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById(`${id}-sim`).onclick = () => { document.getElementById(id).remove(); if(aoOk) aoOk(); };
  document.getElementById(`${id}-nao`).onclick = () => document.getElementById(id).remove();
}
function chaveNotificacaoVista(){ return `mei_notificacoes_vistas_${estado.usuario?.id||'anon'}`; }
function lerIdsNotificacoesVistas(){ try { return new Set(JSON.parse(localStorage.getItem(chaveNotificacaoVista()) || '[]')); } catch { return new Set(); } }
function salvarIdsNotificacoesVistas(ids){ localStorage.setItem(chaveNotificacaoVista(), JSON.stringify([...ids].slice(-250))); }
let bolhaTimer = null;
function removerBolhaNotificacao(){ if(bolhaTimer){ clearTimeout(bolhaTimer); bolhaTimer=null; } document.querySelector('.bolha-notificacao')?.remove(); }
function mostrarBolhaNotificacao(n){ if(!n) return; removerBolhaNotificacao(); const sino=document.querySelector('#btnNotificacoes'); const el=document.createElement('button'); el.type='button'; el.className='bolha-notificacao'; el.innerHTML=`<span class="icone-estatistica">${icone(iconeNotificacao(n))}</span><span><strong>${escaparHtml(n.titulo)}</strong><small>${escaparHtml(n.corpo)}</small></span>`; el.addEventListener('click',()=>abrirNotificacao(n)); document.body.appendChild(el); const rect=sino?.getBoundingClientRect(); el.style.top=rect?`${Math.round(rect.bottom + 8)}px`:'60px'; el.style.right=rect?`${Math.max(12, Math.round(window.innerWidth - rect.right))}px`:'20px'; bolhaTimer=setTimeout(removerBolhaNotificacao,8000); }
function processarNotificacoesRecebidas(linhas=[]){ if(!estado.usuario) return; const vistas=lerIdsNotificacoesVistas(); const naoVistas=linhas.filter(n=>n?.id && !n.lida && !vistas.has(n.id)); if(!naoVistas.length) return; naoVistas.forEach(n=>vistas.add(n.id)); salvarIdsNotificacoesVistas(vistas); mostrarBolhaNotificacao(naoVistas[0]); }
function atualizarEmblemaNotificacoes(){ const btn=document.querySelector('#btnNotificacoes'); if(btn) btn.innerHTML=`${icone('sino')} ${naoPagos()?`<span class="ponto-contador">${naoPagos()}</span>`:''}`; }
