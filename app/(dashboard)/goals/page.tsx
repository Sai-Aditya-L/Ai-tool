'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import {
  Target,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronUp,
  Calendar,
  TrendingUp,
  Flag,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Milestone {
  id: string
  title: string
  description?: string
  dueDate?: string
  completed: boolean
  order: number
}

interface Goal {
  id: string
  title: string
  description?: string
  category: string
  status: string
  targetDate?: string
  progress: number
  priority: string
  tags?: string
  notes?: string
  createdAt: string
  milestones: Milestone[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'all',
  'personal',
  'career',
  'fitness',
  'financial',
  'learning',
  'travel',
  'project',
  'habit',
]

const CATEGORY_COLORS: Record<string, string> = {
  personal: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30',
  career: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  fitness: 'text-green-400 bg-green-400/10 border-green-400/30',
  financial: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  learning: 'text-violet-400 bg-violet-400/10 border-violet-400/30',
  travel: 'text-sky-400 bg-sky-400/10 border-sky-400/30',
  project: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
  habit: 'text-pink-400 bg-pink-400/10 border-pink-400/30',
}

const CATEGORY_ACCENT: Record<string, string> = {
  personal: '#00e5ff',
  career: '#60a5fa',
  fitness: '#4ade80',
  financial: '#fbbf24',
  learning: '#a78bfa',
  travel: '#38bdf8',
  project: '#fb923c',
  habit: '#f472b6',
}

const PRIORITY_DOT: Record<string, string> = {
  low: 'bg-white/30',
  medium: 'bg-amber-400',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isOverdue(dateStr?: string): boolean {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function completedThisMonth(goals: Goal[]): number {
  const now = new Date()
  return goals.filter(g => {
    if (g.status !== 'completed') return false
    const updated = new Date(g.createdAt)
    return updated.getMonth() === now.getMonth() && updated.getFullYear() === now.getFullYear()
  }).length
}

function milestonesThisWeek(goals: Goal[]): number {
  const now = new Date()
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  return goals
    .flatMap(g => g.milestones)
    .filter(m => !m.completed && m.dueDate && new Date(m.dueDate) <= weekFromNow).length
}

function avgProgress(goals: Goal[]): number {
  const active = goals.filter(g => g.status === 'active')
  if (!active.length) return 0
  return Math.round(active.reduce((s, g) => s + g.progress, 0) / active.length)
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string | number
  icon: React.ElementType
}) {
  return (
    <div className="hud-stat-card rounded-xl p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-cyan-400/10 flex items-center justify-center flex-shrink-0">
        <Icon size={18} className="text-cyan-400" />
      </div>
      <div>
        <div className="text-xl font-bold hud-text-cyan">{value}</div>
        <div className="text-white/40 text-xs mt-0.5">{label}</div>
      </div>
    </div>
  )
}

// ─── Goal Card ────────────────────────────────────────────────────────────────

function GoalCard({
  goal,
  onDelete,
  onRefresh,
}: {
  goal: Goal
  onDelete: (id: string) => void
  onRefresh: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(goal.title)
  const [editDesc, setEditDesc] = useState(goal.description || '')
  const [editStatus, setEditStatus] = useState(goal.status)
  const [newMilestone, setNewMilestone] = useState('')
  const [saving, setSaving] = useState(false)

  const accent = CATEGORY_ACCENT[goal.category] || '#00e5ff'
  const totalMilestones = goal.milestones.length
  const completedMilestones = goal.milestones.filter(m => m.completed).length

  async function handleToggleMilestone(milestoneId: string) {
    const res = await fetch(`/api/goals/${goal.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_milestone', milestoneId }),
    })
    if (res.ok) {
      onRefresh()
    } else {
      toast.error('Failed to update milestone')
    }
  }

  async function handleDeleteMilestone(milestoneId: string) {
    const res = await fetch(`/api/goals/${goal.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_milestone', milestoneId }),
    })
    if (res.ok) {
      onRefresh()
    } else {
      toast.error('Failed to delete milestone')
    }
  }

  async function handleAddMilestone(e: React.FormEvent) {
    e.preventDefault()
    if (!newMilestone.trim()) return
    const res = await fetch(`/api/goals/${goal.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_milestone',
        title: newMilestone.trim(),
        order: totalMilestones,
      }),
    })
    if (res.ok) {
      setNewMilestone('')
      onRefresh()
    } else {
      toast.error('Failed to add milestone')
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editTitle.trim()) return
    setSaving(true)
    const res = await fetch(`/api/goals/${goal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editTitle.trim(),
        description: editDesc || undefined,
        status: editStatus,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setEditing(false)
      onRefresh()
      toast.success('Goal updated')
    } else {
      toast.error('Failed to update goal')
    }
  }

  return (
    <div
      className="hud-stat-card rounded-xl p-5 flex flex-col gap-3 border-l-4 relative group"
      style={{ borderLeftColor: accent }}
    >
      {/* Top row: category badge + priority dot + status */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={cn(
            'text-[10px] font-semibold px-2 py-0.5 rounded border capitalize nexus-mono',
            CATEGORY_COLORS[goal.category] || 'text-white/50 bg-white/5 border-white/10'
          )}
        >
          {goal.category}
        </span>
        <span
          className={cn('w-2 h-2 rounded-full flex-shrink-0', PRIORITY_DOT[goal.priority] || 'bg-white/20')}
          title={`Priority: ${goal.priority}`}
        />
        <span className="text-[10px] text-white/40 capitalize ml-auto">{goal.status}</span>
      </div>

      {/* Title / Edit form */}
      {editing ? (
        <form onSubmit={handleSaveEdit} className="flex flex-col gap-2">
          <input
            className="bg-white/5 border border-cyan-400/20 rounded-lg px-3 py-1.5 text-sm text-white/90 outline-none focus:border-cyan-400/50 w-full"
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            placeholder="Goal title"
            required
          />
          <textarea
            className="bg-white/5 border border-cyan-400/20 rounded-lg px-3 py-1.5 text-sm text-white/70 outline-none focus:border-cyan-400/50 w-full resize-none"
            rows={2}
            value={editDesc}
            onChange={e => setEditDesc(e.target.value)}
            placeholder="Description (optional)"
          />
          <select
            className="bg-[#000810] border border-cyan-400/20 rounded-lg px-3 py-1.5 text-sm text-white/80 outline-none focus:border-cyan-400/50"
            value={editStatus}
            onChange={e => setEditStatus(e.target.value)}
          >
            {['active', 'completed', 'paused', 'archived'].map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-1.5 bg-cyan-400/20 text-cyan-400 border border-cyan-400/30 rounded-lg text-xs font-medium hover:bg-cyan-400/30 transition-all disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex-1 py-1.5 bg-white/5 text-white/40 border border-white/10 rounded-lg text-xs hover:text-white/70 transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <h3 className="font-bold text-white/90 leading-snug">{goal.title}</h3>
          {goal.description && (
            <p className="text-white/40 text-xs leading-relaxed line-clamp-2">{goal.description}</p>
          )}
        </>
      )}

      {/* Progress bar */}
      {!editing && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-white/40">Progress</span>
            <span className="text-[10px] font-semibold text-cyan-400">{goal.progress}% complete</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-cyan-400 transition-all duration-500"
              style={{ width: `${goal.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Target date + milestone count */}
      {!editing && (
        <div className="flex items-center gap-3 text-xs">
          {goal.targetDate && (
            <span
              className={cn(
                'flex items-center gap-1',
                isOverdue(goal.targetDate) && goal.status !== 'completed'
                  ? 'text-red-400'
                  : 'text-white/40'
              )}
            >
              <Calendar size={11} />
              {formatDate(goal.targetDate)}
              {isOverdue(goal.targetDate) && goal.status !== 'completed' && (
                <span className="ml-1 text-[9px] bg-red-400/15 text-red-400 px-1 rounded">overdue</span>
              )}
            </span>
          )}
          {totalMilestones > 0 && (
            <span className="flex items-center gap-1 text-white/40">
              <TrendingUp size={11} />
              {completedMilestones}/{totalMilestones} milestones done
            </span>
          )}
        </div>
      )}

      {/* Action buttons */}
      {!editing && (
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1 text-[11px] text-white/40 hover:text-cyan-400 transition-colors"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expanded ? 'Hide' : 'Milestones'}
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setEditing(true)}
            className="w-7 h-7 rounded-md flex items-center justify-center text-white/20 hover:text-cyan-400 hover:bg-cyan-400/10 transition-all"
            title="Edit goal"
          >
            <Edit3 size={13} />
          </button>
          <button
            onClick={() => onDelete(goal.id)}
            className="w-7 h-7 rounded-md flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-all"
            title="Delete goal"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}

      {/* Milestones panel */}
      {expanded && !editing && (
        <div className="border-t border-white/5 pt-3 flex flex-col gap-2">
          {goal.milestones.length === 0 && (
            <p className="text-white/30 text-xs text-center py-1">No milestones yet</p>
          )}
          {goal.milestones.map(m => (
            <div key={m.id} className="flex items-start gap-2 group/ms">
              <button
                onClick={() => handleToggleMilestone(m.id)}
                className="mt-0.5 flex-shrink-0 text-white/30 hover:text-cyan-400 transition-colors"
              >
                {m.completed ? (
                  <CheckCircle2 size={15} className="text-cyan-400" />
                ) : (
                  <Circle size={15} />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <span
                  className={cn(
                    'text-xs leading-snug',
                    m.completed ? 'line-through text-white/25' : 'text-white/70'
                  )}
                >
                  {m.title}
                </span>
                {m.dueDate && (
                  <div
                    className={cn(
                      'text-[10px] mt-0.5',
                      isOverdue(m.dueDate) && !m.completed ? 'text-red-400' : 'text-white/30'
                    )}
                  >
                    Due {formatDate(m.dueDate)}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleDeleteMilestone(m.id)}
                className="flex-shrink-0 opacity-0 group-hover/ms:opacity-100 text-white/20 hover:text-red-400 transition-all"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}

          {/* Add milestone inline */}
          <form onSubmit={handleAddMilestone} className="flex gap-2 mt-1">
            <input
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/80 placeholder-white/25 outline-none focus:border-cyan-400/40"
              placeholder="Add milestone…"
              value={newMilestone}
              onChange={e => setNewMilestone(e.target.value)}
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-cyan-400/15 text-cyan-400 border border-cyan-400/25 rounded-lg text-xs hover:bg-cyan-400/25 transition-all"
            >
              <Plus size={13} />
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

// ─── Add Goal Form ────────────────────────────────────────────────────────────

function AddGoalForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'personal',
    priority: 'medium',
    targetDate: '',
    tags: '',
  })

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description || undefined,
          category: form.category,
          priority: form.priority,
          targetDate: form.targetDate || undefined,
          tags: form.tags || undefined,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Goal created!')
      setForm({ title: '', description: '', category: 'personal', priority: 'medium', targetDate: '', tags: '' })
      setOpen(false)
      onCreated()
    } catch {
      toast.error('Failed to create goal')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-cyan-400/15 text-cyan-400 border border-cyan-400/25 rounded-lg text-sm font-medium hover:bg-cyan-400/25 transition-all"
      >
        <Plus size={15} />
        Add Goal
      </button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="hud-stat-card rounded-xl p-5 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-white/80">New Goal</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-white/30 hover:text-white/60 text-xs"
        >
          Cancel
        </button>
      </div>

      <input
        name="title"
        required
        value={form.title}
        onChange={handleChange}
        placeholder="Goal title *"
        className="bg-white/5 border border-cyan-400/15 rounded-lg px-3 py-2 text-sm text-white/90 placeholder-white/25 outline-none focus:border-cyan-400/40 w-full"
      />
      <textarea
        name="description"
        value={form.description}
        onChange={handleChange}
        placeholder="Description (optional)"
        rows={2}
        className="bg-white/5 border border-cyan-400/15 rounded-lg px-3 py-2 text-sm text-white/70 placeholder-white/25 outline-none focus:border-cyan-400/40 w-full resize-none"
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-white/30 mb-1 block">Category</label>
          <select
            name="category"
            value={form.category}
            onChange={handleChange}
            className="bg-[#000810] border border-cyan-400/15 rounded-lg px-3 py-2 text-sm text-white/80 outline-none focus:border-cyan-400/40 w-full"
          >
            {CATEGORIES.filter(c => c !== 'all').map(c => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-white/30 mb-1 block">Priority</label>
          <select
            name="priority"
            value={form.priority}
            onChange={handleChange}
            className="bg-[#000810] border border-cyan-400/15 rounded-lg px-3 py-2 text-sm text-white/80 outline-none focus:border-cyan-400/40 w-full"
          >
            {['low', 'medium', 'high', 'urgent'].map(p => (
              <option key={p} value={p}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-[10px] text-white/30 mb-1 block">Target Date</label>
        <input
          name="targetDate"
          type="date"
          value={form.targetDate}
          onChange={handleChange}
          className="bg-white/5 border border-cyan-400/15 rounded-lg px-3 py-2 text-sm text-white/80 outline-none focus:border-cyan-400/40 w-full"
        />
      </div>

      <input
        name="tags"
        value={form.tags}
        onChange={handleChange}
        placeholder="Tags (comma separated)"
        className="bg-white/5 border border-cyan-400/15 rounded-lg px-3 py-2 text-sm text-white/70 placeholder-white/25 outline-none focus:border-cyan-400/40 w-full"
      />

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2 bg-cyan-400/20 text-cyan-400 border border-cyan-400/30 rounded-lg text-sm font-semibold hover:bg-cyan-400/30 transition-all disabled:opacity-40"
      >
        {submitting ? 'Creating…' : 'Create Goal'}
      </button>
    </form>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('all')

  const loadGoals = useCallback(async () => {
    try {
      const res = await fetch('/api/goals')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setGoals(data.goals)
    } catch {
      toast.error('Failed to load goals')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadGoals()
  }, [loadGoals])

  async function handleDelete(id: string) {
    if (!confirm('Delete this goal and all its milestones?')) return
    const res = await fetch(`/api/goals/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Goal deleted')
      setGoals(prev => prev.filter(g => g.id !== id))
    } else {
      toast.error('Failed to delete goal')
    }
  }

  const filtered =
    activeCategory === 'all' ? goals : goals.filter(g => g.category === activeCategory)

  const activeGoals = goals.filter(g => g.status === 'active')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="GOALS" subtitle="Long-term goals, milestones & progress" />

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total active goals" value={activeGoals.length} icon={Target} />
          <StatCard label="Completed this month" value={completedThisMonth(goals)} icon={CheckCircle2} />
          <StatCard label="Milestones due this week" value={milestonesThisWeek(goals)} icon={Calendar} />
          <StatCard label="Average progress" value={`${avgProgress(goals)}%`} icon={TrendingUp} />
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all capitalize',
                activeCategory === cat
                  ? 'bg-cyan-400/20 text-cyan-400 border-cyan-400/40'
                  : 'bg-white/3 text-white/40 border-white/10 hover:text-white/70 hover:border-white/20'
              )}
            >
              {cat}
              {cat !== 'all' && (
                <span className="ml-1.5 text-[9px] opacity-60">
                  ({goals.filter(g => g.category === cat).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Add goal form */}
        <AddGoalForm onCreated={loadGoals} />

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Flag size={40} className="text-white/10" />
            <div className="text-white/40 text-sm text-center">
              {activeCategory === 'all'
                ? 'No goals yet. Add your first goal above!'
                : `No ${activeCategory} goals yet.`}
            </div>
          </div>
        )}

        {/* Goals grid */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onDelete={handleDelete}
                onRefresh={loadGoals}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
