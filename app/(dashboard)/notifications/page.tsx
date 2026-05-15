'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Bell, Trash2, CheckCheck, Info, AlertTriangle, XCircle, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns'

interface Notification {
  id: string
  title: string
  body: string
  type: string
  read: boolean
  createdAt: string
  link?: string | null
}

interface GroupedNotifications {
  Today: Notification[]
  Yesterday: Notification[]
  Earlier: Notification[]
}

function getTypeStyles(type: string) {
  switch (type) {
    case 'info':
      return { border: 'border-l-cyan-400', icon: Info, iconColor: 'text-cyan-400', bg: 'bg-cyan-400/5' }
    case 'warning':
      return { border: 'border-l-yellow-400', icon: AlertTriangle, iconColor: 'text-yellow-400', bg: 'bg-yellow-400/5' }
    case 'error':
      return { border: 'border-l-red-400', icon: XCircle, iconColor: 'text-red-400', bg: 'bg-red-400/5' }
    case 'success':
      return { border: 'border-l-green-400', icon: CheckCircle, iconColor: 'text-green-400', bg: 'bg-green-400/5' }
    default:
      return { border: 'border-l-cyan-400', icon: Info, iconColor: 'text-cyan-400', bg: 'bg-cyan-400/5' }
  }
}

function groupNotifications(notifications: Notification[]): GroupedNotifications {
  const groups: GroupedNotifications = { Today: [], Yesterday: [], Earlier: [] }
  for (const n of notifications) {
    const date = parseISO(n.createdAt)
    if (isToday(date)) groups.Today.push(n)
    else if (isYesterday(date)) groups.Yesterday.push(n)
    else groups.Earlier.push(n)
  }
  return groups
}

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const markAllRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readAll: true }),
      })
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch {
      // ignore
    }
  }

  const markRead = async (id: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      })
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch {
      // ignore
    }
  }

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    // Optimistic removal
    const removed = notifications.find(n => n.id === id)
    setNotifications(prev => prev.filter(n => n.id !== id))
    if (removed && !removed.read) setUnreadCount(prev => Math.max(0, prev - 1))
    try {
      await fetch(`/api/notifications?id=${id}`, { method: 'DELETE' })
    } catch {
      // If delete fails, re-fetch to restore accurate state
      fetchNotifications()
    }
  }

  const handleClickNotification = async (notification: Notification) => {
    if (!notification.read) {
      await markRead(notification.id)
    }
    if (notification.link) {
      router.push(notification.link)
    }
  }

  const filtered = filter === 'unread'
    ? notifications.filter(n => !n.read)
    : notifications

  const groups = groupNotifications(filtered)

  return (
    <div className="flex flex-col h-full">
      <Header title="Notifications" subtitle="SYSTEM ALERTS & ACTIVITY" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Filter tabs */}
          <div className="flex items-center gap-1 p-1 rounded-lg border border-cyan-400/10 bg-white/3">
            {(['all', 'unread'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={cn(
                  'px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize',
                  filter === tab
                    ? 'bg-cyan-400/15 text-cyan-400 border border-cyan-400/20'
                    : 'text-white/40 hover:text-white/70'
                )}
              >
                {tab}
                {tab === 'unread' && unreadCount > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 bg-cyan-400 text-black text-[10px] font-bold rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Mark all read */}
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-cyan-400/20 text-cyan-400 hover:bg-cyan-400/10 transition-all text-sm"
            >
              <CheckCheck size={14} />
              Mark all as read
            </button>
          )}
        </div>

        {/* Notification list */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-white/3 animate-pulse border border-white/5" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 rounded-full border border-cyan-400/20 flex items-center justify-center bg-cyan-400/5">
              <Bell size={28} className="text-cyan-400/40" />
            </div>
            <p className="text-white/40 text-sm nexus-mono">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {(Object.entries(groups) as [keyof GroupedNotifications, Notification[]][]).map(([label, items]) => {
              if (items.length === 0) return null
              return (
                <div key={label}>
                  <p className="text-white/25 text-[10px] uppercase tracking-[0.15em] nexus-mono mb-3 px-1">
                    {label}
                  </p>
                  <div className="space-y-2">
                    {items.map(notification => {
                      const typeStyles = getTypeStyles(notification.type)
                      const TypeIcon = typeStyles.icon
                      return (
                        <div
                          key={notification.id}
                          onClick={() => handleClickNotification(notification)}
                          className={cn(
                            'relative flex items-start gap-4 p-4 rounded-xl border border-white/5 border-l-2 transition-all cursor-pointer group',
                            typeStyles.border,
                            !notification.read && typeStyles.bg,
                            notification.read && 'opacity-60 hover:opacity-80',
                            notification.link && 'hover:border-white/10',
                            'hover:bg-white/3'
                          )}
                        >
                          {/* Type icon */}
                          <div className="flex-shrink-0 mt-0.5">
                            <TypeIcon size={16} className={typeStyles.iconColor} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className={cn(
                                'text-sm font-medium truncate',
                                notification.read ? 'text-white/60' : 'text-white'
                              )}>
                                {notification.title}
                              </p>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {/* Unread dot */}
                                {!notification.read && (
                                  <span className="w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0" />
                                )}
                                {/* Relative time */}
                                <span className="text-white/25 text-[11px] nexus-mono whitespace-nowrap">
                                  {formatDistanceToNow(parseISO(notification.createdAt), { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                            {notification.body && (
                              <p className="text-white/40 text-xs mt-1 line-clamp-2">
                                {notification.body}
                              </p>
                            )}
                          </div>

                          {/* Delete button */}
                          <button
                            onClick={(e) => deleteNotification(notification.id, e)}
                            className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-all"
                            title="Delete notification"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
