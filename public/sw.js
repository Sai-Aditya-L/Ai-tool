const CACHE_NAME = 'nexus-v1'
const SHELL_URLS = ['/', '/dashboard', '/chat', '/tasks', '/reminders']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(SHELL_URLS)))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))))
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('/api/')) {
    // Network first for API
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)))
    return
  }
  // Cache first for assets
  e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
    if (res.ok) {
      const clone = res.clone()
      caches.open(CACHE_NAME).then(c => c.put(e.request, clone))
    }
    return res
  })))
})

self.addEventListener('push', (e) => {
  const data = e.data?.json() || { title: 'NEXUS', body: 'New notification' }
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/dashboard' },
    tag: data.tag || 'nexus-notification',
  }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(clients.matchAll({ type: 'window' }).then(cs => {
    const url = e.notification.data?.url || '/dashboard'
    const existing = cs.find(c => c.url.includes(url) && 'focus' in c)
    if (existing) return existing.focus()
    return clients.openWindow(url)
  }))
})
