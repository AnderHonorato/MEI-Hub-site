let eventoInstalacaoAndroid = null
let segundosNaPagina = 0
let usuarioClicou = false
let bannerJaExibido = false

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  eventoInstalacaoAndroid = e
  verificarEngajamentoEExibir()
})

document.addEventListener('click', () => {
  if (!usuarioClicou) {
    usuarioClicou = true
    verificarEngajamentoEExibir()
  }
}, { once: false })

function rodandoComoApp() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

function ehIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function ehAndroid() {
  return /android/i.test(navigator.userAgent)
}

function jaFoiDispensado() {
  return localStorage.getItem('meiraiz_pwa_prompt_visto') === '1'
}

function marcarDispensado() {
  localStorage.setItem('meiraiz_pwa_prompt_visto', '1')
}

function jaEngajouAntes() {
  return localStorage.getItem('meiraiz_pwa_engajado') === '1'
}

function marcarEngajado() {
  localStorage.setItem('meiraiz_pwa_engajado', '1')
}

function podeExibirBanner() {
  return !rodandoComoApp() && !jaFoiDispensado() && (ehIOS() || ehAndroid())
}

function verificarEngajamentoEExibir() {
  if (bannerJaExibido || !podeExibirBanner()) return
  if (eventoInstalacaoAndroid || (segundosNaPagina >= 30 && usuarioClicou)) {
    bannerJaExibido = true
    marcarEngajado()
    mostrarBannerInstalar()
  }
}

function mostrarBannerInstalar() {
  if (document.getElementById('bannerInstalarApp')) return
  document.body.insertAdjacentHTML('beforeend', `
    <div class="banner-instalar-app" id="bannerInstalarApp">
      <div><strong>Instale o Meiraiz</strong><span>Acesse mais rápido, como um aplicativo.</span></div>
      <div class="mini-acoes">
        <button class="btn" id="btnDepoisInstalarApp">Mais tarde</button>
        <button class="btn primary" id="btnInstalarApp">Instalar</button>
      </div>
    </div>
  `)
  document.getElementById('btnDepoisInstalarApp').onclick = dispensarBanner
  document.getElementById('btnInstalarApp').onclick = aoClicarInstalar
}

function dispensarBanner() {
  marcarDispensado()
  document.getElementById('bannerInstalarApp')?.remove()
}

async function aoClicarInstalar() {
  if (eventoInstalacaoAndroid) {
    eventoInstalacaoAndroid.prompt()
    const escolha = await eventoInstalacaoAndroid.userChoice
    if (escolha.outcome === 'accepted') {
      marcarDispensado()
      document.getElementById('bannerInstalarApp')?.remove()
    }
    return
  }
  if (ehIOS()) {
    marcarDispensado()
    document.getElementById('bannerInstalarApp')?.remove()
    mostrarInstrucoesIOS()
    return
  }
  if (ehAndroid()) {
    marcarDispensado()
    document.getElementById('bannerInstalarApp')?.remove()
    toast('A instalação direta requer HTTPS. Use o menu do Chrome (três pontinhos) > "Instalar aplicativo".', 'ok')
    return
  }
  marcarDispensado()
  document.getElementById('bannerInstalarApp')?.remove()
}

function mostrarInstrucoesIOS() {
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-superposicao" id="modalInstrucoesInstalar">
      <div class="modal">
        <div class="modal-cabecalho">
          <h2>Instalar no iPhone/iPad</h2>
          <button class="fechar" id="btnFecharInstrucoesInstalar">×</button>
        </div>
        <ol class="lista-legal">
          <li>Toque no botão de Compartilhar (ícone do quadrado com a seta para cima) na barra do Safari.</li>
          <li>Role e toque em "Adicionar à Tela de Início".</li>
          <li>Toque em "Adicionar" no canto superior direito.</li>
        </ol>
      </div>
    </div>
  `)
  document.getElementById('btnFecharInstrucoesInstalar').onclick = () => document.getElementById('modalInstrucoesInstalar').remove()
}

setInterval(() => {
  if (rodandoComoApp() || bannerJaExibido) return
  segundosNaPagina++
  verificarEngajamentoEExibir()
}, 1000)

if (podeExibirBanner() && jaEngajouAntes()) {
  mostrarBannerInstalar()
  bannerJaExibido = true
}
