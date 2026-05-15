const CACHE_NAME = 'nexus-v2'
const API_CACHE_NAME = 'nexus-api-v1'

const SHELL_URLS = [
  '/', '/dashboard', '/chat', '/tasks', '/reminders',
  '/notes', '/calendar', '/memory', '/files', '/notifications',
]

// API routes to cache with stale-while-revalidate (read-heavy, low-volatility)
const SWR_API_ROUTES = [
  '/api/tasks',
  '/api/reminders',
  '/api/notes',
  '/api/memory',
  '/api/notifications',
  '/api/settings',
  '/api/integrations/status',
]

function isSWRRoute(url) {
  try {
    const path = new URL(url).pathname
    return SWR_API_ROUTES.some(r => path === r || path.startsWith(r + '?'))
  } catch { return false }
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== API_CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const { request } = e
  const url = request.url

  // Only handle GET requests for caching
  if (request.method !== 'GET') return

  // Stale-while-revalidate for safe API read endpoints
  if (isSWRRoute(url)) {
    e.respondWith(
      caches.open(API_CACHE_NAME).then(async cache => {
        const cached = await cache.match(request)
        const networkFetch = fetch(request).then(res => {
          if (res.ok) cache.put(request, res.clone())
          return res
        }).catch(() => cached) // fall back to cache if offline

        // Return cached immediately if available, revalidate in background
        return cached || networkFetch
      })
    )
    return
  }

  // Network-first for all other API routes (mutations/writes should not be cached)
  if (url.includes('/api/')) {
    e.respondWith(
      fetch(request).catch(() => caches.match(request))
    )
    return
  }

  // Cache-first for static assets (JS, CSS, images, fonts)
  if (
    url.includes('/_next/static/') ||
    url.includes('/icon-') ||
    url.includes('.png') || url.includes('.svg') ||
    url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')
  ) {
    e.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(res => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE_NAME).then(c => c.put(request, clone))
        }
        return res
      }))
    )
    return
  }

  // Stale-while-revalidate for app shell pages
  e.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(request)
      const networkFetch = fetch(request).then(res => {
        if (res.ok) cache.put(request, res.clone())
        return res
      }).catch(() => cached)
      return cached || networkFetch
    })
  )
})

self.addEventListener('push', (e) => {
  const data = e.data?.json() || { title: 'NEXUS', body: 'New notification' }
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/dashboard' },
      tag: data.tag || 'nexus-notification',
      vibrate: [100, 50, 100],
      actions: data.actions || [],
    })
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      const url = e.notification.data?.url || '/dashboard'
      const existing = cs.find(c => c.url.includes(new URL(url, self.location.origin).pathname))
      if (existing && 'focus' in existing) return existing.focus()
      return clients.openWindow(url)
    })
  )
})

// Background sync for offline writes (basic support)
self.addEventListener('sync', (e) => {
  if (e.tag === 'sync-tasks') {
    e.waitUntil(syncOfflineData('tasks'))
  }
})

async function syncOfflineData(type) {
  // Placeholder for offline write queue — notify clients to retry
  const cs = await clients.matchAll({ type: 'window' })
  cs.forEach(c => c.postMessage({ type: 'SYNC_COMPLETE', dataType: type }))
}
