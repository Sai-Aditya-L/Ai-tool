'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Brain, Plus, Trash2, X, Search } from 'lucide-react'
import { cn, formatRelativeTime } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Memory {
  id: string
  category: string
  key: string
  value: string
  source: string
  updatedAt: string
}

const CATEGORIES = ['preferences', 'goals', 'routines', 'dates', 'contacts', 'projects', 'technical', 'personal', 'work', 'other']

const CATEGORY_COLORS: Record<string, string> = {
  preferences: 'text-cyan-400 bg-cyan-400/10',
  goals: 'text-violet-400 bg-violet-400/10',
  routines: 'text-blue-400 bg-blue-400/10',
  dates: 'text-yellow-400 bg-yellow-400/10',
  contacts: 'text-green-400 bg-green-400/10',
  projects: 'text-orange-400 bg-orange-400/10',
  technical: 'text-pink-400 bg-pink-400/10',
  personal: 'text-purple-400 bg-purple-400/10',
  work: 'text-indigo-400 bg-indigo-400/10',
  other: 'text-white/40 bg-white/5',
}

export default function MemoryPage() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filterCategory, setFilterCategory] = useState('')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ category: 'preferences', key: '', value: '' })

  useEffect(() => { fetchMemories() }, [filterCategory])

  async function fetchMemories() {
    setLoading(true)
    try {
      const params = filterCategory ? `?category=${filterCategory}` : ''
      const res = await fetch(`/api/memory${params}`)
      const data = await res.json()
      setMemories(data.memories || [])
    } catch {
      toast.error('Failed to load memory')
    } finally {
      setLoading(false)
    }
  }

  async function saveMemory(e: React.FormEvent) {
    e.preventDefault()
    if (!form.key || !form.value) return
    try {
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      toast.success('Memory saved')
      setForm({ category: 'preferences', key: '', value: '' })
      setShowForm(false)
      fetchMemories()
    } catch {
      toast.error('Failed to save memory')
    }
  }

  async function deleteMemory(id: string) {
    if (!confirm('Delete this memory?')) return
    try {
      await fetch(`/api/memory/${id}`, { method: 'DELETE' })
      setMemories(prev => prev.filter(m => m.id !== id))
      toast.success('Memory deleted')
    } catch {
      toast.error('Failed to delete memory')
    }
  }

  const filtered = memories.filter(m =>
    !search ||
    m.key.toLowerCase().includes(search.toLowerCase()) ||
    m.value.toLowerCase().includes(search.toLowerCase())
  )

  const grouped = filtered.reduce((acc, m) => {
    if (!acc[m.category]) acc[m.category] = []
    acc[m.category].push(m)
    return acc
  }, {} as Record<string, Memory[]>)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Memory" subtitle={`${memories.length} stored memories`} />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-4">

          {/* Info banner */}
          <div className="glass-panel rounded-xl p-4 border border-violet-500/20 flex items-start gap-3">
            <Brain size={18} className="text-violet-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-white/70 text-sm font-medium">NEXUS Memory System</p>
              <p className="text-white/40 text-xs mt-0.5">
                NEXUS learns and remembers your preferences, goals, and context to personalize your experience.
                You have full control — view, edit, or delete any stored memory at any time.
              </p>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowForm(!showForm)}
              className="nexus-btn-primary flex items-center gap-2 text-sm"
            >
              <Plus size={16} />
              Add Memory
            </button>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                placeholder="Search memories..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="nexus-input pl-9 text-sm py-2 w-48"
              />
            </div>
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="nexus-input w-auto text-xs py-2"
            >
              <option value="">All categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Form */}
          {showForm && (
            <div className="glass-panel rounded-2xl p-5">
              <h3 className="text-white font-medium mb-4">Store Memory</h3>
              <form onSubmit={saveMemory} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="nexus-input"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                  <input
                    type="text"
                    placeholder="Memory key (e.g. preferred_theme)"
                    value={form.key}
                    onChange={e => setForm(f => ({ ...f, key: e.target.value.replace(/\s+/g, '_').toLowerCase() }))}
                    required
                    className="nexus-input"
                  />
                </div>
                <textarea
                  placeholder="Memory value / content *"
                  value={form.value}
                  onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                  required
                  rows={3}
                  className="nexus-input resize-none"
                />
                <div className="flex gap-2">
                  <button type="submit" className="nexus-btn-primary flex-1">Save Memory</button>
                  <button type="button" onClick={() => setShowForm(false)} className="nexus-btn-secondary px-4">
                    <X size={16} />
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Memories grouped by category */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
            </div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="text-center py-16 glass-panel rounded-2xl">
              <Brain size={40} className="text-white/20 mx-auto mb-3" />
              <p className="text-white/40 font-medium">No memories stored yet</p>
              <p className="text-white/25 text-sm mt-1">NEXUS will remember things as you interact with it</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped).map(([category, mems]) => (
                <div key={category} className="glass-panel rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-white/5 flex items-center gap-2">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', CATEGORY_COLORS[category] || CATEGORY_COLORS.other)}>
                      {category}
                    </span>
                    <span className="text-white/30 text-xs">{mems.length} entries</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {mems.map(m => (
                      <div key={m.id} className="px-4 py-3 flex items-start justify-between gap-3 hover:bg-white/2 group">
                        <div className="flex-1 min-w-0">
                          <p className="text-white/60 text-xs nexus-mono mb-0.5">{m.key}</p>
                          <p className="text-white/80 text-sm">{m.value}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-white/25 text-[10px] hidden group-hover:block">{formatRelativeTime(m.updatedAt)}</span>
                          <span className="text-white/20 text-[10px] nexus-mono">{m.source}</span>
                          <button
                            onClick={() => deleteMemory(m.id)}
                            className="text-white/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
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
