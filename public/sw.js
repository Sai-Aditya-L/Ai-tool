const CACHE_NAME = 'nexus-v2'
const STATIC_CACHE = 'nexus-static-v2'
const API_CACHE = 'nexus-api-v1'

// Static assets to precache
const PRECACHE_URLS = [
  '/',
  '/dashboard',
  '/offline.html',
  '/manifest.json',
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

// Install — precache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
  )
  self.skipWaiting()
})

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== STATIC_CACHE && k !== API_CACHE && k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET and cross-origin
  if (request.method !== 'GET' || url.origin !== location.origin) return

  // Stale-while-revalidate for safe API read endpoints
  if (isSWRRoute(url.href)) {
    event.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        const networkFetch = fetch(request).then((res) => {
          if (res.ok) cache.put(request, res.clone())
          return res
        }).catch(() => cached)
        // Return cached immediately if available, revalidate in background
        return cached || networkFetch
      })
    )
    return
  }

  // Network-first for other API routes (mutations/writes — cache as fallback only)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(API_CACHE).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // Cache-first for static assets (JS, CSS, images, fonts)
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.includes('/icon-') ||
    url.pathname.endsWith('.png') || url.pathname.endsWith('.svg') ||
    url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached || fetch(request).then((response) => {
          if (response.ok) {
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, response.clone()))
          }
          return response
        })
      )
    )
    return
  }

  // Pages: stale-while-revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request)
      const fetchPromise = fetch(request).then((response) => {
        if (response.ok) cache.put(request, response.clone())
        return response
      }).catch(() => cached || new Response('Offline', { status: 503 }))
      return cached || fetchPromise
    })
  )
})

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'NEXUS', {
      body: data.body || 'You have a new notification',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'nexus-notification',
      data: { url: data.url || '/dashboard' },
      vibrate: [100, 50, 100],
      actions: data.actions || [],
    })
  )
})

// Notification click — open the relevant page
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/dashboard'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const existing = windowClients.find((c) => c.url.includes(new URL(url, self.location.origin).pathname))
      if (existing && 'focus' in existing) return existing.focus()
      return clients.openWindow(url)
    })
  )
})

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'nexus-sync') {
    event.waitUntil(
      fetch('/api/world-state').catch(() => {})
    )
  }
  if (event.tag === 'sync-tasks') {
    event.waitUntil(syncOfflineData('tasks'))
  }
})

async function syncOfflineData(type) {
  // Notify clients to retry pending offline actions
  const cs = await clients.matchAll({ type: 'window' })
  cs.forEach(c => c.postMessage({ type: 'SYNC_COMPLETE', dataType: type }))
}
