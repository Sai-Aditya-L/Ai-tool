'use client'

import { useState, useEffect, useRef } from 'react'
import { Header } from '@/components/layout/header'
import { Plus, Bell, Clock, Check, Trash2, X, AlertCircle, AlarmClock } from 'lucide-react'
import { cn, formatDate, getPriorityColor } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Reminder {
  id: string
  title: string
  description?: string
  dueAt: string
  status: string
  priority: string
  recurring?: boolean
  recurrenceRule?: string | null
  snoozedUntil?: string | null
}

const SNOOZE_OPTIONS = [
  { label: '15 min', getValue: () => { const d = new Date(); d.setMinutes(d.getMinutes() + 15); return d } },
  { label: '1 hour', getValue: () => { const d = new Date(); d.setHours(d.getHours() + 1); return d } },
  { label: '3 hours', getValue: () => { const d = new Date(); d.setHours(d.getHours() + 3); return d } },
  {
    label: 'Tomorrow morning (9am)', getValue: () => {
      const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d
    },
  },
  {
    label: 'Next week', getValue: () => {
      const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(9, 0, 0, 0); return d
    },
  },
]

const RECURRENCE_RULES = ['daily', 'weekly', 'weekdays', 'monthly', 'yearly']

// ─── Snooze Dropdown ──────────────────────────────────────────────────────────

interface SnoozeDropdownProps {
  reminderId: string
  onSnooze: (id: string, until: string) => void
  onClose: () => void
}

function SnoozeDropdown({ reminderId, onSnooze, onClose }: SnoozeDropdownProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute right-0 top-8 z-30 w-52 rounded-xl border border-white/10 shadow-xl"
      style={{ background: 'rgba(10,15,30,0.97)' }}
    >
      <p className="text-white/30 text-[10px] uppercase tracking-widest px-3 pt-2.5 pb-1">Snooze until</p>
      {SNOOZE_OPTIONS.map(opt => (
        <button
          key={opt.label}
          onClick={() => { onSnooze(reminderId, opt.getValue().toISOString()); onClose() }}
          className="w-full text-left px-3 py-2 text-xs text-white/70 hover:text-cyan-300 hover:bg-cyan-400/10 transition-all"
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [snoozeOpenId, setSnoozeOpenId] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    dueAt: '',
    priority: 'medium',
    recurring: false,
    recurrenceRule: '',
  })

  useEffect(() => { fetchReminders() }, [statusFilter])

  async function fetchReminders() {
    setLoading(true)
    try {
      const res = await fetch(`/api/reminders?status=${statusFilter}`)
      const data = await res.json()
      setReminders(data.reminders || [])
    } catch {
      toast.error('Failed to load reminders')
    } finally {
      setLoading(false)
    }
  }

  async function createReminder(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.dueAt) return
    try {
      const body: Record<string, unknown> = {
        title: form.title,
        description: form.description,
        dueAt: new Date(form.dueAt).toISOString(),
        priority: form.priority,
        recurring: form.recurring,
      }
      if (form.recurring && form.recurrenceRule) body.recurrenceRule = form.recurrenceRule
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      toast.success('Reminder set!')
      setForm({ title: '', description: '', dueAt: '', priority: 'medium', recurring: false, recurrenceRule: '' })
      setShowForm(false)
      fetchReminders()
    } catch {
      toast.error('Failed to create reminder')
    }
  }

  async function completeReminder(id: string) {
    try {
      await fetch(`/api/reminders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed', completedAt: new Date().toISOString() }),
      })
      setReminders(prev => prev.filter(r => r.id !== id))
      toast.success('Reminder completed!')
    } catch {
      toast.error('Failed to update reminder')
    }
  }

  async function snoozeReminder(id: string, snoozedUntil: string) {
    try {
      await fetch(`/api/reminders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snoozedUntil, status: 'snoozed' }),
      })
      setReminders(prev => prev.map(r => r.id === id ? { ...r, snoozedUntil, status: 'snoozed' } : r))
      toast.success('Reminder snoozed')
    } catch {
      toast.error('Failed to snooze reminder')
    }
  }

  async function deleteReminder(id: string) {
    if (!confirm('Delete this reminder?')) return
    try {
      await fetch(`/api/reminders/${id}`, { method: 'DELETE' })
      setReminders(prev => prev.filter(r => r.id !== id))
      toast.success('Reminder deleted')
    } catch {
      toast.error('Failed to delete reminder')
    }
  }

  function getDefaultDueAt() {
    const d = new Date()
    d.setHours(d.getHours() + 1, 0, 0, 0)
    return d.toISOString().slice(0, 16)
  }

  const isOverdue = (dueAt: string) => new Date(dueAt) < new Date()

  function isSnoozedActive(r: Reminder) {
    return !!r.snoozedUntil && new Date(r.snoozedUntil) > new Date()
  }

  function formatSnoozeTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }

  const isPendingOrActive = (r: Reminder) => r.status === 'pending' || r.status === 'snoozed'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Reminders" subtitle={`${reminders.length} ${statusFilter} reminders`} />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-4">

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => { setShowForm(!showForm); if (!form.dueAt) setForm(f => ({ ...f, dueAt: getDefaultDueAt() })) }}
              className="nexus-btn-primary flex items-center gap-2 text-sm"
            >
              <Plus size={16} />
              New Reminder
            </button>
            <div className="flex gap-1">
              {['pending', 'completed', 'snoozed'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs transition-all capitalize',
                    statusFilter === s
                      ? 'bg-cyan-400/15 border border-cyan-400/30 text-cyan-400'
                      : 'text-white/40 border border-white/5 hover:border-white/15 hover:text-white/60'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Create form */}
          {showForm && (
            <div className="glass-panel rounded-2xl p-5">
              <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                <Bell size={16} className="text-cyan-400" />
                New Reminder
              </h3>
              <form onSubmit={createReminder} className="space-y-3">
                <input
                  type="text"
                  placeholder="Reminder title *"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  required
                  className="nexus-input"
                  autoFocus
                />
                <textarea
                  placeholder="Description (optional)"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="nexus-input resize-none"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/40 text-xs mb-1 block">When *</label>
                    <input
                      type="datetime-local"
                      value={form.dueAt}
                      onChange={e => setForm(f => ({ ...f, dueAt: e.target.value }))}
                      required
                      className="nexus-input"
                    />
                  </div>
                  <div>
                    <label className="text-white/40 text-xs mb-1 block">Priority</label>
                    <select
                      value={form.priority}
                      onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                      className="nexus-input"
                    >
                      {['urgent', 'high', 'medium', 'low'].map(p => (
                        <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Recurring toggle */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, recurring: !f.recurring, recurrenceRule: !f.recurring ? 'weekly' : '' }))}
                    className="flex items-center gap-3 w-full text-left"
                  >
                    <div className={cn(
                      'w-9 h-5 rounded-full transition-all relative flex-shrink-0',
                      form.recurring ? 'bg-cyan-400/40 border border-cyan-400/50' : 'bg-white/10 border border-white/15'
                    )}>
                      <span className={cn(
                        'absolute top-0.5 w-4 h-4 rounded-full transition-all',
                        form.recurring ? 'left-4 bg-cyan-400' : 'left-0.5 bg-white/40'
                      )} />
                    </div>
                    <span className="text-white/60 text-sm">Recurring</span>
                  </button>

                  {form.recurring && (
                    <select
                      value={form.recurrenceRule}
                      onChange={e => setForm(f => ({ ...f, recurrenceRule: e.target.value }))}
                      className="nexus-input"
                    >
                      <option value="">Select recurrence…</option>
                      {RECURRENCE_RULES.map(r => (
                        <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex gap-2">
                  <button type="submit" className="nexus-btn-primary flex-1">Set Reminder</button>
                  <button type="button" onClick={() => setShowForm(false)} className="nexus-btn-secondary px-4">
                    <X size={16} />
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Reminders list */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
            </div>
          ) : reminders.length === 0 ? (
            <div className="text-center py-16 glass-panel rounded-2xl">
              <Bell size={40} className="text-white/20 mx-auto mb-3" />
              <p className="text-white/40 font-medium">No {statusFilter} reminders</p>
              <p className="text-white/25 text-sm mt-1">Create a reminder or ask NEXUS to set one for you</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reminders.map(r => (
                <div
                  key={r.id}
                  className={cn(
                    'glass-panel-hover rounded-xl p-4 flex items-start gap-3',
                    isOverdue(r.dueAt) && r.status === 'pending' ? 'border-red-500/30' : ''
                  )}
                >
                  <div className={cn(
                    'w-2 h-2 rounded-full mt-2 flex-shrink-0',
                    r.priority === 'urgent' ? 'bg-red-400' :
                    r.priority === 'high' ? 'bg-orange-400' :
                    r.priority === 'medium' ? 'bg-yellow-400' : 'bg-green-400'
                  )} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-white/85">{r.title}</p>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isOverdue(r.dueAt) && r.status === 'pending' && (
                          <AlertCircle size={14} className="text-red-400" aria-label="Overdue" />
                        )}
                        {/* Snoozed badge */}
                        {isSnoozedActive(r) ? (
                          <span className="text-xs px-2 py-0.5 rounded-full border bg-yellow-400/10 border-yellow-400/30 text-yellow-300">
                            Snoozed until {formatSnoozeTime(r.snoozedUntil!)}
                          </span>
                        ) : (
                          <span className={cn('text-xs px-2 py-0.5 rounded-full border', getPriorityColor(r.priority))}>
                            {r.priority}
                          </span>
                        )}
                        {r.recurring && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-400/10 border border-cyan-400/20 text-cyan-400/70">
                            {r.recurrenceRule || 'recurring'}
                          </span>
                        )}
                      </div>
                    </div>
                    {r.description && <p className="text-white/40 text-xs mt-1">{r.description}</p>}
                    <div className="flex items-center gap-3 mt-2">
                      <span className={cn('text-xs flex items-center gap-1', isOverdue(r.dueAt) && r.status === 'pending' ? 'text-red-400' : 'text-white/40')}>
                        <Clock size={10} />
                        {formatDate(r.dueAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0 relative">
                    {isPendingOrActive(r) && (
                      <button
                        onClick={() => completeReminder(r.id)}
                        className="p-1.5 rounded-lg text-white/30 hover:text-green-400 hover:bg-green-400/5 transition-all"
                        title="Mark complete"
                      >
                        <Check size={14} />
                      </button>
                    )}

                    {/* Snooze button */}
                    {isPendingOrActive(r) && (
                      <div className="relative">
                        <button
                          onClick={() => setSnoozeOpenId(snoozeOpenId === r.id ? null : r.id)}
                          className="p-1.5 rounded-lg text-white/30 hover:text-yellow-400 hover:bg-yellow-400/5 transition-all"
                          title="Snooze"
                        >
                          <AlarmClock size={14} />
                        </button>
                        {snoozeOpenId === r.id && (
                          <SnoozeDropdown
                            reminderId={r.id}
                            onSnooze={snoozeReminder}
                            onClose={() => setSnoozeOpenId(null)}
                          />
                        )}
                      </div>
                    )}

                    <button
                      onClick={() => deleteReminder(r.id)}
                      className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/5 transition-all"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
