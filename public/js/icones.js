function icone(nome, classe='icone') {
  const caminhos = {
    logotipo:'<path d="M9 21h12a4 4 0 0 0 4-4V9a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v8a4 4 0 0 0 4 4Z"/><path d="M10 16V9l5 4 5-4v7"/><path d="M9 21c1.6-4 3.7-6 6-6s4.4 2 6 6"/>',
    grafico:'<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16v-5"/><path d="M12 16V8"/><path d="M16 16v-7"/><path d="M20 16v-3"/>',
    carteira:'<path d="M4 7a3 3 0 0 1 3-3h11v5H7a3 3 0 0 0-3 3v5a3 3 0 0 0 3 3h13V9"/><path d="M17 14h.01"/>',
    recibo:'<path d="M7 4h10a2 2 0 0 1 2 2v15l-3-2-3 2-3-2-3 2V6a2 2 0 0 1 2-2Z"/><path d="M9 8h6"/><path d="M9 12h6"/><path d="M9 16h4"/>',
    calendario:'<path d="M7 3v4"/><path d="M17 3v4"/><path d="M4 9h16"/><path d="M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><path d="m8 14 2 2 5-5"/>',
    escudo:'<path d="M12 3 5 6v5c0 5 3.5 8.5 7 10 3.5-1.5 7-5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
    sino:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    usuario:'<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/>',
    usuarios:'<path d="M17 21a6 6 0 0 0-12 0"/><circle cx="11" cy="7" r="4"/><path d="M22 21a5 5 0 0 0-4-4.8"/><path d="M17 3.2a4 4 0 0 1 0 7.6"/>',
    cadeado:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    cartao:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18"/><path d="M7 15h3"/>',
    chat:'<path d="M21 12a8 8 0 0 1-8 8H5l-2 2 1.2-4.2A8 8 0 1 1 21 12Z"/><path d="M8 11h8"/><path d="M8 15h5"/>',
    bandeira:'<path d="M5 21V4"/><path d="M5 5h11l-1.5 4L16 13H5"/>',
    arquivo:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/><path d="M9 14h6"/><path d="M9 17h4"/>',
    mais:'<path d="M12 5v14"/><path d="M5 12h14"/>',
    saida:'<path d="M10 17 15 12 10 7"/><path d="M15 12H3"/><path d="M21 3v18"/>',
    configuracoes:'<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V22a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 1 1 4.2 18l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 7.1 4.2l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1h.1a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
    telefone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
    anexo:'<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
    enviar:'<path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4 20-7z"/>',
    menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
    seta:'<path d="m15 18-6-6 6-6"/>',
    olho:'<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/>',
    transferir:'<path d="M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4"/>'
  };
  return `<svg class="${classe}" viewBox="0 0 24 24" aria-hidden="true">${caminhos[nome] || caminhos.logotipo}</svg>`;
}
function logotipo(){ return `<div class="logotipo"><div class="logotipo-marca">${icone('logotipo')}</div><div><strong>MEI no Controle</strong><small>Faturamento, DAS e obrigações</small></div></div>`; }
function barraCookie(){ if(localStorage.getItem('mei_cookie_ok')) return ''; return `<div class="cookie"><div><strong>Preferências de cookies</strong><p>Usamos cookies necessários para login e segurança. Você pode liberar ou recusar cookies analíticos e de marketing.</p></div><div class="mini-acoes"><button class="btn" id="cookieNecessario">Somente necessários</button><button class="btn primary" id="cookieAceitar">Aceitar todos</button></div></div>`; }
