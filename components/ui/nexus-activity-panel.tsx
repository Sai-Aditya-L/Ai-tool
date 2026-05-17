'use client'
import { useState, useEffect } from 'react'
import { X, Activity, Bell, Clock, Bot, CheckSquare, ChevronRight, Loader2 } from 'lucide-react'
import { useNexusLive } from '@/components/providers/nexus-live-provider'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface Reminder {
  id: string
  title: string
  dueAt: string
  priority?: string
}

interface Notification {
  id: string
  title: string
  body: string
  type: string
  read: boolean
  createdAt: string
}

interface AgentRun {
  id: string
  task: string
  status: string
  createdAt: string
}

export function NexusActivityPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { activeRun, activeFocus, unreadCount, latestNotification, connected } = useNexusLive()
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [recentRuns, setRecentRuns] = useState<AgentRun[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    Promise.all([
      fetch('/api/reminders').then(r => r.json()).catch(() => ({ reminders: [] })),
      fetch('/api/notifications?unreadOnly=true').then(r => r.json()).catch(() => ({ notifications: [] })),
      fetch('/api/agents/runs').then(r => r.json()).catch(() => ({ runs: [] })),
    ]).then(([rem, notif, runs]) => {
      setReminders((rem.reminders ?? []).slice(0, 5))
      setNotifications((notif.notifications ?? []).slice(0, 5))
      setRecentRuns((runs.runs ?? []).slice(0, 5))
    }).finally(() => setLoading(false))
  }, [open])

  // Refresh notifications when new one arrives via SSE
  useEffect(() => {
    if (!open || !latestNotification) return
    setNotifications(prev => {
      const exists = prev.some(n => n.id === latestNotification.id)
      if (exists) return prev
      return [{ ...latestNotification, read: false } as Notification, ...prev].slice(0, 5)
    })
  }, [latestNotification, open])

  const timeAgo = (str: string) => {
    const diff = Date.now() - new Date(str).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 60) return `${m}m`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h`
    return `${Math.floor(h / 24)}d`
  }

  const formatDue = (str: string) => {
    const d = new Date(str)
    const now = new Date()
    const diff = d.getTime() - now.getTime()
    if (diff < 0) return 'Overdue'
    if (diff < 3600000) return `${Math.ceil(diff / 60000)}m`
    if (diff < 86400000) return `${Math.ceil(diff / 3600000)}h`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const statusColor = (status: string) => {
    if (status === 'completed') return 'text-green-400'
    if (status === 'running') return 'text-violet-400'
    if (status === 'failed') return 'text-red-400'
    return 'text-yellow-400'
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div className={cn(
        'fixed top-0 right-0 h-full w-80 z-50 flex flex-col transition-transform duration-300 ease-in-out',
        'border-l border-cyan-400/10 bg-black/95 backdrop-blur-2xl',
        open ? 'translate-x-0' : 'translate-x-full'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Activity size={14} className={connected ? 'text-green-400' : 'text-yellow-400 animate-pulse'} />
            <span className="text-sm font-semibold text-white/80" style={{ letterSpacing: '0.06em' }}>NEXUS LIVE</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full nexus-mono ${connected ? 'bg-green-400/15 text-green-400' : 'bg-yellow-400/15 text-yellow-400'}`}>
              {connected ? 'ONLINE' : 'SYNC'}
            </span>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors p-1">
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Active Focus Session */}
          {activeFocus && (
            <div className="mx-3 mt-3 p-3 rounded-xl border border-amber-400/20 bg-amber-400/5">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-amber-400 text-xs font-medium nexus-mono">FOCUS ACTIVE</span>
              </div>
              <p className="text-white/70 text-xs truncate">{activeFocus.taskTitle || 'Deep work session'}</p>
              <p className="text-amber-400/60 text-[10px] mt-0.5">{activeFocus.plannedMins}min planned · {activeFocus.type}</p>
              <Link href="/focus" onClick={onClose} className="text-amber-400/60 text-[10px] hover:text-amber-400 mt-1 inline-flex items-center gap-1 transition-colors">
                View timer <ChevronRight size={10} />
              </Link>
            </div>
          )}

          {/* Active Agent Run */}
          {activeRun && (activeRun.status === 'running' || activeRun.status === 'waiting') && (
            <div className="mx-3 mt-3 p-3 rounded-xl border border-violet-400/20 bg-violet-400/5">
              <div className="flex items-center gap-2 mb-1.5">
                <Loader2 size={11} className="text-violet-400 animate-spin" />
                <span className="text-violet-400 text-xs font-medium nexus-mono">AGENT {activeRun.status.toUpperCase()}</span>
              </div>
              <p className="text-white/70 text-xs line-clamp-2">{activeRun.task}</p>
              <Link href="/agents" onClick={onClose} className="text-violet-400/60 text-[10px] hover:text-violet-400 mt-1 inline-flex items-center gap-1 transition-colors">
                View agents <ChevronRight size={10} />
              </Link>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="text-white/20 animate-spin" />
            </div>
          ) : (
            <>
              {/* Upcoming Reminders */}
              {reminders.length > 0 && (
                <div className="px-3 mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="hud-label text-[10px]">UPCOMING</span>
                    <Link href="/reminders" onClick={onClose} className="text-white/20 text-[10px] hover:text-cyan-400 transition-colors">See all</Link>
                  </div>
                  <div className="space-y-1.5">
                    {reminders.map(r => {
                      const due = formatDue(r.dueAt)
                      const overdue = due === 'Overdue'
                      return (
                        <div key={r.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-white/3 border border-white/5 hover:border-white/10 transition-colors">
                          <Clock size={11} className={overdue ? 'text-red-400 flex-shrink-0' : 'text-cyan-400/60 flex-shrink-0'} />
                          <span className="text-white/65 text-xs truncate flex-1">{r.title}</span>
                          <span className={`text-[10px] nexus-mono flex-shrink-0 ${overdue ? 'text-red-400' : 'text-cyan-400/50'}`}>{due}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Recent Notifications */}
              {notifications.length > 0 && (
                <div className="px-3 mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="hud-label text-[10px]">NOTIFICATIONS {unreadCount > 0 && <span className="text-cyan-400">({unreadCount})</span>}</span>
                    <Link href="/notifications" onClick={onClose} className="text-white/20 text-[10px] hover:text-cyan-400 transition-colors">See all</Link>
                  </div>
                  <div className="space-y-1.5">
                    {notifications.map(n => (
                      <div key={n.id} className={cn(
                        'p-2 rounded-lg border transition-colors',
                        n.read ? 'bg-white/2 border-white/5' : 'bg-cyan-400/3 border-cyan-400/10'
                      )}>
                        <div className="flex items-start gap-2">
                          <Bell size={10} className={n.read ? 'text-white/25 flex-shrink-0 mt-0.5' : 'text-cyan-400/70 flex-shrink-0 mt-0.5'} />
                          <div className="flex-1 min-w-0">
                            <p className="text-white/70 text-xs font-medium truncate">{n.title}</p>
                            <p className="text-white/35 text-[10px] truncate">{n.body}</p>
                          </div>
                          <span className="text-white/20 text-[10px] nexus-mono flex-shrink-0">{timeAgo(n.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Agent Runs */}
              {recentRuns.length > 0 && (
                <div className="px-3 mt-4 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="hud-label text-[10px]">RECENT AGENTS</span>
                    <Link href="/agents" onClick={onClose} className="text-white/20 text-[10px] hover:text-cyan-400 transition-colors">See all</Link>
                  </div>
                  <div className="space-y-1.5">
                    {recentRuns.map(run => (
                      <div key={run.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-white/3 border border-white/5">
                        <Bot size={11} className="text-violet-400/60 flex-shrink-0" />
                        <span className="text-white/60 text-xs truncate flex-1">{run.task}</span>
                        <span className={cn('text-[10px] nexus-mono flex-shrink-0', statusColor(run.status))}>
                          {run.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {reminders.length === 0 && notifications.length === 0 && recentRuns.length === 0 && !activeRun && !activeFocus && (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <CheckSquare size={28} className="text-white/10 mb-3" />
                  <p className="text-white/25 text-sm">All clear</p>
                  <p className="text-white/15 text-xs mt-1">NEXUS has nothing to report</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/5">
          <Link
            href="/notifications"
            onClick={onClose}
            className="flex items-center justify-center gap-2 w-full py-2 rounded-lg text-white/30 text-xs hover:text-cyan-400 hover:bg-cyan-400/5 transition-all border border-transparent hover:border-cyan-400/15"
          >
            View all notifications
          </Link>
        </div>
      </div>
    </>
  )
}
