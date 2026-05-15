'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { Plus, Trash2, Check, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface HabitEntry {
  date: string
  completed: boolean
}

interface HabitWithStats {
  id: string
  title: string
  description?: string
  color: string
  frequency: string
  status: string
  createdAt: string
  currentStreak: number
  longestStreak: number
  completionRate: number
  completedToday: boolean
  entries: HabitEntry[]
}

const PRESET_COLORS = [
  { value: '#00e5ff', label: 'Cyan' },
  { value: '#7b61ff', label: 'Purple' },
  { value: '#ff9800', label: 'Orange' },
  { value: '#4caf50', label: 'Green' },
  { value: '#f44336', label: 'Red' },
  { value: '#e91e63', label: 'Pink' },
]

function getLast7Days(): string[] {
  const days: string[] = []
  const today = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().split('T')[0])
  }
  return days
}

function completedOnDate(habit: HabitWithStats, date: string): boolean {
  return habit.entries.some(e => e.date === date && e.completed)
}

export default function HabitsPage() {
  const [habits, setHabits] = useState<HabitWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newHabit, setNewHabit] = useState({ title: '', color: '#00e5ff' })
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const last7Days = getLast7Days()

  const loadHabits = useCallback(async () => {
    try {
      const res = await fetch('/api/habits')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setHabits(data.habits)
    } catch {
      toast.error('Failed to load habits')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadHabits()
  }, [loadHabits])

  async function toggleToday(habitId: string) {
    await fetch(`/api/habits/${habitId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle', date: new Date().toISOString().split('T')[0] }),
    })
    loadHabits()
  }

  async function handleAddHabit(e: React.FormEvent) {
    e.preventDefault()
    if (!newHabit.title.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newHabit.title.trim(), color: newHabit.color }),
      })
      if (!res.ok) throw new Error()
      toast.success('Habit created!')
      setNewHabit({ title: '', color: '#00e5ff' })
      setShowAddForm(false)
      loadHabits()
    } catch {
      toast.error('Failed to create habit')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(habitId: string) {
    setDeletingId(habitId)
    try {
      const res = await fetch(`/api/habits/${habitId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Habit deleted')
      setHabits(prev => prev.filter(h => h.id !== habitId))
    } catch {
      toast.error('Failed to delete habit')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="HABIT TRACKER" subtitle="Build consistency, track streaks" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="text-white/40 text-sm">
            {habits.length} active habit{habits.length !== 1 ? 's' : ''}
          </div>
          <button
            onClick={() => setShowAddForm(prev => !prev)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              showAddForm
                ? 'bg-white/10 text-white/60'
                : 'bg-cyan-400/20 text-cyan-400 border border-cyan-400/30 hover:bg-cyan-400/30'
            )}
          >
            <Plus size={16} />
            {showAddForm ? 'Cancel' : 'Add Habit'}
          </button>
        </div>

        {/* Add Habit inline form */}
        {showAddForm && (
          <div className="hud-stat-card rounded-xl p-5 border border-cyan-400/20">
            <h3 className="text-white/80 font-semibold mb-4 text-sm uppercase tracking-wider">New Habit</h3>
            <form onSubmit={handleAddHabit} className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Habit title (e.g. Meditate, Exercise, Read)"
                  value={newHabit.title}
                  onChange={e => setNewHabit(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-cyan-400/50 focus:bg-white/8 transition-all"
                  autoFocus
                  maxLength={200}
                />
              </div>

              {/* Color picker */}
              <div>
                <p className="text-white/40 text-xs mb-2">Color</p>
                <div className="flex gap-2">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setNewHabit(prev => ({ ...prev, color: c.value }))}
                      className={cn(
                        'w-8 h-8 rounded-full border-2 transition-all',
                        newHabit.color === c.value
                          ? 'border-white scale-110'
                          : 'border-transparent opacity-60 hover:opacity-90 hover:scale-105'
                      )}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setNewHabit({ title: '', color: '#00e5ff' }) }}
                  className="px-4 py-2 text-sm text-white/40 hover:text-white/60 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !newHabit.title.trim()}
                  className="px-5 py-2 bg-cyan-400/20 text-cyan-400 border border-cyan-400/30 rounded-lg text-sm font-medium hover:bg-cyan-400/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {submitting ? 'Creating...' : 'Create Habit'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="text-white/30 text-sm">Loading habits...</div>
          </div>
        )}

        {/* Empty state */}
        {!loading && habits.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Flame size={40} className="text-white/10" />
            <div className="text-white/40 text-sm text-center">
              No habits yet. Start building your streak!
            </div>
            {!showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-400/20 text-cyan-400 border border-cyan-400/30 rounded-lg text-sm font-medium hover:bg-cyan-400/30 transition-all"
              >
                <Plus size={16} />
                Add your first habit
              </button>
            )}
          </div>
        )}

        {/* Habit cards grid */}
        {!loading && habits.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {habits.map(habit => (
              <div
                key={habit.id}
                className="hud-stat-card rounded-xl p-5 border-l-4 relative group"
                style={{ borderLeftColor: habit.color }}
              >
                {/* Delete button */}
                <button
                  onClick={() => handleDelete(habit.id)}
                  disabled={deletingId === habit.id}
                  className="absolute top-3 right-3 w-7 h-7 rounded-md flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-40"
                  title="Delete habit"
                >
                  <Trash2 size={13} />
                </button>

                {/* Header row */}
                <div className="flex items-start justify-between mb-3 pr-6">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white/90 truncate">{habit.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-2xl font-bold hud-text-cyan" style={{ color: habit.color }}>
                        {habit.currentStreak}
                      </span>
                      <span className="text-white/40 text-xs">day streak 🔥</span>
                    </div>
                  </div>

                  {/* Today toggle button */}
                  <button
                    onClick={() => toggleToday(habit.id)}
                    className={cn(
                      'w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ml-3',
                      habit.completedToday
                        ? 'border-cyan-400 bg-cyan-400/20 text-cyan-400'
                        : 'border-white/20 text-white/30 hover:border-cyan-400/50 hover:text-white/50'
                    )}
                    style={habit.completedToday ? { borderColor: habit.color, color: habit.color, backgroundColor: `${habit.color}22` } : {}}
                    title={habit.completedToday ? 'Mark incomplete' : 'Mark complete for today'}
                  >
                    <Check size={16} />
                  </button>
                </div>

                {/* Last 7 days mini dots */}
                <div className="flex gap-1.5 mb-3">
                  {last7Days.map(date => {
                    const done = completedOnDate(habit, date)
                    return (
                      <div
                        key={date}
                        className={cn(
                          'w-7 h-7 rounded-md flex items-center justify-center text-[9px]',
                          done ? 'text-cyan-400' : 'bg-white/5 text-white/30'
                        )}
                        style={done ? { backgroundColor: `${habit.color}33`, color: habit.color } : {}}
                        title={date}
                      >
                        {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)}
                      </div>
                    )
                  })}
                </div>

                {/* Stats row */}
                <div className="flex gap-4 text-xs text-white/40">
                  <span>Best: <span className="text-white/60">{habit.longestStreak}d</span></span>
                  <span>30d: <span className="text-white/60">{Math.round(habit.completionRate * 100)}%</span></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
