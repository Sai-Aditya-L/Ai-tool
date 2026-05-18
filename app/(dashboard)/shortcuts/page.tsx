'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { Zap, Plus, Trash2, Play, Clock, Loader2, Sparkles, Copy, Check, Edit2, X, BookOpen } from 'lucide-react'
import toast from 'react-hot-toast'

interface Shortcut {
  id: string
  trigger: string
  expansion: string
  description?: string
  useCount: number
  createdAt: string
}

const BUILTIN_SHORTCUTS = [
  { trigger: 'morning briefing', expansion: 'Give me a full morning briefing: today\'s tasks, calendar events, reminders, weather, and top priorities.', description: 'Start your day with a full overview' },
  { trigger: 'focus mode', expansion: 'Help me enter deep focus mode. Suggest the most important task to work on right now and start a 25-minute Pomodoro timer.', description: 'Enter deep work mode' },
  { trigger: 'end of day', expansion: 'Summarize what I accomplished today, list any incomplete tasks, and preview tomorrow\'s schedule.', description: 'Wind down and review progress' },
  { trigger: 'security check', expansion: 'Run a security audit: check for anomalies in recent activity, review my agent runs, and report any threats or unusual patterns.', description: 'Audit system security status' },
  { trigger: 'weekly review', expansion: 'Give me a comprehensive weekly review: tasks completed, goals progress, habit streaks, and recommendations for next week.', description: 'Weekly progress summary' },
  { trigger: 'brain dump', expansion: 'I want to do a brain dump. I\'ll list everything on my mind and you help me organize it into tasks, reminders, and notes.', description: 'Clear your head into organized items' },
]

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function ShortcutsPage() {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ trigger: '', expansion: '', description: '' })
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [aiSuggesting, setAiSuggesting] = useState(false)

  const loadShortcuts = useCallback(async () => {
    try {
      const res = await fetch('/api/shortcuts')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setShortcuts(data.shortcuts ?? [])
    } catch {
      toast.error('Failed to load shortcuts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadShortcuts() }, [loadShortcuts])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.trigger.trim() || !form.expansion.trim()) return
    setSubmitting(true)
    try {
      if (editingId) {
        const res = await fetch(`/api/shortcuts/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error()
        toast.success('Shortcut updated')
      } else {
        const res = await fetch('/api/shortcuts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error()
        toast.success('Shortcut saved!')
      }
      setForm({ trigger: '', expansion: '', description: '' })
      setShowForm(false)
      setEditingId(null)
      loadShortcuts()
    } catch {
      toast.error('Failed to save shortcut')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this shortcut?')) return
    setDeletingId(id)
    try {
      await fetch(`/api/shortcuts/${id}`, { method: 'DELETE' })
      setShortcuts(prev => prev.filter(s => s.id !== id))
      toast.success('Shortcut deleted')
    } catch {
      toast.error('Failed to delete shortcut')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleRun(shortcut: Shortcut) {
    // Increment use count
    await fetch(`/api/shortcuts/${shortcut.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ increment: true }),
    }).catch(() => {})
    setShortcuts(prev => prev.map(s => s.id === shortcut.id ? { ...s, useCount: s.useCount + 1 } : s))
    // Navigate to chat with the expansion pre-filled
    window.location.href = `/chat?q=${encodeURIComponent(shortcut.expansion)}`
  }

  async function handleCopy(text: string, id: string) {
    await navigator.clipboard.writeText(text).catch(() => {})
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  function startEdit(s: Shortcut) {
    setForm({ trigger: s.trigger, expansion: s.expansion, description: s.description ?? '' })
    setEditingId(s.id)
    setShowForm(true)
  }

  async function addBuiltin(b: typeof BUILTIN_SHORTCUTS[0]) {
    try {
      const res = await fetch('/api/shortcuts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(b),
      })
      if (!res.ok) throw new Error()
      toast.success(`"${b.trigger}" added!`)
      loadShortcuts()
    } catch {
      toast.error('Failed to add shortcut')
    }
  }

  async function suggestExpansion() {
    if (!form.trigger.trim()) { toast.error('Enter a trigger phrase first'); return }
    setAiSuggesting(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `Write a clear, natural language expansion for this shortcut trigger phrase: "${form.trigger}". The expansion should be a prompt that a user would send to their AI personal assistant. Keep it under 150 words. Return only the expansion text, no labels or prefixes.` }],
        }),
      })
      const data = await res.json()
      const text = data.message ?? data.content ?? ''
      if (text) {
        setForm(f => ({ ...f, expansion: text }))
        toast.success('AI expansion generated!')
      }
    } catch {
      toast.error('AI suggestion failed')
    } finally {
      setAiSuggesting(false)
    }
  }

  // Builtins not yet saved by user
  const existingTriggers = new Set(shortcuts.map(s => s.trigger))
  const availableBuiltins = BUILTIN_SHORTCUTS.filter(b => !existingTriggers.has(b.trigger))

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Shortcuts" subtitle={`${shortcuts.length} custom NL shortcuts`} />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-5">

          {/* Info banner */}
          <div className="glass-panel rounded-xl p-4 border border-cyan-500/20 flex items-start gap-3">
            <Zap size={18} className="text-cyan-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-white/70 text-sm font-medium">Natural Language Shortcuts</p>
              <p className="text-white/40 text-xs mt-0.5">
                Create trigger phrases that expand into full prompts for NEXUS. Type a shortcut trigger in chat or click Run to launch it instantly.
              </p>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ trigger: '', expansion: '', description: '' }) }}
              className="nexus-btn-primary flex items-center gap-2 text-sm"
            >
              <Plus size={16} />
              New Shortcut
            </button>
          </div>

          {/* Form */}
          {showForm && (
            <div className="glass-panel rounded-2xl p-5">
              <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                {editingId ? <Edit2 size={15} className="text-cyan-400" /> : <Plus size={15} className="text-cyan-400" />}
                {editingId ? 'Edit Shortcut' : 'New Shortcut'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="text-white/40 text-xs mb-1 block">Trigger phrase *</label>
                  <input
                    type="text"
                    placeholder='e.g. "morning briefing", "end of day", "focus mode"'
                    value={form.trigger}
                    onChange={e => setForm(f => ({ ...f, trigger: e.target.value.toLowerCase() }))}
                    required
                    className="nexus-input"
                    autoFocus
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-white/40 text-xs">Expansion (full prompt) *</label>
                    <button
                      type="button"
                      onClick={suggestExpansion}
                      disabled={aiSuggesting || !form.trigger.trim()}
                      className="flex items-center gap-1 text-[10px] text-violet-400 hover:text-violet-300 disabled:opacity-30 transition-colors"
                    >
                      {aiSuggesting ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                      AI suggest
                    </button>
                  </div>
                  <textarea
                    placeholder="The full prompt that gets sent to NEXUS when this shortcut is triggered"
                    value={form.expansion}
                    onChange={e => setForm(f => ({ ...f, expansion: e.target.value }))}
                    required
                    rows={4}
                    className="nexus-input resize-none"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="nexus-input"
                />
                <div className="flex gap-2">
                  <button type="submit" disabled={submitting} className="nexus-btn-primary flex-1">
                    {submitting ? 'Saving…' : editingId ? 'Save Changes' : 'Create Shortcut'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); setEditingId(null) }}
                    className="nexus-btn-secondary px-4"
                  >
                    <X size={16} />
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* User shortcuts */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
            </div>
          ) : shortcuts.length === 0 && !showForm ? (
            <div className="text-center py-10 glass-panel rounded-2xl">
              <Zap size={36} className="text-white/15 mx-auto mb-3" />
              <p className="text-white/40 text-sm">No shortcuts yet</p>
              <p className="text-white/25 text-xs mt-1">Create one above or add from built-in templates below</p>
            </div>
          ) : (
            shortcuts.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-white/30 text-xs uppercase tracking-wider nexus-mono px-1">Your Shortcuts ({shortcuts.length})</h2>
                {shortcuts.map(s => (
                  <div key={s.id} className="glass-panel-hover rounded-xl p-4 group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <code className="text-cyan-400 text-sm font-mono bg-cyan-400/10 px-2 py-0.5 rounded-md">{s.trigger}</code>
                          {s.useCount > 0 && (
                            <span className="text-white/25 text-[10px] flex items-center gap-0.5">
                              <Play size={8} /> {s.useCount}x
                            </span>
                          )}
                        </div>
                        {s.description && <p className="text-white/50 text-xs mb-1.5">{s.description}</p>}
                        <p className="text-white/35 text-xs line-clamp-2">{s.expansion}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleCopy(s.expansion, s.id)}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-white/30 hover:text-cyan-400 hover:bg-cyan-400/10 transition-all"
                          title="Copy expansion"
                        >
                          {copied === s.id ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                        </button>
                        <button
                          onClick={() => startEdit(s)}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-white/30 hover:text-cyan-400 hover:bg-cyan-400/10 transition-all"
                          title="Edit"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
                          disabled={deletingId === s.id}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-all"
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                        <button
                          onClick={() => handleRun(s)}
                          className="flex items-center gap-1.5 px-3 h-7 rounded-md bg-cyan-400/15 text-cyan-400 text-xs font-medium hover:bg-cyan-400/25 transition-all"
                          title="Run shortcut in chat"
                        >
                          <Play size={11} />
                          Run
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[10px] text-white/20">
                      <Clock size={9} />
                      {timeAgo(s.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Built-in templates */}
          {availableBuiltins.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-white/30 text-xs uppercase tracking-wider nexus-mono px-1 flex items-center gap-2">
                <BookOpen size={11} />
                Built-in Templates
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {availableBuiltins.map(b => (
                  <div key={b.trigger} className="glass-panel rounded-xl p-4 flex items-start justify-between gap-3 group">
                    <div className="flex-1 min-w-0">
                      <code className="text-cyan-400/70 text-sm font-mono">{b.trigger}</code>
                      <p className="text-white/40 text-xs mt-0.5">{b.description}</p>
                    </div>
                    <button
                      onClick={() => addBuiltin(b)}
                      className="flex items-center gap-1 text-xs text-white/40 hover:text-cyan-400 border border-white/10 hover:border-cyan-400/30 px-2.5 py-1 rounded-lg transition-all flex-shrink-0"
                    >
                      <Plus size={11} />
                      Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
