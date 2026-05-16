'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Zap, Plus, Trash2, Play, BookOpen, Clock, Loader2 } from 'lucide-react'

interface NLShortcut {
  id: string
  trigger: string
  expansion: string
  description: string
  useCount: number
  createdAt: string
}

const LS_KEY = 'nexus_nl_shortcuts'

const BUILTIN_SHORTCUTS = [
  {
    trigger: 'morning briefing',
    expansion: 'Opens daily summary and lists today\'s tasks, calendar events, and priority items.',
    description: 'Start your day with a full overview',
  },
  {
    trigger: 'focus mode',
    expansion: 'Sets Do Not Disturb, creates a focus task with a timer, and logs the start time.',
    description: 'Enter deep work mode',
  },
  {
    trigger: 'end of day',
    expansion: 'Summarizes what was done today, lists incomplete tasks, and previews tomorrow\'s schedule.',
    description: 'Wind down and review progress',
  },
  {
    trigger: 'security check',
    expansion: 'Runs Sentinel agent scan: checks for anomalies, reviews recent activity, and reports threats.',
    description: 'Audit system security status',
  },
]

function loadShortcuts(): NLShortcut[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveShortcuts(shortcuts: NLShortcut[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LS_KEY, JSON.stringify(shortcuts))
}

function timeAgo(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export default function ShortcutsPage() {
  const [shortcuts, setShortcuts] = useState<NLShortcut[]>([])
  const [trigger, setTrigger] = useState('')
  const [expansion, setExpansion] = useState('')
  const [description, setDescription] = useState('')
  const [testing, setTesting] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, string>>({})
  const [lastUsedId, setLastUsedId] = useState<string | null>(null)

  useEffect(() => {
    setShortcuts(loadShortcuts())
  }, [])

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!trigger.trim() || !expansion.trim()) return
    const newShortcut: NLShortcut = {
      id: `sc_${Date.now()}`,
      trigger: trigger.trim().toLowerCase(),
      expansion: expansion.trim(),
      description: description.trim(),
      useCount: 0,
      createdAt: new Date().toISOString(),
    }
    const updated = [newShortcut, ...shortcuts]
    setShortcuts(updated)
    saveShortcuts(updated)
    setTrigger('')
    setExpansion('')
    setDescription('')
  }

  function handleDelete(id: string) {
    const updated = shortcuts.filter(s => s.id !== id)
    setShortcuts(updated)
    saveShortcuts(updated)
    setTestResults(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    if (lastUsedId === id) setLastUsedId(null)
  }

  async function handleTest(shortcut: NLShortcut) {
    setTesting(shortcut.id)
    setTestResults(prev => ({ ...prev, [shortcut.id]: '' }))

    // Increment use count
    const updated = shortcuts.map(s =>
      s.id === shortcut.id ? { ...s, useCount: s.useCount + 1 } : s
    )
    setShortcuts(updated)
    saveShortcuts(updated)
    setLastUsedId(shortcut.id)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: shortcut.trigger }],
        }),
      })
      if (!res.ok) {
        setTestResults(prev => ({ ...prev, [shortcut.id]: `Error ${res.status}: ${res.statusText}` }))
        return
      }

      // Handle streaming response
      const reader = res.body?.getReader()
      if (!reader) {
        setTestResults(prev => ({ ...prev, [shortcut.id]: 'No response body' }))
        return
      }

      const decoder = new TextDecoder()
      let accumulated = ''
      while (accumulated.length < 200) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
      }
      reader.cancel()

      // Strip any SSE formatting if present
      const clean = accumulated
        .split('\n')
        .filter(line => line.startsWith('data: '))
        .map(line => {
          try { return JSON.parse(line.slice(6))?.content ?? '' } catch { return '' }
        })
        .join('')
        || accumulated

      setTestResults(prev => ({
        ...prev,
        [shortcut.id]: clean.slice(0, 200) + (clean.length > 200 ? '…' : ''),
      }))
    } catch {
      setTestResults(prev => ({ ...prev, [shortcut.id]: 'Network error' }))
    } finally {
      setTesting(null)
    }
  }

  // Stats
  const totalShortcuts = shortcuts.length
  const mostUsed = shortcuts.reduce<NLShortcut | null>(
    (best, s) => (!best || s.useCount > best.useCount ? s : best),
    null
  )
  const lastUsed = lastUsedId ? shortcuts.find(s => s.id === lastUsedId) : null

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: 'rgba(0,4,12,0.97)' }}
    >
      <Header title="Command Shortcuts" subtitle="Define natural language shortcuts NEXUS will recognize" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-5">

          {/* Stats bar */}
          <div className="flex flex-wrap items-center gap-4 px-1">
            <div className="flex items-center gap-2 text-xs text-white/40">
              <Zap size={12} className="text-cyan-400" />
              <span>Total shortcuts: <span className="text-white/70">{totalShortcuts}</span></span>
            </div>
            {mostUsed && mostUsed.useCount > 0 && (
              <div className="flex items-center gap-2 text-xs text-white/40">
                <BookOpen size={12} className="text-cyan-400" />
                <span>Most used: <span className="text-cyan-400 font-mono">{mostUsed.trigger}</span> ({mostUsed.useCount}x)</span>
              </div>
            )}
            {lastUsed && (
              <div className="flex items-center gap-2 text-xs text-white/40">
                <Clock size={12} className="text-cyan-400" />
                <span>Last used: <span className="text-white/60">{timeAgo(new Date().toISOString())}</span></span>
              </div>
            )}
          </div>

          {/* How to use tip */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-cyan-400/5 border border-cyan-400/15">
            <Zap size={16} className="text-cyan-400 flex-shrink-0 mt-0.5" />
            <p className="text-white/50 text-xs leading-relaxed">
              <span className="text-cyan-400 font-medium">How to use: </span>
              Type any trigger phrase in AI Chat and NEXUS will expand it using your defined shortcut,
              executing the associated action automatically.
            </p>
          </div>

          {/* Add Shortcut form */}
          <div className="glass-panel rounded-2xl p-5 border border-cyan-400/10">
            <h3 className="text-white font-medium mb-4 flex items-center gap-2">
              <Plus size={16} className="text-cyan-400" />
              Add Shortcut
            </h3>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="text-white/50 text-xs mb-1 block">Trigger Phrase</label>
                <input
                  className="nexus-input w-full text-sm font-mono"
                  placeholder="e.g. morning routine, code review mode"
                  value={trigger}
                  onChange={e => setTrigger(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-white/50 text-xs mb-1 block">Expansion / Action</label>
                <textarea
                  className="nexus-input w-full text-sm resize-none"
                  rows={3}
                  placeholder="e.g. Create standup task, open calendar for today, set focus mode"
                  value={expansion}
                  onChange={e => setExpansion(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-white/50 text-xs mb-1 block">Description (optional)</label>
                <input
                  className="nexus-input w-full text-sm"
                  placeholder="Notes for yourself about this shortcut"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="nexus-btn-primary flex items-center gap-2 text-sm"
              >
                <Plus size={14} />
                Add Shortcut
              </button>
            </form>
          </div>

          {/* User shortcuts list */}
          {shortcuts.length > 0 && (
            <div>
              <p className="text-white/30 text-xs uppercase tracking-wider mb-3">Your Shortcuts</p>
              <div className="space-y-2">
                {shortcuts.map(sc => (
                  <div key={sc.id} className="glass-panel rounded-xl p-4 border border-white/5">
                    <div className="flex items-start gap-3">
                      <Zap size={16} className="text-cyan-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-cyan-400 font-mono text-sm font-medium">
                            {sc.trigger}
                          </span>
                          {sc.useCount > 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full border border-cyan-400/20 text-cyan-400/60">
                              {sc.useCount} use{sc.useCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-white/60 text-xs mt-1 leading-relaxed">{sc.expansion}</p>
                        {sc.description && (
                          <p className="text-white/30 text-xs mt-0.5">{sc.description}</p>
                        )}
                        {testResults[sc.id] !== undefined && (
                          <div className="mt-2 p-2 rounded-lg bg-white/5 border border-white/10">
                            <p className="text-white/50 text-[10px] uppercase tracking-wider mb-1">Response preview</p>
                            <p className="text-white/60 text-xs leading-relaxed">
                              {testResults[sc.id] || <span className="text-white/30 italic">Empty response</span>}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleTest(sc)}
                          disabled={testing === sc.id}
                          title="Test shortcut"
                          className="text-white/30 hover:text-cyan-400 transition-colors p-1.5 rounded-lg hover:bg-cyan-400/5 disabled:opacity-40 flex items-center gap-1 text-xs"
                        >
                          {testing === sc.id
                            ? <Loader2 size={12} className="animate-spin" />
                            : <Play size={12} />
                          }
                        </button>
                        <button
                          onClick={() => handleDelete(sc.id)}
                          title="Delete"
                          className="text-white/20 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-400/5"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Built-in shortcuts */}
          <div className="glass-panel rounded-2xl p-5">
            <h3 className="text-white font-medium mb-1 flex items-center gap-2">
              <BookOpen size={16} className="text-cyan-400" />
              Built-in Shortcuts
            </h3>
            <p className="text-white/30 text-xs mb-4">These shortcuts are always available — no setup needed.</p>
            <div className="space-y-3">
              {BUILTIN_SHORTCUTS.map(sc => (
                <div
                  key={sc.trigger}
                  className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5"
                >
                  <Zap size={14} className="text-cyan-400/60 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <span className="text-cyan-400/80 font-mono text-sm">{sc.trigger}</span>
                    <p className="text-white/50 text-xs mt-0.5 leading-relaxed">{sc.expansion}</p>
                    <p className="text-white/25 text-[10px] mt-0.5">{sc.description}</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 text-white/25 flex-shrink-0 mt-0.5">
                    built-in
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Empty state for user shortcuts */}
          {shortcuts.length === 0 && (
            <div className="glass-panel rounded-xl p-8 text-center border border-dashed border-white/10">
              <Zap size={32} className="text-white/10 mx-auto mb-3" />
              <p className="text-white/30 text-sm">No custom shortcuts yet.</p>
              <p className="text-white/20 text-xs mt-1">Add one above to get started.</p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
