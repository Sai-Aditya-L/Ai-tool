interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

function cleanup() {
  const now = Date.now()
  Array.from(store.entries()).forEach(([key, entry]) => {
    if (entry.resetAt < now) store.delete(key)
  })
}

// Run cleanup every 5 minutes to prevent unbounded memory growth
setInterval(cleanup, 5 * 60 * 1000)

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    // Clean up expired entries after each call
    cleanup()
    return { success: true, allowed: true, remaining: limit - 1, resetAt: now + windowMs }
  }

  if (entry.count >= limit) {
    return { success: false, allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  // Clean up expired entries after each call
  cleanup()
  return { success: true, allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt }
}

export function rateLimitResponse() {
  return new Response(JSON.stringify({ error: 'Too many requests. Please slow down.' }), {
    status: 429,
    headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
  })
}
