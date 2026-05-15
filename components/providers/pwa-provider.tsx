'use client'
import { useEffect } from 'react'
import { useSession } from 'next-auth/react'

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error)
    }
  }, [])

  useEffect(() => {
    if (!session?.user) return
    // Request notification permission and subscribe to push
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(perm => {
        if (perm === 'granted' && 'serviceWorker' in navigator && 'PushManager' in window) {
          subscribeToPush()
        }
      })
    }
  }, [session])

  async function subscribeToPush() {
    try {
      const reg = await navigator.serviceWorker.ready
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) return
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      })
      const json = sub.toJSON()
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
          deviceName: navigator.platform,
          userAgent: navigator.userAgent,
        }),
      })
    } catch (e) {
      // Push not supported or user denied — silent fail
    }
  }

  return <>{children}</>
}
