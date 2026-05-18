'use client'

import { useState, useEffect, useMemo } from 'react'
import { Header } from '@/components/layout/header'
import { Code2, Plus, Search, Pin, Trash2, Copy, Tag, Check, X, Sparkles, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Snippet {
  id: string
  title: string
  language: string
  tags: string
  code: string
  pinned: boolean
  createdAt: string
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const LANGUAGES = ['All', 'JavaScript', 'TypeScript', 'Python', 'Bash', 'SQL', 'JSON', 'CSS', 'HTML', 'Other']

const LANG_COLORS: Record<string, string> = {
  javascript: 'text-yellow-400',
  typescript: 'text-blue-400',
  python:     'text-green-400',
  bash:       'text-gray-400',
  sql:        'text-orange-400',
  json:       'text-cyan-400',
  css:        'text-pink-400',
  html:       'text-red-400',
  default:    'text-white/50',
}

const LANG_BG: Record<string, string> = {
  javascript: 'bg-yellow-400/10 border-yellow-400/30',
  typescript: 'bg-blue-400/10 border-blue-400/30',
  python:     'bg-green-400/10 border-green-400/30',
  bash:       'bg-gray-400/10 border-gray-400/30',
  sql:        'bg-orange-400/10 border-orange-400/30',
  json:       'bg-cyan-400/10 border-cyan-400/30',
  css:        'bg-pink-400/10 border-pink-400/30',
  html:       'bg-red-400/10 border-red-400/30',
  default:    'bg-white/5 border-white/15',
}

function getLangColor(lang: string): string {
  return LANG_COLORS[lang.toLowerCase()] ?? LANG_COLORS.default
}

function getLangBg(lang: string): string {
  return LANG_BG[lang.toLowerCase()] ?? LANG_BG.default
}

function previewLines(code: string, n = 5): string {
  return code.split('\n').slice(0, n).join('\n')
}

// ─── New Snippet Modal ─────────────────────────────────────────────────────────

interface NewSnippetModalProps {
  onClose: () => void
  onSaved: (snippet: Snippet) => void
}

function NewSnippetModal({ onClose, onSaved }: NewSnippetModalProps) {
  const [form, setForm] = useState({
    title: '',
    language: 'JavaScript',
    tags: '',
    code: '',
  })
  const [saving, setSaving] = useState(false)

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.code.trim()) {
      toast.error('Title and code are required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/snippets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          language: form.language,
          tags: form.tags.trim(),
          code: form.code,
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      toast.success('Snippet saved!')
      onSaved(data.snippet ?? data)
      onClose()
    } catch {
      toast.error('Failed to save snippet')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={handleBackdrop}
    >
      <div className="glass-panel rounded-2xl p-6 w-full max-w-2xl shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <Plus size={16} className="text-cyan-400" />
            New Snippet
          </h2>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-3">
          <input
            type="text"
            placeholder="Title *"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            required
            className="nexus-input"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={form.language}
              onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
              className="nexus-input"
            >
              {LANGUAGES.filter(l => l !== 'All').map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Tags (comma-separated)"
              value={form.tags}
              onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
              className="nexus-input"
            />
          </div>
          <textarea
            placeholder="Paste your code here *"
            value={form.code}
            onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
            rows={12}
            required
            className="w-full px-4 py-3 rounded-lg outline-none transition-all text-cyan-400 placeholder-white/20 resize-none nexus-mono text-sm"
            style={{
              background: 'rgba(0,4,12,0.97)',
              border: '1px solid rgba(0,229,255,0.2)',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          />
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving} className="nexus-btn-primary flex-1">
              {saving ? 'Saving…' : 'SAVE SNIPPET'}
            </button>
            <button type="button" onClick={onClose} className="nexus-btn-secondary px-5">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Snippet Card ──────────────────────────────────────────────────────────────

interface SnippetCardProps {
  snippet: Snippet
  onPin: (id: string, pinned: boolean) => void
  onDelete: (id: string) => void
  onCopy: (code: string) => void
}

function SnippetCard({ snippet, onPin, onDelete, onCopy }: SnippetCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [aiResult, setAiResult] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiAction, setAiAction] = useState<'explain' | 'optimize' | null>(null)
  const tags = snippet.tags ? snippet.tags.split(',').map(t => t.trim()).filter(Boolean) : []

  async function runAI(action: 'explain' | 'optimize', e: React.MouseEvent) {
    e.stopPropagation()
    setAiAction(action)
    setAiLoading(true)
    setAiResult('')
    if (!expanded) setExpanded(true)
    try {
      const prompt = action === 'explain'
        ? `Explain this ${snippet.language} code concisely in plain English. Describe what it does, key concepts, and any gotchas:\n\n\`\`\`${snippet.language.toLowerCase()}\n${snippet.code}\n\`\`\``
        : `Optimize this ${snippet.language} code for performance, readability, and best practices. Return the improved code with a brief explanation of changes:\n\n\`\`\`${snippet.language.toLowerCase()}\n${snippet.code}\n\`\`\``
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json()
      setAiResult(data.message ?? data.content ?? 'No response')
    } catch {
      setAiResult('AI request failed')
    } finally {
      setAiLoading(false)
    }
  }

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation()
    onCopy(snippet.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handlePin(e: React.MouseEvent) {
    e.stopPropagation()
    onPin(snippet.id, !snippet.pinned)
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    onDelete(snippet.id)
  }

  return (
    <div
      className={cn(
        'glass-panel-hover rounded-xl transition-all cursor-pointer',
        snippet.pinned && 'ring-1 ring-yellow-400/20'
      )}
      onClick={() => setExpanded(e => !e)}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {snippet.pinned && (
                <Pin size={11} className="text-yellow-400 flex-shrink-0" style={{ fill: 'currentColor' }} />
              )}
              <h3 className="text-white/90 text-sm font-medium truncate">{snippet.title}</h3>
            </div>
            <span className={cn(
              'inline-block text-[10px] px-2 py-0.5 rounded-full border font-medium nexus-mono',
              getLangColor(snippet.language),
              getLangBg(snippet.language)
            )}>
              {snippet.language}
            </span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <button
              onClick={handlePin}
              className={cn(
                'p-1.5 rounded-lg transition-all',
                snippet.pinned
                  ? 'text-yellow-400 hover:text-yellow-300'
                  : 'text-white/20 hover:text-yellow-400'
              )}
              title={snippet.pinned ? 'Unpin' : 'Pin'}
            >
              <Pin size={13} />
            </button>
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg text-white/20 hover:text-cyan-400 transition-all"
              title="Copy code"
            >
              {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
            </button>
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-lg text-white/20 hover:text-red-400 transition-all"
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
            <button
              onClick={e => runAI('explain', e)}
              disabled={aiLoading}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border border-violet-400/20 bg-violet-400/8 text-violet-400/70 hover:text-violet-400 hover:bg-violet-400/15 transition-all disabled:opacity-30"
              title="AI Explain"
            >
              {aiLoading && aiAction === 'explain' ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
              Explain
            </button>
            <button
              onClick={e => runAI('optimize', e)}
              disabled={aiLoading}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border border-cyan-400/20 bg-cyan-400/8 text-cyan-400/70 hover:text-cyan-400 hover:bg-cyan-400/15 transition-all disabled:opacity-30"
              title="AI Optimize"
            >
              {aiLoading && aiAction === 'optimize' ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
              Optimize
            </button>
          </div>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {tags.map(tag => (
              <span key={tag} className="flex items-center gap-1 text-[10px] text-white/40 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-full">
                <Tag size={8} />
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Code preview */}
        <pre
          className="rounded-lg p-3 text-xs overflow-hidden nexus-mono text-cyan-400 leading-relaxed"
          style={{
            background: 'rgba(0,4,12,0.97)',
            border: '1px solid rgba(0,229,255,0.1)',
            maxHeight: expanded ? 'none' : '90px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {expanded ? snippet.code : previewLines(snippet.code)}
        </pre>

        {expanded && (
          <div className="mt-3 space-y-3">
            <div className="flex justify-end">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs text-cyan-400/60 hover:text-cyan-400 transition-colors nexus-btn-secondary py-1.5 px-3"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copied!' : 'Copy All'}
              </button>
            </div>
            {(aiLoading || aiResult) && (
              <div className="rounded-lg border border-violet-400/15 bg-violet-400/5 p-3">
                <div className="flex items-center gap-2 mb-2">
                  {aiLoading ? <Loader2 size={11} className="animate-spin text-violet-400" /> : <Sparkles size={11} className="text-violet-400" />}
                  <span className="text-violet-400/70 text-[10px] font-medium uppercase tracking-wider">
                    {aiAction === 'explain' ? 'Explanation' : 'Optimized Code'}
                  </span>
                  {aiResult && (
                    <button
                      onClick={e => { e.stopPropagation(); setAiResult(''); setAiAction(null) }}
                      className="ml-auto text-white/25 hover:text-white/50 transition-colors"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
                {aiLoading ? (
                  <div className="space-y-1.5">
                    {[80, 65, 72].map((w, i) => <div key={i} className="h-2 bg-white/8 rounded animate-pulse" style={{ width: `${w}%` }} />)}
                  </div>
                ) : (
                  <pre className="text-white/65 text-xs leading-relaxed whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">{aiResult}</pre>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function SnippetsPage() {
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [langFilter, setLangFilter] = useState('All')
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    fetchSnippets()
  }, [])

  async function fetchSnippets() {
    setLoading(true)
    try {
      const res = await fetch('/api/snippets')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSnippets(data.snippets ?? data ?? [])
    } catch {
      toast.error('Failed to load snippets')
    } finally {
      setLoading(false)
    }
  }

  async function handlePin(id: string, pinned: boolean) {
    // Optimistic
    setSnippets(prev => prev.map(s => s.id === id ? { ...s, pinned } : s))
    try {
      const res = await fetch('/api/snippets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, pinned }),
      })
      if (!res.ok) throw new Error()
    } catch {
      // Rollback
      setSnippets(prev => prev.map(s => s.id === id ? { ...s, pinned: !pinned } : s))
      toast.error('Failed to update snippet')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this snippet?')) return
    const prev = snippets
    setSnippets(s => s.filter(x => x.id !== id))
    try {
      const res = await fetch(`/api/snippets?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Snippet deleted')
    } catch {
      setSnippets(prev)
      toast.error('Failed to delete snippet')
    }
  }

  function handleCopy(code: string) {
    navigator.clipboard.writeText(code).then(() => toast.success('Copied!'))
  }

  function handleSaved(snippet: Snippet) {
    setSnippets(prev => [snippet, ...prev])
  }

  // ── Filtered & sorted snippets ──────────────────────────────────────────────

  const displayed = useMemo(() => {
    let list = [...snippets]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(s =>
        s.title.toLowerCase().includes(q) ||
        (s.tags && s.tags.toLowerCase().includes(q))
      )
    }
    if (langFilter !== 'All') {
      list = list.filter(s => s.language.toLowerCase() === langFilter.toLowerCase())
    }
    // Pinned first
    list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
    return list
  }, [snippets, search, langFilter])

  const totalSnippets = snippets.length
  const pinnedCount   = snippets.filter(s => s.pinned).length
  const langsUsed     = new Set(snippets.map(s => s.language.toLowerCase())).size

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="SNIPPETS VAULT" subtitle="Your personal code library" />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-6xl mx-auto space-y-5">

          {/* Top bar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="flex items-center gap-2 flex-1 min-w-[200px] px-3 py-2.5 rounded-lg border border-cyan-400/15 bg-white/3 focus-within:border-cyan-400/30 transition-all">
              <Search size={14} className="text-white/30 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search by title or tags…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-transparent text-sm text-white/70 placeholder-white/25 outline-none flex-1"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-white/30 hover:text-white/60 transition-colors">
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Language filter */}
            <select
              value={langFilter}
              onChange={e => setLangFilter(e.target.value)}
              className="nexus-input w-auto text-sm py-2.5 px-3"
            >
              {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>

            {/* New snippet button */}
            <button
              onClick={() => setShowModal(true)}
              className="nexus-btn-primary flex items-center gap-2 text-sm"
            >
              <Plus size={16} />
              NEW SNIPPET
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Snippets', value: totalSnippets, icon: <Code2 size={14} /> },
              { label: 'Pinned',         value: pinnedCount,   icon: <Pin size={14} /> },
              { label: 'Languages',      value: langsUsed,     icon: <Tag size={14} /> },
            ].map(stat => (
              <div key={stat.label} className="glass-panel rounded-xl p-4">
                <div className="flex items-center gap-2 text-cyan-400/60 mb-1">
                  {stat.icon}
                  <span className="text-white/40 text-[10px] uppercase tracking-widest">{stat.label}</span>
                </div>
                <p className="nexus-mono text-2xl font-bold text-cyan-400">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Snippets Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
            </div>
          ) : displayed.length === 0 ? (
            <div className="text-center py-16 glass-panel rounded-2xl">
              <Code2 size={40} className="text-white/20 mx-auto mb-3" />
              <p className="text-white/40 font-medium">
                {search || langFilter !== 'All' ? 'No snippets match your filters' : 'No snippets yet'}
              </p>
              <p className="text-white/25 text-sm mt-1">
                {search || langFilter !== 'All' ? 'Try adjusting your search' : 'Save your first code snippet above'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {displayed.map(snippet => (
                <SnippetCard
                  key={snippet.id}
                  snippet={snippet}
                  onPin={handlePin}
                  onDelete={handleDelete}
                  onCopy={handleCopy}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <NewSnippetModal
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
