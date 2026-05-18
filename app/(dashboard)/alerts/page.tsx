'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { Bell, Brain, Check, Loader2, AlertTriangle, Info, Zap, Calendar, Bot, X, CheckCheck, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface ProactiveAlert {
  id: string
  title: string
  body: string
  type: string
  createdAt: string
  read: boolean
}

interface WorldState {
  overdueTasks: Array<{ id: string }>
  dueTodayTasks: Array<{ id: string }>
  upcomingEvents: Array<{ id: string; startTime: string }>
  activeAgents: Array<{ id: string }>
  pendingReminders: Array<{ id: string }>
}

type PriorityFilter = 'all' | 'critical' | 'high' | 'medium'

function parsePriority(body: string): string {
  const match = body.match(/^\[([A-Z]+)\]/)
  if (!match) return 'medium'
  const p = match[1].toLowerCase()
  return ['critical', 'high', 'medium', 'low'].includes(p) ? p : 'medium'
}

function parseMessage(body: string): string {
  return body.replace(/^\[[A-Z]+\]\s*/, '')
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const PRIORITY_STYLES: Record<string, string> = {
  critical: 'text-red-400 border-red-400/30 bg-red-400/10',
  high: 'text-orange-400 border-orange-400/30 bg-orange-400/10',
  medium: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10',
  low: 'text-green-400 border-green-400/30 bg-green-400/10',
}

const PRIORITY_BORDER: Record<string, string> = {
  critical: 'border-l-red-500',
  high: 'border-l-orange-500',
  medium: 'border-l-yellow-500',
  low: 'border-l-green-500',
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  overdue: <AlertTriangle size={14} className="text-orange-400" />,
  reminder: <Bell size={14} className="text-yellow-400" />,
  calendar: <Calendar size={14} className="text-blue-400" />,
  agent: <Bot size={14} className="text-violet-400" />,
  system: <Shield size={14} className="text-cyan-400" />,
  proactive_alert: <Zap size={14} className="text-amber-400" />,
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<ProactiveAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [worldState, setWorldState] = useState<WorldState | null>(null)
  const [filter, setFilter] = useState<PriorityFilter>('all')
  const [dismissingId, setDismissingId] = useState<string | null>(null)

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts/analyze')
      const data = await res.json()
      if (data.alerts) setAlerts(data.alerts)
    } catch {
      toast.error('Failed to load alerts')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchWorldState = useCallback(async () => {
    try {
      const res = await fetch('/api/world-state')
      if (res.ok) setWorldState(await res.json())
    } catch {}
  }, [])

  useEffect(() => {
    fetchAlerts()
    fetchWorldState()
  }, [fetchAlerts, fetchWorldState])

  const runAnalysis = async () => {
    setAnalyzing(true)
    try {
      const res = await fetch('/api/alerts/analyze', { method: 'POST' })
      const data = await res.json()
      if (data.skipped) {
        toast('Analysis ran recently — check back in 30 min', { icon: '⏱️' })
      } else if (data.alerts?.length === 0) {
        toast.success('All clear! No urgent alerts detected.')
      } else {
        toast.success(`${data.alerts.length} new alert(s) generated`)
      }
      fetchAlerts()
      fetchWorldState()
    } catch {
      toast.error('Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  async function dismissAlert(id: string) {
    setDismissingId(id)
    try {
      await fetch(`/api/alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: true }),
      })
      setAlerts(prev => prev.filter(a => a.id !== id))
    } catch {
      toast.error('Failed to dismiss alert')
    } finally {
      setDismissingId(null)
    }
  }

  async function markAllRead() {
    try {
      await Promise.all(
        alerts.map(a =>
          fetch(`/api/alerts/${a.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ read: true }),
          })
        )
      )
      setAlerts([])
      toast.success('All alerts dismissed')
    } catch {
      toast.error('Failed to mark all read')
    }
  }

  const filteredAlerts = alerts.filter(a => {
    if (filter === 'all') return true
    return parsePriority(a.body) === filter
  })

  const criticalCount = alerts.filter(a => parsePriority(a.body) === 'critical').length
  const highCount = alerts.filter(a => parsePriority(a.body) === 'high').length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="NEXUS Alerts"
        subtitle={
          alerts.length > 0
            ? `${alerts.length} active alert${alerts.length !== 1 ? 's' : ''}`
            : 'No active alerts'
        }
      />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-4">

          {/* World State Summary Cards */}
          {worldState && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                {
                  label: 'Overdue Tasks',
                  value: worldState.overdueTasks?.length ?? 0,
                  color: 'text-red-400',
                  bg: 'border-red-400/15 bg-red-400/5',
                  icon: <AlertTriangle size={14} />,
                },
                {
                  label: 'Due Today',
                  value: worldState.dueTodayTasks?.length ?? 0,
                  color: 'text-orange-400',
                  bg: 'border-orange-400/15 bg-orange-400/5',
                  icon: <Calendar size={14} />,
                },
                {
                  label: 'Pending Reminders',
                  value: worldState.pendingReminders?.length ?? 0,
                  color: 'text-yellow-400',
                  bg: 'border-yellow-400/15 bg-yellow-400/5',
                  icon: <Bell size={14} />,
                },
                {
                  label: 'Active Agents',
                  value: worldState.activeAgents?.length ?? 0,
                  color: 'text-violet-400',
                  bg: 'border-violet-400/15 bg-violet-400/5',
                  icon: <Bot size={14} />,
                },
              ].map(card => (
                <div key={card.label} className={cn('rounded-xl border p-3 text-center', card.bg)}>
                  <div className={cn('flex items-center justify-center gap-1 mb-1', card.color)}>
                    {card.icon}
                  </div>
                  <div className={cn('text-2xl font-bold', card.color)}>{card.value}</div>
                  <div className="text-white/35 text-[10px] nexus-mono">{card.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={runAnalysis}
              disabled={analyzing}
              className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-cyan-400/30 bg-cyan-400/10 text-cyan-400 hover:bg-cyan-400/20 transition-all disabled:opacity-40"
            >
              {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
              {analyzing ? 'Analyzing…' : 'Run Analysis'}
            </button>
            {alerts.length > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-white/10 text-white/50 hover:text-white/70 hover:border-white/20 transition-all"
              >
                <CheckCheck size={14} />
                Dismiss All
              </button>
            )}
            {/* Priority filter tabs */}
            <div className="flex gap-1 ml-auto">
              {(['all', 'critical', 'high', 'medium'] as PriorityFilter[]).map(p => (
                <button
                  key={p}
                  onClick={() => setFilter(p)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs transition-all capitalize',
                    filter === p
                      ? 'bg-cyan-400/15 border border-cyan-400/30 text-cyan-400'
                      : 'text-white/40 border border-white/5 hover:border-white/15 hover:text-white/60'
                  )}
                >
                  {p}
                  {p === 'critical' && criticalCount > 0 && (
                    <span className="ml-1 text-red-400">({criticalCount})</span>
                  )}
                  {p === 'high' && highCount > 0 && (
                    <span className="ml-1 text-orange-400">({highCount})</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Alerts list */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="glass-panel rounded-2xl py-16 text-center">
              <CheckCheck size={40} className="text-green-400/30 mx-auto mb-3" />
              <p className="text-white/40 font-medium">
                {alerts.length === 0 ? 'No active alerts' : `No ${filter} alerts`}
              </p>
              <p className="text-white/25 text-sm mt-1">
                {alerts.length === 0
                  ? 'Run an analysis to check for issues that need your attention'
                  : 'Try a different filter above'}
              </p>
              {alerts.length === 0 && (
                <button
                  onClick={runAnalysis}
                  disabled={analyzing}
                  className="mt-4 flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-cyan-400/30 bg-cyan-400/10 text-cyan-400 hover:bg-cyan-400/20 transition-all disabled:opacity-40 mx-auto"
                >
                  {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
                  Analyze Now
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAlerts.map(alert => {
                const priority = parsePriority(alert.body)
                const message = parseMessage(alert.body)
                return (
                  <div
                    key={alert.id}
                    className={cn(
                      'glass-panel rounded-xl p-4 border-l-2 group transition-all',
                      PRIORITY_BORDER[priority] ?? 'border-l-white/20'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {TYPE_ICONS[alert.type] ?? <Info size={14} className="text-white/40" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-white/85 text-sm font-medium">{alert.title}</span>
                            <span
                              className={cn(
                                'ml-2 text-[10px] px-1.5 py-0.5 rounded-full border capitalize',
                                PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.medium
                              )}
                            >
                              {priority}
                            </span>
                          </div>
                          <button
                            onClick={() => dismissAlert(alert.id)}
                            disabled={dismissingId === alert.id}
                            className="text-white/20 hover:text-white/60 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100 p-0.5 disabled:opacity-40"
                            title="Dismiss"
                          >
                            {dismissingId === alert.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <X size={14} />
                            )}
                          </button>
                        </div>
                        <p className="text-white/55 text-sm mt-1">{message}</p>
                        <p className="text-white/25 text-xs mt-1.5">{timeAgo(alert.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
