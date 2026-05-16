'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import {
  Gauge, Play, Loader2, AlertTriangle, Calendar, Bot, Bell,
  CheckCircle, ChevronRight, RefreshCw, Lightbulb, Zap, Brain,
  Info, Target,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface WorldState {
  timestamp: number
  overdueTasks: Array<{ id: string; title: string; dueDate: string; priority: string }>
  dueTodayTasks: Array<{ id: string; title: string; dueDate: string; priority: string }>
  upcomingEvents: Array<{ id: string; title: string; startTime: string; endTime: string }>
  pendingReminders: Array<{ id: string; title: string; dueAt: string; priority: string }>
  activeAgents: Array<{ id: string; task: string; status: string }>
  pendingApprovals: Array<{ id: string; task: string }>
  activeAutomations: Array<{ id: string; name: string }>
  goalProgress: Array<{ id: string; title: string; progress: number }>
  memoryCount: number
  unreadNotifications: Array<{ id: string; title: string }>
}

interface SimulationResult {
  result: string
  assumptions: string[]
  confidence: 'high' | 'medium' | 'low'
  type: string
  recommendation?: string
}

interface ProactiveAlert {
  id: string
  title: string
  body: string
  type: string
  createdAt: string
}

const PRESET_QUERIES = [
  'Can I finish my tasks by Friday?',
  'Estimate my workload this week',
  'What conflicts do I have upcoming?',
  'Am I on track with my goals?',
  'Compare my planned vs actual schedule',
]

function parsePriority(body: string): string {
  const match = body.match(/^\[([A-Z]+)\]/)
  if (!match) return 'medium'
  const p = match[1].toLowerCase()
  if (['critical', 'high', 'medium', 'low'].includes(p)) return p
  return 'medium'
}

function parseMessage(body: string): string {
  return body.replace(/^\[[A-Z]+\]\s*/, '')
}

function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  const styles = {
    high: 'text-green-400 bg-green-400/10 border-green-400/30',
    medium: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
    low: 'text-red-400 bg-red-400/10 border-red-400/30',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded border nexus-mono font-medium ${styles[confidence]}`}>
      {confidence.toUpperCase()} CONFIDENCE
    </span>
  )
}

export default function SimulatePage() {
  const [worldState, setWorldState] = useState<WorldState | null>(null)
  const [worldLoading, setWorldLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [simulating, setSimulating] = useState(false)
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [alerts, setAlerts] = useState<ProactiveAlert[]>([])
  const [alertsLoading, setAlertsLoading] = useState(true)
  const [refreshingInsights, setRefreshingInsights] = useState(false)

  const fetchWorldState = async () => {
    try {
      const res = await fetch('/api/world-state')
      if (res.ok) {
        const data = await res.json()
        setWorldState(data)
      }
    } catch {}
    setWorldLoading(false)
  }

  const fetchAlerts = async () => {
    try {
      const res = await fetch('/api/alerts/analyze')
      if (res.ok) {
        const data = await res.json()
        if (data.alerts) setAlerts(data.alerts.slice(0, 5))
      }
    } catch {}
    setAlertsLoading(false)
  }

  const refreshInsights = async () => {
    setRefreshingInsights(true)
    try {
      const res = await fetch('/api/alerts/analyze', { method: 'POST' })
      const data = await res.json()
      if (data.skipped) {
        toast('Analysis ran recently — check back in 30 min', { icon: '⏱' })
      } else {
        toast.success('Insights refreshed')
      }
      await fetchAlerts()
    } catch {
      toast.error('Failed to refresh insights')
    }
    setRefreshingInsights(false)
  }

  const runSimulation = async () => {
    if (!query.trim()) {
      toast.error('Enter a simulation query first')
      return
    }
    setSimulating(true)
    setResult(null)
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      })
      if (!res.ok) throw new Error('Simulation failed')
      const data = await res.json()
      setResult(data)
    } catch {
      toast.error('Simulation failed — try again')
    }
    setSimulating(false)
  }

  useEffect(() => {
    fetchWorldState()
    fetchAlerts()
  }, [])

  const todayEvents = worldState?.upcomingEvents.filter(e => {
    const d = new Date(e.startTime)
    const today = new Date()
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
  }) ?? []

  const getAlertIcon = (body: string) => {
    const priority = parsePriority(body)
    if (priority === 'critical') return <AlertTriangle size={14} className="text-red-400" />
    if (priority === 'high') return <Zap size={14} className="text-amber-400" />
    if (priority === 'medium') return <Bell size={14} className="text-cyan-400" />
    return <Info size={14} className="text-white/40" />
  }

  const getAlertBorder = (body: string) => {
    const priority = parsePriority(body)
    if (priority === 'critical') return 'border-red-400/30 bg-red-400/5'
    if (priority === 'high') return 'border-amber-400/30 bg-amber-400/5'
    if (priority === 'medium') return 'border-cyan-400/20 bg-cyan-400/5'
    return 'border-white/10 bg-white/3'
  }

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const m = Math.floor(diff / 60000)
    const h = Math.floor(diff / 3600000)
    if (h > 0) return `${h}h ago`
    return m < 1 ? 'just now' : `${m}m ago`
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="SIMULATION ENGINE" subtitle="Predictive planning & scenario analysis" />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-[1100px] mx-auto space-y-5">

          {/* World State Panel */}
          <div className="hud-stat-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <div className="hud-label">WORLD STATE // LIVE</div>
            </div>

            {worldLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="hud-panel rounded-xl p-4 h-20 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Overdue tasks */}
                <div className="hud-panel rounded-xl p-4 border border-red-400/20">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={13} className="text-red-400" />
                    <span className="hud-label" style={{ color: 'rgba(248,113,113,0.7)' }}>Overdue</span>
                  </div>
                  <div className="text-2xl font-bold text-red-400" style={{ textShadow: '0 0 8px rgba(248,113,113,0.6)' }}>
                    {worldState?.overdueTasks.length ?? 0}
                  </div>
                  <div className="text-white/30 text-xs mt-0.5">tasks past due</div>
                </div>

                {/* Events today */}
                <div className="hud-panel rounded-xl p-4 border border-cyan-400/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar size={13} className="text-cyan-400" />
                    <span className="hud-label">Events Today</span>
                  </div>
                  <div className="text-2xl font-bold hud-value">
                    {todayEvents.length}
                  </div>
                  <div className="text-white/30 text-xs mt-0.5">on calendar</div>
                </div>

                {/* Active agents */}
                <div className="hud-panel rounded-xl p-4 border border-violet-400/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Bot size={13} className="text-violet-400" />
                    <span className="hud-label" style={{ color: 'rgba(167,139,250,0.7)' }}>Agents</span>
                  </div>
                  <div className="text-2xl font-bold text-violet-400" style={{ textShadow: '0 0 8px rgba(167,139,250,0.6)' }}>
                    {worldState?.activeAgents.length ?? 0}
                  </div>
                  <div className="text-white/30 text-xs mt-0.5">running / pending</div>
                </div>

                {/* Pending reminders */}
                <div className="hud-panel rounded-xl p-4 border border-yellow-400/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Bell size={13} className="text-yellow-400" />
                    <span className="hud-label" style={{ color: 'rgba(250,204,21,0.7)' }}>Reminders</span>
                  </div>
                  <div className="text-2xl font-bold text-yellow-400" style={{ textShadow: '0 0 8px rgba(250,204,21,0.5)' }}>
                    {worldState?.pendingReminders.length ?? 0}
                  </div>
                  <div className="text-white/30 text-xs mt-0.5">due in 24h</div>
                </div>
              </div>
            )}

            {/* Additional world state details */}
            {worldState && (
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-white/40 nexus-mono">
                  {worldState.dueTodayTasks.length} due today
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-white/40 nexus-mono">
                  {worldState.goalProgress.length} active goals
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-white/40 nexus-mono">
                  {worldState.activeAutomations.length} automations
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-white/40 nexus-mono">
                  {worldState.memoryCount} memories
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-white/40 nexus-mono">
                  {worldState.unreadNotifications.length} unread notifications
                </span>
              </div>
            )}
          </div>

          {/* Two column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Simulation Input Panel */}
            <div className="hud-stat-card rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
                  <Gauge size={15} className="text-amber-400" />
                </div>
                <div>
                  <div className="hud-label">RUN SIMULATION</div>
                  <div className="text-white/30 text-xs">Ask NEXUS to predict or plan for any scenario</div>
                </div>
              </div>

              {/* Presets */}
              <div className="flex flex-wrap gap-1.5">
                {PRESET_QUERIES.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setQuery(preset)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white/80 hover:border-amber-400/30 hover:bg-amber-400/5 transition-all flex items-center gap-1"
                  >
                    <ChevronRight size={10} className="text-amber-400" />
                    {preset}
                  </button>
                ))}
              </div>

              {/* Query textarea */}
              <textarea
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Describe your scenario or question..."
                rows={4}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white/80 text-sm placeholder-white/20 focus:outline-none focus:border-amber-400/40 resize-none nexus-scrollbar transition-colors"
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    runSimulation()
                  }
                }}
              />

              <button
                onClick={runSimulation}
                disabled={simulating || !query.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-sm transition-all"
                style={{
                  background: simulating || !query.trim()
                    ? 'rgba(255,255,255,0.05)'
                    : 'linear-gradient(135deg, rgba(251,191,36,0.15) 0%, rgba(245,158,11,0.1) 100%)',
                  border: simulating || !query.trim()
                    ? '1px solid rgba(255,255,255,0.08)'
                    : '1px solid rgba(251,191,36,0.4)',
                  color: simulating || !query.trim() ? 'rgba(255,255,255,0.3)' : '#fbbf24',
                  boxShadow: simulating || !query.trim() ? 'none' : '0 0 16px rgba(251,191,36,0.1)',
                }}
              >
                {simulating ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Analyzing world state... Running simulation...
                  </>
                ) : (
                  <>
                    <Play size={15} />
                    EXECUTE SIMULATION
                  </>
                )}
              </button>
            </div>

            {/* Proactive Insights Panel */}
            <div className="hud-stat-card rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-400/10 border border-violet-400/20 flex items-center justify-center">
                    <Brain size={15} className="text-violet-400" />
                  </div>
                  <div>
                    <div className="hud-label" style={{ color: 'rgba(167,139,250,0.7)' }}>PROACTIVE INSIGHTS</div>
                    <div className="text-white/30 text-xs">AI-generated recommendations</div>
                  </div>
                </div>
                <button
                  onClick={refreshInsights}
                  disabled={refreshingInsights}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-violet-400/10 border border-violet-400/20 text-violet-400 hover:bg-violet-400/15 transition-all disabled:opacity-50"
                >
                  <RefreshCw size={11} className={refreshingInsights ? 'animate-spin' : ''} />
                  REFRESH INSIGHTS
                </button>
              </div>

              {alertsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="hud-panel rounded-xl p-3 h-14 animate-pulse" />
                  ))}
                </div>
              ) : alerts.length === 0 ? (
                <div className="hud-panel rounded-xl p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-green-400/10 border border-green-400/20 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle size={20} className="text-green-400" />
                  </div>
                  <p className="text-white/50 text-sm font-medium">All Clear</p>
                  <p className="text-white/25 text-xs mt-1">No proactive alerts. Click Refresh to analyze.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map(alert => {
                    const priority = parsePriority(alert.body)
                    const message = parseMessage(alert.body)
                    return (
                      <div
                        key={alert.id}
                        className={`hud-panel rounded-xl p-3 border ${getAlertBorder(alert.body)}`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5">{getAlertIcon(alert.body)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-white/80 text-xs font-medium">{alert.title}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded nexus-mono ${
                                priority === 'critical' ? 'text-red-400 bg-red-400/10' :
                                priority === 'high' ? 'text-amber-400 bg-amber-400/10' :
                                'text-cyan-400 bg-cyan-400/10'
                              }`}>
                                {priority.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-white/40 text-xs leading-relaxed">{message}</p>
                            <p className="text-white/20 text-[10px] mt-1 nexus-mono">{timeAgo(alert.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Simulation Results Panel */}
          {result && (
            <div className="hud-stat-card rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center">
                  <Target size={15} className="text-cyan-400" />
                </div>
                <div className="flex-1">
                  <div className="hud-label">SIMULATION RESULT</div>
                </div>
                <ConfidenceBadge confidence={result.confidence} />
                {result.type && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-white/30 nexus-mono uppercase">
                    {result.type}
                  </span>
                )}
              </div>

              {/* Result text */}
              <div className="hud-panel rounded-xl p-4 border border-cyan-400/20">
                <p className="text-white/80 text-sm leading-relaxed">{result.result}</p>
              </div>

              {/* Recommendation */}
              {result.recommendation && (
                <div className="hud-panel rounded-xl p-4 border border-amber-400/20 bg-amber-400/3">
                  <div className="flex items-start gap-2">
                    <Lightbulb size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="hud-label mb-1" style={{ color: 'rgba(251,191,36,0.7)' }}>RECOMMENDATION</div>
                      <p className="text-white/70 text-sm leading-relaxed">{result.recommendation}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Assumptions */}
              {result.assumptions && result.assumptions.length > 0 && (
                <div>
                  <div className="hud-label mb-2">ASSUMPTIONS</div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.assumptions.map((assumption, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/40"
                      >
                        {assumption}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
