'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Plus, Bell, Clock, Check, Trash2, X, AlertCircle } from 'lucide-react'
import { cn, formatDate, getPriorityColor } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Reminder {
  id: string
  title: string
  description?: string
  dueAt: string
  status: string
  priority: string
}

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [statusFilter, setStatusFilter] = useState('pending')
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
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, dueAt: new Date(form.dueAt).toISOString() }),
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
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {isOverdue(r.dueAt) && r.status === 'pending' && (
                          <AlertCircle size={14} className="text-red-400" aria-label="Overdue" />
                        )}
                        <span className={cn('text-xs px-2 py-0.5 rounded-full border', getPriorityColor(r.priority))}>
                          {r.priority}
                        </span>
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

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {r.status === 'pending' && (
                      <button
                        onClick={() => completeReminder(r.id)}
                        className="p-1.5 rounded-lg text-white/30 hover:text-green-400 hover:bg-green-400/5 transition-all"
                        title="Mark complete"
                      >
                        <Check size={14} />
                      </button>
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
