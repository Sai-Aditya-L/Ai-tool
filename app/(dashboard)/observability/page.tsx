'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Filter,
  RefreshCw,
  Shield,
  XCircle,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/utils'
import Link from 'next/link'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SystemHealth {
  health: 'healthy' | 'degraded' | 'critical'
  agentFailures24h: number
  automationFailures24h: number
  activeAgentsCount: number
  integrations: { provider: string; status: string; connectedAt: string }[]
  recentErrors: { action: string; details: string; createdAt: string }[]
  taskStats: { pending: number; overdue: number }
  memoryCount: number
  unreadNotifications: number
  timestamp: number
}

interface ActivityEntry {
  id: string
  action: string
  entityType?: string
  entityId?: string
  details?: string
  createdAt: string
}

type FilterType = 'all' | 'tasks' | 'agents' | 'automations' | 'errors'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getActionDotColor(action: string): string {
  const a = action.toUpperCase()
  if (a.startsWith('TASK_')) return 'bg-green-400'
  if (a.startsWith('REMINDER_')) return 'bg-yellow-400'
  if (a.startsWith('NOTE_')) return 'bg-blue-400'
  if (a.startsWith('AGENT_')) return 'bg-violet-400'
  if (a.includes('ERROR')) return 'bg-red-400'
  if (a.startsWith('AUTOMATION_')) return 'bg-orange-400'
  return 'bg-white/40'
}

function getActionTextColor(action: string): string {
  const a = action.toUpperCase()
  if (a.startsWith('TASK_')) return 'text-green-400'
  if (a.startsWith('REMINDER_')) return 'text-yellow-400'
  if (a.startsWith('NOTE_')) return 'text-blue-400'
  if (a.startsWith('AGENT_')) return 'text-violet-400'
  if (a.includes('ERROR')) return 'text-red-400'
  if (a.startsWith('AUTOMATION_')) return 'text-orange-400'
  return 'text-white/40'
}

function matchesFilter(action: string, filter: FilterType): boolean {
  if (filter === 'all') return true
  const a = action.toUpperCase()
  if (filter === 'tasks') return a.startsWith('TASK_')
  if (filter === 'agents') return a.startsWith('AGENT_')
  if (filter === 'automations') return a.startsWith('AUTOMATION_')
  if (filter === 'errors') return a.includes('ERROR')
  return true
}

function getIntegrationStatusBadge(status: string) {
  if (status === 'connected') return 'bg-green-400/10 text-green-400 border border-green-400/30'
  if (status === 'error') return 'bg-orange-400/10 text-orange-400 border border-orange-400/30'
  return 'bg-white/5 text-white/40 border border-white/10'
}

function getIntegrationIcon(provider: string): string {
  const icons: Record<string, string> = {
    google: '🔵',
    github: '⚫',
    notion: '⬜',
    slack: '💜',
    spotify: '🟢',
    twitter: '🐦',
    discord: '🟣',
    linear: '🔷',
  }
  return icons[provider.toLowerCase()] ?? '🔗'
}

function groupLogsByDate(logs: ActivityEntry[]): Record<string, ActivityEntry[]> {
  const groups: Record<string, ActivityEntry[]> = {}
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  logs.forEach(log => {
    const d = new Date(log.createdAt)
    let key: string
    if (d.toDateString() === today.toDateString()) key = 'Today'
    else if (d.toDateString() === yesterday.toDateString()) key = 'Yesterday'
    else key = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    if (!groups[key]) groups[key] = []
    groups[key].push(log)
  })
  return groups
}

// ─── Health Badge ─────────────────────────────────────────────────────────────

function HealthBadge({ health }: { health: 'healthy' | 'degraded' | 'critical' }) {
  const cfg = {
    healthy: {
      label: 'HEALTHY',
      cls: 'bg-green-400/10 text-green-400 border border-green-400/30',
      dot: 'bg-green-400',
    },
    degraded: {
      label: 'DEGRADED',
      cls: 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/30',
      dot: 'bg-yellow-400',
    },
    critical: {
      label: 'CRITICAL',
      cls: 'bg-red-400/10 text-red-400 border border-red-400/30',
      dot: 'bg-red-400',
    },
  }[health]

  return (
    <span className={cn('inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium', cfg.cls)}>
      <span className={cn('w-2 h-2 rounded-full animate-pulse', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ObservabilityPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [healthLoading, setHealthLoading] = useState(true)

  const [logs, setLogs] = useState<ActivityEntry[]>([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [logsOffset, setLogsOffset] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  const [filter, setFilter] = useState<FilterType>('all')
  const [exporting, setExporting] = useState(false)

  // ── Fetch health ──────────────────────────────────────────────────────────

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/system-health')
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setHealth(data)
    } catch {
      // silently keep stale data
    } finally {
      setHealthLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHealth()
    const interval = setInterval(fetchHealth, 30_000)
    return () => clearInterval(interval)
  }, [fetchHealth])

  // ── Fetch activity logs ───────────────────────────────────────────────────

  const fetchLogs = useCallback(async (offset = 0, append = false) => {
    if (!append) setLogsLoading(true)
    else setLoadingMore(true)
    try {
      const res = await fetch(`/api/history?offset=${offset}`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      if (append) {
        setLogs(prev => [...prev, ...(data.logs || [])])
      } else {
        setLogs(data.logs || [])
      }
    } catch {
      toast.error('Failed to load activity history')
    } finally {
      setLogsLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    fetchLogs(0, false)
  }, [fetchLogs])

  function handleLoadMore() {
    const next = logsOffset + 200
    setLogsOffset(next)
    fetchLogs(next, true)
  }

  // ── Export ────────────────────────────────────────────────────────────────

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch('/api/export')
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `nexus-export-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Export downloaded')
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  // ── Filtered logs ─────────────────────────────────────────────────────────

  const filteredLogs = logs.filter(l => matchesFilter(l.action, filter))
  const grouped = groupLogsByDate(filteredLogs)

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="OBSERVABILITY"
        subtitle="Application health, activity history & data portability"
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-[1400px] mx-auto space-y-6">

          {/* ── Section A: Application Health ──────────────────────────────── */}
          <section className="space-y-4">
            {/* Section header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-cyan-400" />
                <span className="hud-label">APPLICATION HEALTH</span>
              </div>
              <div className="flex items-center gap-3">
                {health && <HealthBadge health={health.health} />}
                <button
                  onClick={fetchHealth}
                  className="text-white/40 hover:text-cyan-400 transition-colors"
                  title="Refresh"
                >
                  <RefreshCw size={13} />
                </button>
              </div>
            </div>

            {/* Stat cards row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Agent Failures 24h */}
              <div className="hud-stat-card rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="hud-label">Agent Failures (24h)</div>
                  <div className="w-8 h-8 rounded-lg bg-red-400/10 flex items-center justify-center">
                    <XCircle size={14} className="text-red-400" />
                  </div>
                </div>
                <div className={cn(
                  'text-3xl font-bold mb-1',
                  healthLoading ? 'text-white/20' :
                  health && health.agentFailures24h > 5 ? 'text-red-400' :
                  health && health.agentFailures24h > 0 ? 'text-yellow-400' : 'text-green-400'
                )}>
                  {healthLoading ? '--' : health?.agentFailures24h ?? 0}
                </div>
                <div className="text-white/40 text-xs">Last 24 hours</div>
              </div>

              {/* Active Agents */}
              <div className="hud-stat-card rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="hud-label">Active Agents</div>
                  <div className="w-8 h-8 rounded-lg bg-violet-400/10 flex items-center justify-center">
                    <Bot size={14} className="text-violet-400" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-violet-400 mb-1" style={{ textShadow: '0 0 8px rgba(167,139,250,0.6)' }}>
                  {healthLoading ? '--' : health?.activeAgentsCount ?? 0}
                </div>
                <div className="text-white/40 text-xs">Running / pending</div>
              </div>

              {/* Overdue Tasks */}
              <div className="hud-stat-card rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="hud-label">Overdue Tasks</div>
                  <div className="w-8 h-8 rounded-lg bg-orange-400/10 flex items-center justify-center">
                    <Clock size={14} className="text-orange-400" />
                  </div>
                </div>
                <div className={cn(
                  'text-3xl font-bold mb-1',
                  healthLoading ? 'text-white/20' :
                  health && (health.taskStats?.overdue ?? 0) > 0 ? 'text-orange-400' : 'text-green-400'
                )}>
                  {healthLoading ? '--' : health?.taskStats?.overdue ?? 0}
                </div>
                <div className="text-white/40 text-xs">Past due date</div>
              </div>

              {/* Unread Notifications */}
              <div className="hud-stat-card rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="hud-label">Unread Notifications</div>
                  <div className="w-8 h-8 rounded-lg bg-cyan-400/10 flex items-center justify-center">
                    <Activity size={14} className="text-cyan-400" />
                  </div>
                </div>
                <div className="text-3xl font-bold hud-value mb-1">
                  {healthLoading ? '--' : health?.unreadNotifications ?? 0}
                </div>
                <div className="text-white/40 text-xs">Awaiting review</div>
              </div>
            </div>

            {/* Integrations table + Recent errors row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Integrations status table */}
              <div className="hud-stat-card rounded-xl p-5">
                <div className="hud-label mb-4">INTEGRATIONS</div>
                {healthLoading ? (
                  <div className="text-white/30 text-sm">Loading...</div>
                ) : !health?.integrations?.length ? (
                  <div className="text-white/30 text-sm">No integrations configured.</div>
                ) : (
                  <div className="space-y-2">
                    {health.integrations.map(i => (
                      <div key={i.provider} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                        <div className="flex items-center gap-3">
                          <span className="text-base">{getIntegrationIcon(i.provider)}</span>
                          <div>
                            <div className="text-sm font-medium text-white/80 capitalize">{i.provider}</div>
                            <div className="text-xs text-white/30">
                              Since {new Date(i.connectedAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium capitalize', getIntegrationStatusBadge(i.status))}>
                          {i.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent errors */}
              <div className="hud-stat-card rounded-xl p-5">
                <div className="hud-label mb-4">RECENT ERRORS</div>
                {healthLoading ? (
                  <div className="text-white/30 text-sm">Loading...</div>
                ) : !health?.recentErrors?.length ? (
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <CheckCircle2 size={14} />
                    No recent errors detected
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {health.recentErrors.slice(0, 10).map((e, i) => (
                      <div key={i} className="py-2 border-b border-white/5 last:border-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-medium text-red-400">{e.action}</span>
                          <span className="text-xs text-white/30">{formatRelativeTime(e.createdAt)}</span>
                        </div>
                        {e.details && (
                          <div className="text-xs text-white/40 truncate">{e.details}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── Section B: Activity History ─────────────────────────────────── */}
          <section className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-cyan-400" />
                <span className="hud-label">ACTIVITY HISTORY</span>
              </div>

              {/* Filter buttons */}
              <div className="flex items-center gap-1">
                <Filter size={12} className="text-white/40 mr-1" />
                {(['all', 'tasks', 'agents', 'automations', 'errors'] as FilterType[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      'px-2.5 py-1 rounded text-xs font-medium transition-colors capitalize',
                      filter === f
                        ? 'bg-cyan-400/10 text-cyan-400 border border-cyan-400/30'
                        : 'text-white/40 hover:text-white/70'
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="hud-stat-card rounded-xl p-5">
              {logsLoading ? (
                <div className="flex items-center gap-2 text-white/40 text-sm py-8 justify-center">
                  <RefreshCw size={14} className="animate-spin" />
                  Loading activity...
                </div>
              ) : !filteredLogs.length ? (
                <div className="text-white/30 text-sm text-center py-8">No activity found.</div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(grouped).map(([date, entries]) => (
                    <div key={date}>
                      <div className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">{date}</div>
                      <div className="space-y-0">
                        {entries.map((entry, idx) => (
                          <div key={entry.id} className={cn(
                            'flex items-start gap-3 py-2.5',
                            idx < entries.length - 1 && 'border-b border-white/5'
                          )}>
                            {/* Timeline dot */}
                            <div className="flex flex-col items-center pt-1 flex-shrink-0">
                              <div className={cn('w-2 h-2 rounded-full', getActionDotColor(entry.action))} />
                            </div>
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className={cn('text-xs font-semibold', getActionTextColor(entry.action))}>
                                  {entry.action.replace(/_/g, ' ')}
                                </span>
                                <span className="text-xs text-white/30 flex-shrink-0">
                                  {formatRelativeTime(entry.createdAt)}
                                </span>
                              </div>
                              {entry.details && (
                                <div className="text-xs text-white/40 mt-0.5 truncate">{entry.details}</div>
                              )}
                              {entry.entityType && (
                                <div className="text-xs text-white/25 mt-0.5">
                                  {entry.entityType}
                                  {entry.entityId ? ` · ${entry.entityId.slice(0, 8)}…` : ''}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Load more */}
                  <div className="pt-2 text-center">
                    <button
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="px-4 py-2 rounded-lg text-xs font-medium text-white/50 hover:text-cyan-400 border border-white/10 hover:border-cyan-400/30 transition-all disabled:opacity-50"
                    >
                      {loadingMore ? 'Loading...' : 'Load more'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── Section C: Data Export ──────────────────────────────────────── */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Download size={14} className="text-cyan-400" />
              <span className="hud-label">DATA PORTABILITY</span>
            </div>

            <div className="hud-stat-card rounded-xl p-6 space-y-6">
              {/* Header */}
              <div>
                <h3 className="text-white/90 font-semibold text-base mb-1">Export Your NEXUS Data</h3>
                <p className="text-white/40 text-sm">
                  Export all your NEXUS data. Your data belongs to you.
                </p>
              </div>

              {/* Data counts from health if available */}
              {health && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Tasks', value: health.taskStats.pending, sub: 'pending' },
                    { label: 'Memories', value: health.memoryCount, sub: 'stored' },
                    { label: 'Agents', value: health.activeAgentsCount, sub: 'active' },
                    { label: 'Notifications', value: health.unreadNotifications, sub: 'unread' },
                  ].map(item => (
                    <div key={item.label} className="bg-white/5 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold hud-value">{item.value}</div>
                      <div className="text-xs text-white/40 mt-0.5">{item.label}</div>
                      <div className="text-xs text-white/25">{item.sub}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Data categories checklist */}
              <div>
                <div className="hud-label mb-3">INCLUDED IN EXPORT</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {[
                    'Tasks & Subtasks',
                    'Notes & Tags',
                    'Reminders',
                    'Memory',
                    'Goals & Milestones',
                    'Habits & Entries',
                    'Automations',
                    'Agents & Run History',
                    'Activity Logs (last 1000)',
                    'Notifications',
                  ].map(item => (
                    <div key={item} className="flex items-center gap-2 text-sm text-white/60">
                      <CheckCircle2 size={13} className="text-green-400 flex-shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Export button */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className={cn(
                    'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all',
                    'bg-cyan-400/10 text-cyan-400 border border-cyan-400/30',
                    'hover:bg-cyan-400/20 hover:border-cyan-400/50',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  <Download size={14} />
                  {exporting ? 'EXPORTING...' : 'EXPORT ALL DATA (JSON)'}
                </button>

                <Link
                  href="/trust-center"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-red-400/70 hover:text-red-400 border border-red-400/20 hover:border-red-400/40 transition-all"
                >
                  <Zap size={14} />
                  Request Data Deletion
                  <ExternalLink size={11} />
                </Link>
              </div>

              {/* Trust center note */}
              <div className="text-xs text-white/30 flex items-start gap-2 pt-1">
                <Shield size={11} className="mt-0.5 flex-shrink-0 text-white/20" />
                <span>
                  To delete your account data, visit{' '}
                  <Link href="/trust-center" className="text-cyan-400/60 hover:text-cyan-400 underline underline-offset-2">
                    Trust Center → Data Controls
                  </Link>
                  . Exported files do not contain your password or payment information.
                </span>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}
