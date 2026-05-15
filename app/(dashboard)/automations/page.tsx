'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { Zap, Plus, Play, Pause, Trash2, Clock, ArrowRight, X, Loader2, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Automation {
  id: string
  name: string
  trigger: string
  actions: string
  description: string | null
  conditions: string | null
  status: string
  lastRun: string | null
  nextRun: string | null
  runCount: number
  createdAt: string
}

interface FormState {
  name: string
  trigger: string
  action: string
  schedule: 'daily' | 'weekly' | 'on_event' | 'manual'
}

const EMPTY_FORM: FormState = {
  name: '',
  trigger: '',
  action: '',
  schedule: 'daily',
}

const TEMPLATES = [
  {
    name: 'Morning Briefing',
    icon: '🌅',
    desc: 'Daily summary of your tasks and schedule',
    form: {
      name: 'Morning Briefing',
      trigger: 'Every day at 8:00 AM',
      action: 'Summarize tasks, reminders, and emails into a morning briefing',
      schedule: 'daily' as const,
    },
  },
  {
    name: 'Weekly Review',
    icon: '📊',
    desc: 'Weekly productivity report every Monday',
    form: {
      name: 'Weekly Review',
      trigger: 'Every Monday at 9:00 AM',
      action: 'Generate a weekly productivity summary and goal review',
      schedule: 'weekly' as const,
    },
  },
  {
    name: 'Bill Alert',
    icon: '💳',
    desc: 'Reminders before bills are due',
    form: {
      name: 'Bill Alert',
      trigger: 'When a bill due date is 3 days away',
      action: 'Create a high-priority reminder for the upcoming bill',
      schedule: 'on_event' as const,
    },
  },
  {
    name: 'Task Digest',
    icon: '✅',
    desc: 'Daily digest of pending tasks at end of day',
    form: {
      name: 'Task Digest',
      trigger: 'Every day at 6:00 PM',
      action: 'Summarize all pending tasks and priorities for tomorrow',
      schedule: 'daily' as const,
    },
  },
  {
    name: 'Email Summary',
    icon: '📧',
    desc: 'Daily summary of unread emails',
    form: {
      name: 'Email Summary',
      trigger: 'Every day at 5:00 PM',
      action: 'Summarize unread emails and highlight action items',
      schedule: 'daily' as const,
    },
  },
  {
    name: 'Custom',
    icon: '⚡',
    desc: 'Build your own automation workflow',
    form: EMPTY_FORM,
  },
]

function formatLastRun(lastRun: string | null): string {
  if (!lastRun) return 'Never'
  const date = new Date(lastRun)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [running, setRunning] = useState<string | null>(null)
  const [runResult, setRunResult] = useState<{ id: string; success: boolean; message: string } | null>(null)

  async function handleRunNow(automation: Automation) {
    setRunning(automation.id)
    setRunResult(null)
    try {
      const res = await fetch('/api/automations/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ automationId: automation.id }),
      })
      const data = await res.json()
      setRunResult({ id: automation.id, success: res.ok, message: data.message || data.error || 'Done' })
      if (res.ok) fetchAutomations()
    } catch {
      setRunResult({ id: automation.id, success: false, message: 'Network error' })
    } finally {
      setRunning(null)
    }
  }

  const fetchAutomations = useCallback(async () => {
    try {
      const res = await fetch('/api/automations')
      if (res.ok) {
        const data = await res.json()
        setAutomations(data.automations)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAutomations()
  }, [fetchAutomations])

  function applyTemplate(template: typeof TEMPLATES[0]) {
    setForm(template.form)
    setShowForm(true)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.trigger.trim() || !form.action.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          trigger: form.trigger,
          action: form.action,
          schedule: form.schedule,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setAutomations(prev => [data.automation, ...prev])
        setForm(EMPTY_FORM)
        setShowForm(false)
      }
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(automation: Automation) {
    const next = automation.status === 'active' ? 'paused' : 'active'
    setToggling(automation.id)
    try {
      const res = await fetch(`/api/automations/${automation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (res.ok) {
        setAutomations(prev =>
          prev.map(a => (a.id === automation.id ? { ...a, status: next } : a))
        )
      }
    } finally {
      setToggling(null)
    }
  }

  async function handleDelete(automation: Automation) {
    if (!confirm(`Delete "${automation.name}"? This cannot be undone.`)) return
    setDeleting(automation.id)
    try {
      const res = await fetch(`/api/automations/${automation.id}`, { method: 'DELETE' })
      if (res.ok) {
        setAutomations(prev => prev.filter(a => a.id !== automation.id))
      }
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Automations" subtitle="Intelligent workflow engine" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-4">

          <div className="glass-panel rounded-xl p-4 border border-cyan-400/10 flex items-start gap-3">
            <Zap size={18} className="text-cyan-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-white/70 text-sm font-medium">Automation Engine — Live</p>
              <p className="text-white/40 text-xs mt-0.5">
                Create and manage your automations here. NEXUS AI in chat can manually trigger
                summaries and actions. Scheduled execution requires a background cron service.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => { setShowForm(v => !v); setForm(EMPTY_FORM) }}
              className="nexus-btn-primary flex items-center gap-2 text-sm"
            >
              <Plus size={16} />
              New Automation
            </button>
          </div>

          {showForm && (
            <div className="glass-panel rounded-2xl p-5 border border-cyan-400/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-medium">New Automation</h3>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-white/30 hover:text-white/60 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <form onSubmit={handleCreate} className="space-y-3">
                <div>
                  <label className="text-white/50 text-xs mb-1 block">Name</label>
                  <input
                    className="nexus-input w-full text-sm"
                    placeholder="e.g. Morning Briefing"
                    value={form.name}
                    onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs mb-1 block">Trigger</label>
                  <input
                    className="nexus-input w-full text-sm"
                    placeholder="e.g. Every day at 8 AM"
                    value={form.trigger}
                    onChange={e => setForm(prev => ({ ...prev, trigger: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs mb-1 block">Action</label>
                  <input
                    className="nexus-input w-full text-sm"
                    placeholder="e.g. Summarize tasks and send briefing"
                    value={form.action}
                    onChange={e => setForm(prev => ({ ...prev, action: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs mb-1 block">Schedule</label>
                  <select
                    className="nexus-input w-full text-sm"
                    value={form.schedule}
                    onChange={e => setForm(prev => ({ ...prev, schedule: e.target.value as FormState['schedule'] }))}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="on_event">On Event</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={saving}
                    className="nexus-btn-primary flex items-center gap-2 text-sm"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="text-white/40 hover:text-white/70 text-sm px-3 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div>
            <p className="text-white/30 text-xs uppercase tracking-wider mb-2">Your Automations</p>
            {loading ? (
              <div className="glass-panel rounded-xl p-8 flex justify-center">
                <Loader2 size={20} className="animate-spin text-white/30" />
              </div>
            ) : automations.length === 0 ? (
              <div className="glass-panel rounded-xl p-8 text-center">
                <Zap size={32} className="text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm">No automations yet.</p>
                <p className="text-white/20 text-xs mt-1">Create one above or choose a template below.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {automations.map(auto => (
                  <div key={auto.id} className="glass-panel-hover rounded-xl p-4 flex items-center gap-4">
                    <div className={cn(
                      'w-2 h-2 rounded-full flex-shrink-0',
                      auto.status === 'active' ? 'bg-green-400' : 'bg-white/20'
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white/85 font-medium text-sm">{auto.name}</p>
                      <div className="flex items-center gap-1 mt-0.5 text-white/35 text-xs flex-wrap">
                        <Clock size={10} />
                        <span className="truncate max-w-[160px]">{auto.trigger}</span>
                        <ArrowRight size={10} className="mx-1 flex-shrink-0" />
                        <span className="truncate max-w-[200px]">{auto.actions}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-white/25 text-[10px]">Last run: {formatLastRun(auto.lastRun)}</p>
                        {auto.runCount > 0 && (
                          <p className="text-white/20 text-[10px]">{auto.runCount} run{auto.runCount !== 1 ? 's' : ''}</p>
                        )}
                      </div>
                      {runResult?.id === auto.id && (
                        <p className={`text-[10px] mt-1 ${runResult.success ? 'text-green-400' : 'text-red-400'}`}>
                          {runResult.message}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full border',
                        auto.status === 'active'
                          ? 'text-green-400 border-green-400/30'
                          : 'text-white/30 border-white/15'
                      )}>
                        {auto.status}
                      </span>
                      <button
                        onClick={() => handleRunNow(auto)}
                        disabled={running === auto.id}
                        title="Run now"
                        className="text-white/30 hover:text-cyan-400 transition-colors p-1.5 rounded-lg hover:bg-cyan-400/5 disabled:opacity-40"
                      >
                        {running === auto.id
                          ? <Loader2 size={14} className="animate-spin" />
                          : <RotateCcw size={14} />
                        }
                      </button>
                      <button
                        onClick={() => toggleStatus(auto)}
                        disabled={toggling === auto.id}
                        title={auto.status === 'active' ? 'Pause' : 'Resume'}
                        className="text-white/30 hover:text-cyan-400 transition-colors p-1.5 rounded-lg hover:bg-cyan-400/5 disabled:opacity-40"
                      >
                        {toggling === auto.id
                          ? <Loader2 size={14} className="animate-spin" />
                          : auto.status === 'active' ? <Pause size={14} /> : <Play size={14} />
                        }
                      </button>
                      <button
                        onClick={() => handleDelete(auto)}
                        disabled={deleting === auto.id}
                        title="Delete"
                        className="text-white/20 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-400/5 disabled:opacity-40"
                      >
                        {deleting === auto.id
                          ? <Loader2 size={14} className="animate-spin" />
                          : <Trash2 size={14} />
                        }
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-panel rounded-2xl p-5">
            <h3 className="text-white font-medium mb-4">Templates</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {TEMPLATES.map(t => (
                <button
                  key={t.name}
                  onClick={() => applyTemplate(t)}
                  className="text-left glass-panel-hover rounded-xl p-3 transition-all"
                >
                  <span className="text-2xl block mb-2">{t.icon}</span>
                  <p className="text-white/80 text-sm font-medium">{t.name}</p>
                  <p className="text-white/40 text-xs mt-1">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-xl p-5">
            <p className="text-white/50 text-xs uppercase tracking-wider mb-3">How It Works</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { step: '1', title: 'Trigger', desc: 'Time-based, event-based, or condition-based triggers start your workflow', icon: '⚡' },
                { step: '2', title: 'Conditions', desc: 'Optional filters and conditions to control when the automation runs', icon: '🔍' },
                { step: '3', title: 'Actions', desc: 'NEXUS executes tasks, sends notifications, and creates summaries', icon: '✅' },
              ].map(s => (
                <div key={s.step} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-cyan-400 text-xs font-bold">{s.step}</span>
                  </div>
                  <div>
                    <p className="text-white/70 text-sm font-medium">{s.title} {s.icon}</p>
                    <p className="text-white/35 text-xs mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
