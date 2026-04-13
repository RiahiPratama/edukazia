// EduKazia Service Worker — PWA + Web Push Notifications

const CACHE_NAME = 'edukazia-v2'
const OFFLINE_URL = '/offline.html'

// ── Install: cache offline fallback page ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
  )
  self.skipWaiting()
})

// ── Activate: cleanup old caches ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── Fetch: CacheFirst untuk static assets, NetworkFirst untuk halaman ──
self.addEventListener('fetch', (event) => {
  const { request } = event

  // Skip non-GET dan API requests
  if (request.method !== 'GET') return
  if (request.url.includes('/api/')) return

  // Static assets → CacheFirst
  if (request.url.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|css|js)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // Halaman → NetworkFirst, fallback ke offline page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    )
    return
  }
})

// ── Push Notification (existing) ──
self.addEventListener('push', function(event) {
  if (!event.data) return

  const data = event.data.json()
  const options = {
    body:    data.body,
    icon:    '/icons/icon-192.png',
    badge:   '/icons/icon-96.png',
    tag:     data.tag ?? 'edukazia',
    data:    { url: data.url ?? '/ortu/dashboard' },
    actions: data.actions ?? [],
    vibrate: [200, 100, 200],
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()
  const url = event.notification.data?.url ?? '/ortu/dashboard'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('app.edukazia.com') && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
