'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import {
  Smartphone, Monitor, Tablet, Bell, BellOff, Trash2, Shield, Wifi, Pencil, Check, X,
} from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import toast from 'react-hot-toast'

interface PushSubscription {
  id: string
  endpoint: string
  deviceName: string | null
  userAgent: string | null
  createdAt: string
}

function getDeviceIcon(userAgent: string | null) {
  if (!userAgent) return Monitor
  const ua = userAgent.toLowerCase()
  if (/mobile|android|iphone/.test(ua)) return Smartphone
  if (/ipad|tablet/.test(ua)) return Tablet
  return Monitor
}

function getUASnippet(userAgent: string | null): string {
  if (!userAgent) return 'Unknown browser'
  const match = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/)
  if (match) return match[0]
  return userAgent.slice(0, 40) + '...'
}

type PermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported'

export default function ConnectedDevicesPage() {
  const [subscriptions, setSubscriptions] = useState<PushSubscription[]>([])
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState<string | null>(null)
  const [permission, setPermission] = useState<PermissionStatus>('unsupported')

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [savingRename, setSavingRename] = useState(false)

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission as PermissionStatus)
    }
    fetchSubscriptions()
  }, [])

  async function fetchSubscriptions() {
    setLoading(true)
    try {
      const res = await fetch('/api/push/subscriptions')
      const data = await res.json()
      setSubscriptions(data.subscriptions || [])
    } catch {
      toast.error('Failed to load connected devices')
    } finally {
      setLoading(false)
    }
  }

  async function removeDevice(id: string) {
    if (!confirm('Remove this device? It will no longer receive push notifications.')) return
    setRemoving(id)
    try {
      const res = await fetch(`/api/push/subscriptions?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setSubscriptions(prev => prev.filter(s => s.id !== id))
      toast.success('Device removed')
    } catch {
      toast.error('Failed to remove device')
    } finally {
      setRemoving(null)
    }
  }

  function startRename(sub: PushSubscription) {
    setRenamingId(sub.id)
    setRenameValue(sub.deviceName || '')
  }

  function cancelRename() {
    setRenamingId(null)
    setRenameValue('')
  }

  async function saveRename(id: string) {
    setSavingRename(true)
    try {
      const res = await fetch('/api/push/subscriptions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, deviceName: renameValue }),
      })
      if (!res.ok) throw new Error()
      setSubscriptions(prev =>
        prev.map(s => s.id === id ? { ...s, deviceName: renameValue } : s)
      )
      toast.success('Device renamed')
      setRenamingId(null)
      setRenameValue('')
    } catch {
      toast.error('Failed to rename device')
    } finally {
      setSavingRename(false)
    }
  }

  async function enableNotifications() {
    if (!('Notification' in window)) {
      toast.error('Notifications are not supported in this browser')
      return
    }
    const perm = await Notification.requestPermission()
    setPermission(perm as PermissionStatus)
    if (perm === 'granted' && 'serviceWorker' in navigator && 'PushManager' in window) {
      try {
        const reg = await navigator.serviceWorker.ready
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!vapidKey) {
          toast.error('Push notifications not configured (missing VAPID key)')
          return
        }
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
        toast.success('This device is now connected for notifications!')
        fetchSubscriptions()
      } catch (e) {
        toast.error('Failed to subscribe to push notifications')
      }
    } else if (perm === 'denied') {
      toast.error('Notification permission denied. Enable it in browser settings.')
    }
  }

  const permissionLabel = {
    granted: { label: 'Granted', color: 'text-green-400 border-green-400/30 bg-green-400/5' },
    denied: { label: 'Denied', color: 'text-red-400 border-red-400/30 bg-red-400/5' },
    default: { label: 'Not requested', color: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/5' },
    unsupported: { label: 'Unsupported', color: 'text-white/30 border-white/10 bg-white/5' },
  }[permission]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Connected Devices" subtitle="Manage your sync & push notification endpoints" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-5">

          {/* Status + Enable button */}
          <div className="glass-panel rounded-xl p-4 border border-cyan-400/15 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 flex-1">
              <Wifi size={16} className="text-cyan-400 flex-shrink-0" />
              <div>
                <p className="text-white/70 text-sm font-medium">Push Notifications</p>
                <p className="text-white/40 text-xs">Receive real-time alerts on your devices</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`text-[10px] px-2 py-1 rounded-full border flex items-center gap-1 ${permissionLabel.color}`}>
                {permission === 'granted' ? <Bell size={9} /> : <BellOff size={9} />}
                {permissionLabel.label}
              </span>
              {permission !== 'granted' && (
                <button
                  onClick={enableNotifications}
                  className="nexus-btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
                >
                  <Bell size={12} />
                  Enable Notifications
                </button>
              )}
            </div>
          </div>

          {/* Info panel */}
          <div className="glass-panel rounded-xl p-4 border border-violet-500/15 flex items-start gap-3">
            <Shield size={16} className="text-violet-400 flex-shrink-0 mt-0.5" />
            <p className="text-white/45 text-xs leading-relaxed">
              NEXUS can send real-time notifications to all connected devices. Each device that grants
              notification permission is registered here. You can remove any device at any time to
              stop it from receiving push notifications.
            </p>
          </div>

          {/* Device list */}
          <div>
            <p className="text-white/30 text-xs uppercase tracking-wider mb-3 px-1">
              {subscriptions.length} device{subscriptions.length !== 1 ? 's' : ''} connected
            </p>

            {loading ? (
              <div className="glass-panel rounded-xl p-8 text-center">
                <div className="w-6 h-6 border border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-white/30 text-sm">Loading devices...</p>
              </div>
            ) : subscriptions.length === 0 ? (
              <div className="glass-panel rounded-xl p-10 text-center">
                <Wifi size={32} className="text-white/10 mx-auto mb-3" />
                <p className="text-white/40 text-sm font-medium">No devices connected</p>
                <p className="text-white/25 text-xs mt-1 max-w-xs mx-auto">
                  Enable notifications on each device you want to sync with NEXUS.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {subscriptions.map(sub => {
                  const DeviceIcon = getDeviceIcon(sub.userAgent)
                  const isRenaming = renamingId === sub.id
                  return (
                    <div key={sub.id} className="glass-panel-hover rounded-xl p-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg border border-cyan-400/15 flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(0,212,255,0.04)' }}>
                        <DeviceIcon size={18} className="text-cyan-400/70" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {isRenaming ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveRename(sub.id)
                                if (e.key === 'Escape') cancelRename()
                              }}
                              className="nexus-input text-sm py-1 px-2 flex-1"
                              autoFocus
                            />
                            <button
                              onClick={() => saveRename(sub.id)}
                              disabled={savingRename}
                              className="text-green-400 hover:text-green-300 p-1 rounded transition-colors disabled:opacity-40"
                              title="Save"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={cancelRename}
                              className="text-white/30 hover:text-white/60 p-1 rounded transition-colors"
                              title="Cancel"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <p className="text-white/80 text-sm font-medium truncate">
                              {sub.deviceName || 'Unknown Device'}
                            </p>
                            <button
                              onClick={() => startRename(sub)}
                              className="text-white/20 hover:text-cyan-400 transition-colors p-1 rounded flex-shrink-0"
                              title="Rename device"
                            >
                              <Pencil size={12} />
                            </button>
                          </div>
                        )}
                        <p className="text-white/35 text-xs truncate nexus-mono">
                          {getUASnippet(sub.userAgent)}
                        </p>
                        <p className="text-white/25 text-xs mt-0.5">
                          Connected {formatRelativeTime(sub.createdAt)}
                        </p>
                      </div>
                      {!isRenaming && (
                        <button
                          onClick={() => removeDevice(sub.id)}
                          disabled={removing === sub.id}
                          className="text-white/20 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-red-400/5 flex-shrink-0 disabled:opacity-40"
                          title="Remove device"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
