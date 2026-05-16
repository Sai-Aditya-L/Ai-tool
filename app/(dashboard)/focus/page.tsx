'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { Timer, Play, Pause, RotateCcw, CheckSquare, Coffee, Brain, Zap, BarChart2, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SessionType {
  key: string
  label: string
  minutes: number
  icon: React.ReactNode
  color: string
}

interface FocusSession {
  id: string
  type: string
  taskTitle?: string
  plannedMins: number
  actualMins?: number
  completed: boolean
  createdAt: string
}

interface FocusStats {
  todaySessions: number
  todayMinutes: number
  weekSessions: number
  currentStreak: number
  weeklyData: number[]
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const SESSION_TYPES: SessionType[] = [
  { key: 'pomodoro',    label: 'Pomodoro',    minutes: 25, icon: <Timer size={14} />,  color: '#00e5ff' },
  { key: 'short_break', label: 'Short Break', minutes: 5,  icon: <Coffee size={14} />, color: '#4ade80' },
  { key: 'long_break',  label: 'Long Break',  minutes: 15, icon: <Zap size={14} />,    color: '#a78bfa' },
  { key: 'deep_work',   label: 'Deep Work',   minutes: 90, icon: <Brain size={14} />,  color: '#f59e0b' },
]

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function relativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ─── SVG Progress Ring ─────────────────────────────────────────────────────────

interface ProgressRingProps {
  progress: number   // 0..1
  timeLeft: number   // seconds, displayed in center
  color: string
}

function ProgressRing({ progress, timeLeft, color }: ProgressRingProps) {
  const radius = 80
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - Math.max(0, Math.min(1, progress)))

  return (
    <div className="relative flex items-center justify-center" style={{ width: 200, height: 200 }}>
      <svg width="200" height="200" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r={radius} fill="none" stroke="rgba(0,229,255,0.1)" strokeWidth="8" />
        <circle
          cx="100" cy="100" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 100 100)"
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="nexus-mono text-4xl font-bold tracking-widest"
          style={{ color }}
        >
          {formatTime(timeLeft)}
        </span>
      </div>
    </div>
  )
}

// ─── Weekly Chart ──────────────────────────────────────────────────────────────

function WeeklyChart({ data }: { data: number[] }) {
  const max = Math.max(...data, 1)
  const today = new Date().getDay()
  // Align: last entry = today
  const labels = Array.from({ length: 7 }, (_, i) => {
    const dayIdx = (today - 6 + i + 7) % 7
    return DAYS[dayIdx]
  })

  return (
    <div className="glass-panel rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 size={14} className="text-cyan-400" />
        <span className="text-white/60 text-xs font-medium uppercase tracking-widest">Weekly Sessions</span>
      </div>
      <div className="flex items-end gap-2 h-24">
        {data.map((val, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t-sm transition-all"
              style={{
                height: `${Math.max(4, (val / max) * 80)}px`,
                background: i === 6
                  ? 'rgba(0,229,255,0.6)'
                  : 'rgba(0,229,255,0.2)',
              }}
            />
            <span className="text-white/30 text-[10px] nexus-mono">{labels[i]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Session Row ───────────────────────────────────────────────────────────────

function SessionRow({ session }: { session: FocusSession }) {
  const typeInfo = SESSION_TYPES.find(t => t.key === session.type) ?? SESSION_TYPES[0]
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
      <div style={{ color: typeInfo.color }} className="flex-shrink-0">{typeInfo.icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-white/80 text-sm truncate">{session.taskTitle || typeInfo.label}</p>
        <p className="text-white/30 text-xs nexus-mono">{session.actualMins ?? session.plannedMins} min · {relativeDate(session.createdAt)}</p>
      </div>
      {session.completed ? (
        <span className="text-green-400 text-xs border border-green-400/30 bg-green-400/10 px-2 py-0.5 rounded-full">Done</span>
      ) : (
        <span className="text-white/30 text-xs border border-white/10 bg-white/5 px-2 py-0.5 rounded-full">Stopped</span>
      )}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function FocusPage() {
  const [selectedTypeIdx, setSelectedTypeIdx] = useState(0)
  const [timeLeft, setTimeLeft] = useState(SESSION_TYPES[0].minutes * 60)
  const [running, setRunning] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [sessions, setSessions] = useState<FocusSession[]>([])
  const [stats, setStats] = useState<FocusStats>({
    todaySessions: 0,
    todayMinutes: 0,
    weekSessions: 0,
    currentStreak: 0,
    weeklyData: [0, 0, 0, 0, 0, 0, 0],
  })
  const [loadingStats, setLoadingStats] = useState(true)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const selectedType = SESSION_TYPES[selectedTypeIdx]
  const selectedTypeRef = useRef(selectedType)

  // ── Fetch data ──────────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/focus?stats=1')
      if (!res.ok) return
      const data = await res.json()
      setStats(data)
    } catch { /* silent */ } finally {
      setLoadingStats(false)
    }
  }, [])

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/focus')
      if (!res.ok) return
      const data = await res.json()
      setSessions((data.sessions ?? []).slice(0, 10))
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    fetchStats()
    fetchSessions()
  }, [fetchStats, fetchSessions])

  // ── Keep selectedTypeRef in sync ────────────────────────────────────────────

  useEffect(() => {
    selectedTypeRef.current = selectedType
  }, [selectedType])

  // ── When type changes, reset timer (if not running) ─────────────────────────

  useEffect(() => {
    if (!running) {
      setTimeLeft(selectedType.minutes * 60)
      setElapsedSeconds(0)
    }
  }, [selectedTypeIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cleanup interval on unmount (and whenever running changes) ─────────────

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [running])

  // ── Timer complete ──────────────────────────────────────────────────────────

  const handleComplete = useCallback(async (sessionId: string | null, actualMins: number) => {
    if (!sessionId) return

    try {
      await fetch('/api/focus', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sessionId, completed: true, actualMins }),
      })
    } catch { /* silent */ }

    // Use ref to get the current session type label, avoiding stale closure
    const label = selectedTypeRef.current.label

    // Browser notification
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('NEXUS Focus', { body: `${label} session complete!` })
    }

    toast.success(`${label} complete!`, { icon: '🎯' })
    fetchStats()
    fetchSessions()
  }, [fetchStats, fetchSessions])

  // ── Start ───────────────────────────────────────────────────────────────────

  const handleStart = async () => {
    // Request notification permission
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }

    let sessionId = currentSessionId
    if (!sessionId) {
      try {
        const res = await fetch('/api/focus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: selectedType.key,
            plannedMins: selectedType.minutes,
            taskTitle: taskTitle.trim() || undefined,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          sessionId = data.session?.id ?? data.id ?? null
          setCurrentSessionId(sessionId)
        }
      } catch { /* silent */ }
    }

    setRunning(true)

    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!)
          setRunning(false)
          setElapsedSeconds(sel => {
            const actualMins = Math.ceil((sel + 1) / 60)
            handleComplete(sessionId, actualMins)
            return 0
          })
          setCurrentSessionId(null)
          setTimeLeft(selectedTypeRef.current.minutes * 60)
          return 0
        }
        return prev - 1
      })
      setElapsedSeconds(e => e + 1)
    }, 1000)
  }

  // ── Pause ───────────────────────────────────────────────────────────────────

  const handlePause = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setRunning(false)
  }

  // ── Reset ───────────────────────────────────────────────────────────────────

  const handleReset = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setRunning(false)

    if (currentSessionId && elapsedSeconds > 0) {
      try {
        await fetch('/api/focus', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: currentSessionId,
            completed: false,
            actualMins: Math.ceil(elapsedSeconds / 60),
          }),
        })
      } catch { /* silent */ }
      fetchSessions()
    }

    setCurrentSessionId(null)
    setTimeLeft(selectedType.minutes * 60)
    setElapsedSeconds(0)
  }

  const progress = timeLeft / (selectedType.minutes * 60)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="FOCUS TIMER" subtitle="Pomodoro & deep work sessions" />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Today Sessions', value: stats.todaySessions, icon: <Timer size={14} /> },
              { label: 'Today Minutes',  value: stats.todayMinutes,  icon: <CheckSquare size={14} /> },
              { label: 'Week Sessions',  value: stats.weekSessions,  icon: <BarChart2 size={14} /> },
              { label: 'Current Streak', value: `${stats.currentStreak}d`, icon: <Trophy size={14} /> },
            ].map(stat => (
              <div key={stat.label} className="glass-panel rounded-xl p-4">
                <div className="flex items-center gap-2 text-cyan-400/60 mb-2">
                  {stat.icon}
                  <span className="text-white/40 text-[10px] uppercase tracking-widest">{stat.label}</span>
                </div>
                <p className="nexus-mono text-2xl font-bold text-cyan-400">
                  {loadingStats ? '—' : stat.value}
                </p>
              </div>
            ))}
          </div>

          {/* Main Timer Section */}
          <div className="glass-panel rounded-2xl p-6 flex flex-col items-center gap-6">

            {/* Session type tabs */}
            <div className="flex flex-wrap gap-2 justify-center">
              {SESSION_TYPES.map((type, idx) => (
                <button
                  key={type.key}
                  onClick={() => { if (!running) setSelectedTypeIdx(idx) }}
                  disabled={running}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border',
                    selectedTypeIdx === idx
                      ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-400'
                      : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60',
                    running && selectedTypeIdx !== idx && 'opacity-30 cursor-not-allowed'
                  )}
                >
                  <span style={{ color: selectedTypeIdx === idx ? type.color : undefined }}>{type.icon}</span>
                  {type.label}
                  <span className="nexus-mono text-xs opacity-60">{type.minutes}m</span>
                </button>
              ))}
            </div>

            {/* Circular Timer */}
            <ProgressRing
              progress={progress}
              timeLeft={timeLeft}
              color={selectedType.color}
            />

            {/* Task input */}
            <input
              type="text"
              placeholder="What are you focusing on? (optional)"
              value={taskTitle}
              onChange={e => setTaskTitle(e.target.value)}
              disabled={running}
              className="nexus-input text-center max-w-sm"
            />

            {/* Controls */}
            <div className="flex items-center gap-3">
              {!running ? (
                <button
                  onClick={handleStart}
                  className="nexus-btn-primary flex items-center gap-2 text-sm"
                >
                  <Play size={16} />
                  {elapsedSeconds > 0 ? 'RESUME' : 'START'}
                </button>
              ) : (
                <button
                  onClick={handlePause}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium border border-yellow-400/40 bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20 transition-all text-sm"
                >
                  <Pause size={16} />
                  PAUSE
                </button>
              )}
              <button
                onClick={handleReset}
                className="nexus-btn-secondary flex items-center gap-2 text-sm"
              >
                <RotateCcw size={16} />
                RESET
              </button>
            </div>
          </div>

          {/* Recent Sessions + Weekly Chart */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Recent sessions */}
            <div className="glass-panel rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <CheckSquare size={14} className="text-cyan-400" />
                <span className="text-white/60 text-xs font-medium uppercase tracking-widest">Recent Sessions</span>
              </div>
              {sessions.length === 0 ? (
                <div className="text-center py-8">
                  <Timer size={32} className="text-white/20 mx-auto mb-2" />
                  <p className="text-white/30 text-sm">No sessions yet</p>
                  <p className="text-white/20 text-xs mt-1">Start your first session above</p>
                </div>
              ) : (
                <div>
                  {sessions.map(s => <SessionRow key={s.id} session={s} />)}
                </div>
              )}
            </div>

            {/* Weekly chart */}
            <WeeklyChart data={stats.weeklyData} />
          </div>

        </div>
      </div>
    </div>
  )
}
