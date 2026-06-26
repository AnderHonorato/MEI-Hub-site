const CACHE = 'meiraiz-v2'
const ARQUIVOS_ESTATICOS = [
  '/',
  '/manifest.json',
  '/css/estilo.css',
  '/js/util.js',
  '/js/icones.js',
  '/js/estado.js',
  '/js/api.js',
  '/js/componentes.js',
  '/js/paginas.js',
  '/js/instalarApp.js',
  '/js/app.js',
  '/img/icone-192.png',
  '/img/icone-512.png',
  '/img/icone-512-maskable.png',
  '/img/apple-touch-icon.png',
  '/img/icone-base.png',
  '/img/texto-sem-fundo-modo-claro.png'
]

self.addEventListener('install', e => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ARQUIVOS_ESTATICOS)))
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(chaves => Promise.all(
      chaves.filter(c => c !== CACHE).map(c => caches.delete(c))
    ))
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  if (url.pathname.startsWith('/api/')) return
  if (url.pathname === '/sw.js') return fetch(e.request)
  e.respondWith(
    caches.match(e.request).then(resposta => resposta || fetch(e.request).then(res => {
      if (res && res.status === 200 && res.type === 'basic') {
        const clone = res.clone()
        caches.open(CACHE).then(cache => cache.put(e.request, clone))
      }
      return res
    }))
  )
})
