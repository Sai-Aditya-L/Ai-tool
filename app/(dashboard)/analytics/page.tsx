'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { BarChart2, Target, Zap, BookOpen, Clock, Flame, Trophy, TrendingUp, RefreshCw, Brain, AlertTriangle, Lightbulb, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProductivityData {
  score: number
  breakdown: { tasks: number; focus: number; habits: number; notes: number }
  today: { tasksCompleted: number; focusSessions: number; focusMinutes: number; habitsCompleted: number; habitsTotal: number; notes: number }
  week: { tasksCompleted: number; focusSessions: number }
  streak: number
  dailyScores: Array<{ date: string; label: string; tasks: number; focus: number; score: number }>
}

interface WeeklyReview {
  review: string
  stats: {
    tasksCompleted: number; tasksCreated: number; focusSessions: number
    focusHours: number; notesCreated: number; habitsLogged: number
    achievementsEarned: number; goalsActive: number; goalsCompleted: number
    completionRate: number
  }
  generatedAt: string
  cached: boolean
}

interface AIInsights {
  bestFocusDay: string
  bestTaskDay: string
  bestHour: string
  taskTrend: number
  focusTrend: number
  overdueTasks: number
  habitConsistency: number
  totalFocusMins28d: number
  totalTasksDone28d: number
  patterns: string[]
  recommendations: string[]
  riskFlag: string | null
  momentum: 'positive' | 'neutral' | 'negative'
}

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const r = (size - 16) / 2
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 80 ? '#00e5ff' : score >= 50 ? '#fbbf24' : '#f87171'

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={8}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease', filter: `drop-shadow(0 0 6px ${color})` }}
      />
    </svg>
  )
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="hud-stat-card rounded-xl p-4 flex items-center gap-4">
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', `bg-current/10`)} style={{ color }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="hud-label text-xs mb-0.5">{label}</p>
        <p className="text-white font-bold text-xl leading-none">{value}</p>
        {sub && <p className="text-white/40 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const [productivity, setProductivity] = useState<ProductivityData | null>(null)
  const [weeklyReview, setWeeklyReview] = useState<WeeklyReview | null>(null)
  const [insights, setInsights] = useState<AIInsights | null>(null)
  const [loadingProd, setLoadingProd] = useState(true)
  const [loadingReview, setLoadingReview] = useState(true)
  const [loadingInsights, setLoadingInsights] = useState(true)
  const [reviewError, setReviewError] = useState('')

  const loadProductivity = useCallback(async () => {
    setLoadingProd(true)
    try {
      const res = await fetch('/api/analytics/productivity')
      if (res.ok) setProductivity(await res.json())
    } catch {}
    setLoadingProd(false)
  }, [])

  const loadWeeklyReview = useCallback(async () => {
    setLoadingReview(true)
    setReviewError('')
    try {
      const res = await fetch('/api/analytics/weekly-review')
      if (res.ok) setWeeklyReview(await res.json())
      else setReviewError('Failed to generate review')
    } catch {
      setReviewError('Failed to generate review')
    }
    setLoadingReview(false)
  }, [])

  const loadInsights = useCallback(async () => {
    setLoadingInsights(true)
    try {
      const res = await fetch('/api/analytics/insights')
      if (res.ok) {
        const data = await res.json()
        setInsights(data.insights)
      }
    } catch {}
    setLoadingInsights(false)
  }, [])

  useEffect(() => {
    loadProductivity()
    loadWeeklyReview()
    loadInsights()
  }, [loadProductivity, loadWeeklyReview, loadInsights])

  const maxDayScore = Math.max(...(productivity?.dailyScores.map(d => d.score) ?? [1]), 1)

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#000810' }}>
      <Header title="Analytics" subtitle="Productivity intelligence & insights" />
      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
        <div className="flex flex-col gap-6">

          {/* Score + Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Score Ring */}
            <div className="hud-stat-card rounded-xl p-6 flex flex-col items-center gap-3">
              <p className="hud-label text-xs tracking-widest">TODAY'S SCORE</p>
              <div className="relative">
                <ScoreRing score={productivity?.score ?? 0} size={140} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-white font-bold text-3xl">{productivity?.score ?? '--'}</span>
                  <span className="text-white/40 text-xs">/ 100</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Flame size={14} className="text-orange-400" />
                <span className="text-white/70 text-sm">{productivity?.streak ?? 0} day streak</span>
              </div>
            </div>

            {/* Breakdown */}
            <div className="hud-stat-card rounded-xl p-6 lg:col-span-2">
              <p className="hud-label text-xs mb-4">SCORE BREAKDOWN</p>
              <div className="space-y-3">
                {[
                  { label: 'Tasks', value: productivity?.breakdown.tasks ?? 0, max: 40, color: '#00e5ff' },
                  { label: 'Focus', value: productivity?.breakdown.focus ?? 0, max: 25, color: '#a78bfa' },
                  { label: 'Habits', value: productivity?.breakdown.habits ?? 0, max: 25, color: '#fb923c' },
                  { label: 'Notes', value: productivity?.breakdown.notes ?? 0, max: 10, color: '#34d399' },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-white/60">{item.label}</span>
                      <span style={{ color: item.color }}>{item.value}/{item.max}</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${(item.value / item.max) * 100}%`, background: item.color, boxShadow: `0 0 8px ${item.color}` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Today's Stats */}
          <div>
            <p className="hud-label text-xs mb-3">TODAY AT A GLANCE</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard icon={Target} label="TASKS DONE" value={productivity?.today.tasksCompleted ?? '--'} color="#00e5ff" />
              <StatCard icon={Clock} label="FOCUS SESSIONS" value={productivity?.today.focusSessions ?? '--'} sub={`${productivity?.today.focusMinutes ?? 0} min`} color="#a78bfa" />
              <StatCard icon={Flame} label="HABITS" value={`${productivity?.today.habitsCompleted ?? 0}/${productivity?.today.habitsTotal ?? 0}`} color="#fb923c" />
              <StatCard icon={BookOpen} label="NOTES" value={productivity?.today.notes ?? '--'} color="#34d399" />
              <StatCard icon={BarChart2} label="WEEK TASKS" value={productivity?.week.tasksCompleted ?? '--'} color="#fbbf24" />
              <StatCard icon={Zap} label="WEEK FOCUS" value={productivity?.week.focusSessions ?? '--'} sub="sessions" color="#f472b6" />
            </div>
          </div>

          {/* 7-Day Bar Chart */}
          <div className="hud-stat-card rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="hud-label text-xs">7-DAY ACTIVITY</p>
              <button onClick={loadProductivity} className="text-white/30 hover:text-cyan-400 transition-colors">
                <RefreshCw size={14} className={loadingProd ? 'animate-spin' : ''} />
              </button>
            </div>
            <div className="flex items-end gap-2 h-32">
              {(productivity?.dailyScores ?? Array(7).fill({ label: '...', score: 0, tasks: 0, focus: 0 })).map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className="w-full rounded-t transition-all duration-700 relative group"
                      style={{
                        height: `${Math.max(4, (day.score / maxDayScore) * 100)}%`,
                        background: 'linear-gradient(to top, rgba(0,229,255,0.6), rgba(0,229,255,0.2))',
                        boxShadow: day.score > 0 ? '0 0 8px rgba(0,229,255,0.3)' : 'none',
                      }}
                    >
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/80 text-cyan-400 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        {day.score}pts · {day.tasks}t {day.focus}f
                      </div>
                    </div>
                  </div>
                  <span className="text-white/30 text-xs">{day.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Pattern Intelligence */}
          <div className="hud-stat-card rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Brain size={16} className="text-violet-400" />
                <p className="hud-label text-xs">PATTERN INTELLIGENCE</p>
                <span className="text-[10px] text-violet-400/50 bg-violet-400/10 px-1.5 py-0.5 rounded nexus-mono">28-day analysis</span>
              </div>
              <button onClick={loadInsights} className="text-white/30 hover:text-violet-400 transition-colors">
                <RefreshCw size={14} className={loadingInsights ? 'animate-spin' : ''} />
              </button>
            </div>

            {loadingInsights ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-4 bg-white/5 rounded animate-pulse" style={{ width: `${60 + i * 15}%` }} />)}
              </div>
            ) : insights ? (
              <div className="space-y-4">
                {/* Momentum + Quick Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="hud-panel rounded-lg p-3 border border-white/5 text-center">
                    <p className={cn('font-bold text-lg', insights.momentum === 'positive' ? 'text-green-400' : insights.momentum === 'negative' ? 'text-red-400' : 'text-white/60')}>
                      {insights.momentum === 'positive' ? '↑' : insights.momentum === 'negative' ? '↓' : '→'}
                    </p>
                    <p className="text-white/40 text-xs capitalize">{insights.momentum}</p>
                  </div>
                  <div className="hud-panel rounded-lg p-3 border border-white/5 text-center">
                    <p className="font-bold text-lg text-cyan-400">{insights.bestFocusDay}</p>
                    <p className="text-white/40 text-xs">Peak Focus Day</p>
                  </div>
                  <div className="hud-panel rounded-lg p-3 border border-white/5 text-center">
                    <p className="font-bold text-lg text-amber-400">{insights.bestHour}</p>
                    <p className="text-white/40 text-xs">Peak Hour</p>
                  </div>
                  <div className="hud-panel rounded-lg p-3 border border-white/5 text-center">
                    <p className="font-bold text-lg text-orange-400">{insights.habitConsistency}%</p>
                    <p className="text-white/40 text-xs">Habit Consistency</p>
                  </div>
                </div>

                {/* Trend pills */}
                <div className="flex flex-wrap gap-2">
                  <span className={cn('text-xs px-2.5 py-1 rounded-full border nexus-mono', insights.taskTrend >= 0 ? 'border-green-400/30 text-green-400 bg-green-400/5' : 'border-red-400/30 text-red-400 bg-red-400/5')}>
                    Tasks {insights.taskTrend >= 0 ? '+' : ''}{insights.taskTrend}% WoW
                  </span>
                  <span className={cn('text-xs px-2.5 py-1 rounded-full border nexus-mono', insights.focusTrend >= 0 ? 'border-cyan-400/30 text-cyan-400 bg-cyan-400/5' : 'border-red-400/30 text-red-400 bg-red-400/5')}>
                    Focus {insights.focusTrend >= 0 ? '+' : ''}{insights.focusTrend}% WoW
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-full border border-white/10 text-white/50 nexus-mono">
                    {Math.round(insights.totalFocusMins28d / 60 * 10) / 10}h focus · {insights.totalTasksDone28d} tasks (28d)
                  </span>
                </div>

                {/* Risk flag */}
                {insights.riskFlag && (
                  <div className="flex items-start gap-2 bg-red-400/5 border border-red-400/20 rounded-lg px-3 py-2.5">
                    <AlertTriangle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-red-300/80 text-xs">{insights.riskFlag}</p>
                  </div>
                )}

                {/* Patterns */}
                {insights.patterns?.length > 0 && (
                  <div>
                    <p className="text-white/30 text-xs uppercase tracking-wider mb-2">Detected Patterns</p>
                    <div className="space-y-1.5">
                      {insights.patterns.map((p, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <Brain size={11} className="text-violet-400 flex-shrink-0 mt-0.5" />
                          <p className="text-white/65 text-xs">{p}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {insights.recommendations?.length > 0 && (
                  <div>
                    <p className="text-white/30 text-xs uppercase tracking-wider mb-2">NEXUS Recommendations</p>
                    <div className="space-y-1.5">
                      {insights.recommendations.map((r, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <Lightbulb size={11} className="text-amber-400 flex-shrink-0 mt-0.5" />
                          <p className="text-white/65 text-xs">{r}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-white/30 text-sm">No pattern data yet — use NEXUS for a few weeks to unlock insights.</p>
            )}
          </div>

          {/* Weekly AI Review */}
          <div className="hud-stat-card rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Brain size={16} className="text-violet-400" />
                <p className="hud-label text-xs">WEEKLY REVIEW</p>
                {weeklyReview?.cached && <span className="text-white/30 text-xs">(cached)</span>}
              </div>
              <button onClick={loadWeeklyReview} className="text-white/30 hover:text-violet-400 transition-colors">
                <RefreshCw size={14} className={loadingReview ? 'animate-spin' : ''} />
              </button>
            </div>

            {loadingReview ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-4 bg-white/5 rounded animate-pulse" style={{ width: `${70 + i * 10}%` }} />)}
              </div>
            ) : reviewError ? (
              <p className="text-red-400/70 text-sm">{reviewError}</p>
            ) : weeklyReview ? (
              <div className="space-y-4">
                <p className="text-white/80 text-sm leading-relaxed">{weeklyReview.review}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/5">
                  <div className="text-center">
                    <p className="text-cyan-400 font-bold text-lg">{weeklyReview.stats.tasksCompleted}</p>
                    <p className="text-white/40 text-xs">Tasks Done</p>
                  </div>
                  <div className="text-center">
                    <p className="text-violet-400 font-bold text-lg">{weeklyReview.stats.focusHours}h</p>
                    <p className="text-white/40 text-xs">Focus Time</p>
                  </div>
                  <div className="text-center">
                    <p className="text-orange-400 font-bold text-lg">{weeklyReview.stats.habitsLogged}</p>
                    <p className="text-white/40 text-xs">Habits Logged</p>
                  </div>
                  <div className="text-center">
                    <p className="text-green-400 font-bold text-lg">{weeklyReview.stats.completionRate}%</p>
                    <p className="text-white/40 text-xs">Completion Rate</p>
                  </div>
                </div>
                <p className="text-white/20 text-xs">Generated {new Date(weeklyReview.generatedAt).toLocaleString()}</p>
              </div>
            ) : null}
          </div>

        </div>
      </main>
    </div>
  )
}
