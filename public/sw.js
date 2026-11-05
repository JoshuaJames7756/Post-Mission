const CACHE_PREFIX = 'post-mission-static-'
const CACHE_NAME = `${CACHE_PREFIX}v6`
const VERSIONED_ASSET = /^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?|png|svg|webp|avif)$/
let retryCount = 0
const OFFLINE_HTML = `<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#171e1b">
  <title>Sin conexión · Post Mission</title>
  <style>
    :root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    *{box-sizing:border-box}
    body{align-items:center;background:#171e1b;color:#f3f5f3;display:flex;justify-content:center;margin:0;min-height:100svh;padding:28px}
    main{max-width:400px;width:100%}
    img{background:#26332f;border-radius:20px;display:block;height:64px;margin-bottom:34px;padding:10px;width:64px}
    p{color:#b1bcb5;font-size:15px;line-height:1.6;margin:0 0 24px}
    h1{font-size:clamp(28px,8vw,36px);letter-spacing:-.04em;line-height:1.12;margin:0 0 12px}
    a{background:#e5a0bc;border-radius:12px;color:#20161c;display:inline-flex;font-size:14px;font-weight:700;justify-content:center;min-height:46px;min-width:142px;padding:12px 20px;text-decoration:none}
    a:focus-visible{outline:3px solid #f3f5f3;outline-offset:4px}
  </style>
</head>
<body><main><img src="/icons/post-mission.svg" alt="" width="64" height="64"><h1>Sin conexión</h1><p>Conéctate para ver tu espacio y guardar cambios. Tus datos confirmados siguen en tu cuenta.</p><a href="__RETRY_URL__">Reintentar</a></main></body>
</html>`
const APP_SHELL = [
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/post-mission.svg',
  '/icons/post-mission-192.png',
  '/icons/post-mission-512.png',
  '/theme-bootstrap.js',
  '/fonts/manrope-latin-wght-normal.woff2',
]

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    const shell = await fetch('/')
    if (!shell.ok) throw new Error('App shell is unavailable')
    const html = await shell.clone().text()
    const assets = [...new Set([...html.matchAll(/\/assets\/[^"'<>\s]+/g)]
      .map(([path]) => path).filter((path) => VERSIONED_ASSET.test(path)))]
    await cache.addAll([...APP_SHELL, ...assets])
    await cache.put('/', shell)
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)),
    )),
    self.clients.claim(),
  ]))
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)

  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => {
      const retryUrl = `/?retry=${Date.now()}-${++retryCount}#home`
      return new Response(OFFLINE_HTML.replace('__RETRY_URL__', retryUrl), { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    }))
    return
  }

  if (VERSIONED_ASSET.test(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request).then(async (response) => {
      if (response.ok && response.type === 'basic' && !response.headers.get('Cache-Control')?.includes('no-store')) {
        const cache = await caches.open(CACHE_NAME)
        await cache.put(request, response.clone())
      }
      return response
    })))
    return
  }

  if (APP_SHELL.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)))
  }
})

const PUSH_DESTINATIONS = new Set(['#home', '#plan', '#calendar', '#people', '#map', '#reviews'])

self.addEventListener('push', (event) => {
  let payload = {}
  try { payload = event.data?.json() ?? {} } catch { /* Ignore malformed payloads. */ }
  const title = typeof payload.title === 'string' ? payload.title.slice(0, 80) : 'Post Mission'
  const body = typeof payload.body === 'string' ? payload.body.slice(0, 180) : 'Un momento para revisar tu plan.'
  const destination = PUSH_DESTINATIONS.has(payload.destination) ? payload.destination : '#home'
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/icons/post-mission-192.png',
    badge: '/icons/post-mission-192.png',
    tag: 'post-mission-reminder',
    data: { destination },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const destination = PUSH_DESTINATIONS.has(event.notification.data?.destination) ? event.notification.data.destination : '#home'
  const target = `${self.location.origin}/${destination}`
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin)
    if (existing) {
      if (existing.navigate) await existing.navigate(target)
      await existing.focus()
    } else await self.clients.openWindow(target)
  })())
})
