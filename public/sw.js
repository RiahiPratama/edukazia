// EduKazia Service Worker — Web Push Notifications
self.addEventListener('push', function(event) {
  if (!event.data) return

  const data = event.data.json()
  const options = {
    body:    data.body,
    icon:    '/icon-192.png',
    badge:   '/icon-96.png',
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
        if (client.url.includes('edukazia.vercel.app') && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', () => self.clients.claim())
