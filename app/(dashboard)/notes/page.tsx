'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Plus, StickyNote, Pin, PinOff, Trash2, X, Search, Edit3, Save, Eye, CheckSquare, Check, Sparkles, Loader2, Tag } from 'lucide-react'
import { cn, formatRelativeTime, parseTags } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Note {
  id: string
  title: string
  content: string
  tags?: string
  pinned: boolean
  color?: string
  updatedAt: string
}

const NOTE_COLORS = [
  { label: 'Default', value: '' },
  { label: 'Cyan', value: 'cyan' },
  { label: 'Violet', value: 'violet' },
  { label: 'Gold', value: 'gold' },
  { label: 'Green', value: 'green' },
  { label: 'Red', value: 'red' },
]

const COLOR_CLASSES: Record<string, string> = {
  '': 'border-cyan-400/10',
  cyan: 'border-cyan-400/30 bg-cyan-400/3',
  violet: 'border-violet-500/30 bg-violet-500/3',
  gold: 'border-yellow-400/30 bg-yellow-400/3',
  green: 'border-green-400/30 bg-green-400/3',
  red: 'border-red-400/30 bg-red-400/3',
}

// ── Markdown renderer (no dangerouslySetInnerHTML) ───────────────────────────
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n')
  const nodes: React.ReactNode[] = []
  let i = 0

  function parseInline(raw: string, key: string): React.ReactNode {
    // Split on bold (**text**), italic (*text*), code (`code`)
    const parts = raw.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/)
    return (
      <span key={key}>
        {parts.map((part, idx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={idx}>{part.slice(2, -2)}</strong>
          }
          if (part.startsWith('*') && part.endsWith('*')) {
            return <em key={idx}>{part.slice(1, -1)}</em>
          }
          if (part.startsWith('`') && part.endsWith('`')) {
            return (
              <code key={idx} style={{ fontFamily: 'monospace', background: 'rgba(0,212,255,0.1)', padding: '1px 4px', borderRadius: 3, fontSize: '0.9em' }}>
                {part.slice(1, -1)}
              </code>
            )
          }
          return part
        })}
      </span>
    )
  }

  while (i < lines.length) {
    const line = lines[i]

    // Headings
    if (line.startsWith('### ')) {
      nodes.push(<h3 key={i} style={{ fontSize: '1em', fontWeight: 600, color: 'rgba(255,255,255,0.85)', margin: '8px 0 4px' }}>{parseInline(line.slice(4), `h3-${i}`)}</h3>)
      i++
      continue
    }
    if (line.startsWith('## ')) {
      nodes.push(<h2 key={i} style={{ fontSize: '1.1em', fontWeight: 600, color: 'rgba(255,255,255,0.9)', margin: '10px 0 4px' }}>{parseInline(line.slice(3), `h2-${i}`)}</h2>)
      i++
      continue
    }
    if (line.startsWith('# ')) {
      nodes.push(<h1 key={i} style={{ fontSize: '1.25em', fontWeight: 700, color: '#fff', margin: '12px 0 6px' }}>{parseInline(line.slice(2), `h1-${i}`)}</h1>)
      i++
      continue
    }

    // Unordered list: collect consecutive `- ` or `* ` lines
    if (/^[-*] /.test(line)) {
      const items: React.ReactNode[] = []
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(<li key={i} style={{ marginLeft: 16, color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem' }}>{parseInline(lines[i].slice(2), `li-${i}`)}</li>)
        i++
      }
      nodes.push(<ul key={`ul-${i}`} style={{ listStyleType: 'disc', paddingLeft: 8, margin: '4px 0' }}>{items}</ul>)
      continue
    }

    // Ordered list: collect consecutive `N. ` lines
    if (/^\d+\. /.test(line)) {
      const items: React.ReactNode[] = []
      let num = 1
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        const content = lines[i].replace(/^\d+\. /, '')
        items.push(<li key={i} style={{ marginLeft: 16, color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem' }}>{parseInline(content, `oli-${i}`)}</li>)
        i++
        num++
      }
      nodes.push(<ol key={`ol-${i}`} style={{ listStyleType: 'decimal', paddingLeft: 8, margin: '4px 0' }}>{items}</ol>)
      continue
    }

    // Empty line → spacing
    if (line.trim() === '') {
      nodes.push(<br key={i} />)
      i++
      continue
    }

    // Regular paragraph line
    nodes.push(
      <p key={i} style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', lineHeight: '1.6', margin: '2px 0' }}>
        {parseInline(line, `p-${i}`)}
      </p>
    )
    i++
  }

  return nodes
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ title: '', content: '', tags: '', color: '' })
  const [previewMode, setPreviewMode] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [aiResult, setAiResult] = useState<string | null>(null)
  const [aiAction, setAiAction] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const searchParams = useSearchParams()
  useEffect(() => { fetchNotes() }, [search])
  useEffect(() => { if (searchParams?.get('new') === '1') setShowForm(true) }, [searchParams])

  // Reset preview mode when form closes or a different note is opened
  useEffect(() => {
    if (!showForm) setPreviewMode(false)
  }, [showForm])

  async function fetchNotes() {
    setLoading(true)
    try {
      const params = search ? `?q=${encodeURIComponent(search)}` : ''
      const res = await fetch(`/api/notes${params}`)
      const data = await res.json()
      setNotes(data.notes || [])
    } catch {
      toast.error('Failed to load notes')
    } finally {
      setLoading(false)
    }
  }

  async function saveNote(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    try {
      const method = editingNote ? 'PATCH' : 'POST'
      const url = editingNote ? `/api/notes/${editingNote.id}` : '/api/notes'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      toast.success(editingNote ? 'Note updated' : 'Note created')
      setForm({ title: '', content: '', tags: '', color: '' })
      setShowForm(false)
      setEditingNote(null)
      setPreviewMode(false)
      fetchNotes()
    } catch {
      toast.error('Failed to save note')
    }
  }

  async function togglePin(id: string, pinned: boolean) {
    try {
      await fetch(`/api/notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: !pinned }),
      })
      setNotes(prev => prev.map(n => n.id === id ? { ...n, pinned: !pinned } : n))
    } catch {
      toast.error('Failed to update note')
    }
  }

  async function deleteNote(id: string) {
    if (!confirm('Delete this note?')) return
    try {
      await fetch(`/api/notes/${id}`, { method: 'DELETE' })
      setNotes(prev => prev.filter(n => n.id !== id))
      toast.success('Note deleted')
    } catch {
      toast.error('Failed to delete note')
    }
  }

  async function runNoteAI(action: string) {
    if (!editingNote?.id) return
    setAiLoading(true)
    setAiAction(action)
    setAiResult(null)
    try {
      const res = await fetch(`/api/notes/${editingNote.id}/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (action === 'tags' && data.tags?.length) {
        const existing = form.tags ? form.tags.split(',').map((t: string) => t.trim()) : []
        const merged = Array.from(new Set([...existing, ...data.tags])).join(', ')
        setForm(f => ({ ...f, tags: merged }))
        toast.success('Tags added!')
      } else {
        setAiResult(data.result)
      }
    } catch {
      toast.error('AI action failed')
    } finally {
      setAiLoading(false)
    }
  }

  function applyAiResult() {
    if (!aiResult) return
    if (aiAction === 'summarize') {
      setForm(f => ({ ...f, content: f.content + '\n\n---\n**Summary:** ' + aiResult }))
    } else if (aiAction === 'actions') {
      setForm(f => ({ ...f, content: f.content + '\n\n---\n**Action Items:**\n' + aiResult }))
    } else if (aiAction === 'expand' || aiAction === 'rewrite') {
      setForm(f => ({ ...f, content: aiResult }))
    }
    setAiResult(null)
    setAiAction(null)
    toast.success('Applied to note')
  }

  function startEditing(note: Note) {
    if (selectMode) {
      toggleSelect(note.id)
      return
    }
    setEditingNote(note)
    setForm({ title: note.title, content: note.content, tags: note.tags || '', color: note.color || '' })
    setPreviewMode(false)
    setShowForm(true)
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function bulkPin(action: 'pin' | 'unpin') {
    const ids = Array.from(selectedIds)
    try {
      const res = await fetch('/api/notes/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids }),
      })
      if (!res.ok) throw new Error()
      toast.success(`${ids.length} note${ids.length !== 1 ? 's' : ''} ${action === 'pin' ? 'pinned' : 'unpinned'}`)
      setSelectedIds(new Set())
      setSelectMode(false)
      fetchNotes()
    } catch {
      toast.error(`Failed to ${action} notes`)
    }
  }

  async function bulkDelete() {
    const ids = Array.from(selectedIds)
    if (!confirm(`Delete ${ids.length} note${ids.length !== 1 ? 's' : ''}? This cannot be undone.`)) return
    try {
      const res = await fetch('/api/notes/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', ids }),
      })
      if (!res.ok) throw new Error()
      toast.success(`${ids.length} note${ids.length !== 1 ? 's' : ''} deleted`)
      setSelectedIds(new Set())
      setSelectMode(false)
      fetchNotes()
    } catch {
      toast.error('Failed to delete notes')
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Notes" subtitle={`${notes.length} notes`} />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-5xl mx-auto space-y-4">

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => { setEditingNote(null); setForm({ title: '', content: '', tags: '', color: '' }); setPreviewMode(false); setShowForm(!showForm) }}
              className="nexus-btn-primary flex items-center gap-2 text-sm"
            >
              <Plus size={16} />
              New Note
            </button>
            <button
              onClick={() => { setSelectMode(m => !m); setSelectedIds(new Set()) }}
              className={cn(
                'flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border transition-all',
                selectMode
                  ? 'bg-cyan-400/15 border-cyan-400/30 text-cyan-400'
                  : 'text-white/40 border-white/10 hover:border-white/20 hover:text-white/60'
              )}
            >
              <CheckSquare size={14} />
              Select
            </button>
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                placeholder="Search notes..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="nexus-input pl-9 text-sm py-2"
              />
            </div>
          </div>

          {/* Form */}
          {showForm && (
            <div className="glass-panel rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-medium">
                  {editingNote ? 'Edit Note' : 'New Note'}
                </h3>
                {/* Edit / Preview toggle */}
                <div className="flex rounded-lg border border-white/10 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setPreviewMode(false)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 text-xs transition-all border-r border-white/10',
                      !previewMode ? 'bg-cyan-400/20 text-cyan-400' : 'text-white/50 hover:text-white/70 hover:bg-white/5'
                    )}
                  >
                    <Edit3 size={11} />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode(true)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 text-xs transition-all',
                      previewMode ? 'bg-cyan-400/20 text-cyan-400' : 'text-white/50 hover:text-white/70 hover:bg-white/5'
                    )}
                  >
                    <Eye size={11} />
                    Preview
                  </button>
                </div>
              </div>
              <form onSubmit={saveNote} className="space-y-3">
                <input
                  type="text"
                  placeholder="Note title *"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  required
                  className="nexus-input"
                  autoFocus={!previewMode}
                />

                {previewMode ? (
                  /* Markdown preview panel */
                  <div
                    className="w-full min-h-[130px] rounded-lg p-4 overflow-auto"
                    style={{
                      background: 'rgba(10, 10, 26, 0.8)',
                      border: '1px solid rgba(0, 212, 255, 0.15)',
                      minHeight: 130,
                    }}
                  >
                    {form.content.trim() === '' ? (
                      <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.875rem' }}>Nothing to preview yet…</p>
                    ) : (
                      renderMarkdown(form.content)
                    )}
                  </div>
                ) : (
                  <textarea
                    placeholder="Note content... (supports **bold**, *italic*, # headings, - lists, `code`)"
                    value={form.content}
                    onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                    rows={5}
                    className="nexus-input resize-none"
                  />
                )}

                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Tags (comma separated)"
                    value={form.tags}
                    onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                    className="nexus-input"
                  />
                  <select
                    value={form.color}
                    onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                    className="nexus-input"
                  >
                    {NOTE_COLORS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                {/* AI Actions (only for existing notes with content) */}
                {editingNote && form.content.trim() && (
                  <div className="space-y-2">
                    <div className="flex gap-1.5 flex-wrap">
                      {[
                        { key: 'summarize', label: 'Summarize' },
                        { key: 'actions', label: 'Action Items' },
                        { key: 'expand', label: 'Expand' },
                        { key: 'rewrite', label: 'Rewrite' },
                        { key: 'tags', label: 'Auto-tag', icon: <Tag size={10} /> },
                      ].map(({ key, label, icon }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => runNoteAI(key)}
                          disabled={aiLoading}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-violet-400/20 bg-violet-400/5 text-violet-400/80 text-[11px] hover:bg-violet-400/12 transition-all disabled:opacity-30"
                        >
                          {aiLoading && aiAction === key ? <Loader2 size={10} className="animate-spin" /> : icon ?? <Sparkles size={10} />}
                          {label}
                        </button>
                      ))}
                    </div>
                    {aiResult && (
                      <div className="p-3 rounded-lg border border-violet-400/20 bg-violet-400/5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-violet-400 text-[10px] nexus-mono uppercase">{aiAction}</span>
                          <div className="flex gap-2">
                            <button type="button" onClick={applyAiResult} className="text-cyan-400 text-[10px] hover:underline">Apply</button>
                            <button type="button" onClick={() => { setAiResult(null); setAiAction(null) }} className="text-white/30 text-[10px] hover:text-white/50">Dismiss</button>
                          </div>
                        </div>
                        <p className="text-white/65 text-xs leading-relaxed whitespace-pre-wrap">{aiResult}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <button type="submit" className="nexus-btn-primary flex-1 flex items-center justify-center gap-2">
                    <Save size={14} /> {editingNote ? 'Update Note' : 'Create Note'}
                  </button>
                  <button type="button" onClick={() => { setShowForm(false); setEditingNote(null); setPreviewMode(false) }} className="nexus-btn-secondary px-4">
                    <X size={16} />
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Notes grid */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-16 glass-panel rounded-2xl">
              <StickyNote size={40} className="text-white/20 mx-auto mb-3" />
              <p className="text-white/40 font-medium">{search ? 'No notes matching search' : 'No notes yet'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {notes.map(note => (
                <div
                  key={note.id}
                  className={cn(
                    'glass-panel-hover rounded-xl p-4 border flex flex-col gap-2 group cursor-pointer relative',
                    COLOR_CLASSES[note.color || ''] || COLOR_CLASSES[''],
                    selectMode && selectedIds.has(note.id) && 'ring-2 ring-cyan-400/50'
                  )}
                  onClick={() => startEditing(note)}
                >
                  {/* Select checkbox overlay */}
                  {selectMode && (
                    <div className="absolute top-2 left-2 z-10">
                      <div className={cn(
                        'w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
                        selectedIds.has(note.id)
                          ? 'bg-cyan-400/20 border-cyan-400'
                          : 'border-white/30 bg-black/30'
                      )}>
                        {selectedIds.has(note.id) && <Check size={12} className="text-cyan-400" />}
                      </div>
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-2">
                    <h3 className={cn('text-white/85 font-medium text-sm line-clamp-1', selectMode && 'pl-6')}>{note.title}</h3>
                    {!selectMode && (
                      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={e => { e.stopPropagation(); togglePin(note.id, note.pinned) }}
                          className={cn('p-1 rounded transition-colors', note.pinned ? 'text-cyan-400' : 'text-white/30 hover:text-white/60')}
                          title={note.pinned ? 'Unpin' : 'Pin'}
                        >
                          {note.pinned ? <Pin size={12} /> : <PinOff size={12} />}
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); startEditing(note) }}
                          className="p-1 rounded text-white/30 hover:text-cyan-400 transition-colors"
                        >
                          <Edit3 size={12} />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); deleteNote(note.id) }}
                          className="p-1 rounded text-white/30 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>

                  <p className="text-white/45 text-xs leading-relaxed line-clamp-4">{note.content}</p>

                  <div className="flex items-center justify-between mt-auto pt-1">
                    <div className="flex flex-wrap gap-1">
                      {parseTags(note.tags).slice(0, 3).map(tag => (
                        <span key={tag} className="text-[10px] text-cyan-400/50 bg-cyan-400/5 px-1.5 py-0.5 rounded">
                          #{tag}
                        </span>
                      ))}
                    </div>
                    <span className="text-white/20 text-[10px]">{formatRelativeTime(note.updatedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 glass-panel rounded-2xl px-5 py-3 flex items-center gap-3 shadow-2xl border border-cyan-400/20">
          <span className="text-white/60 text-sm nexus-mono">{selectedIds.size} selected</span>
          <button
            onClick={() => bulkPin('pin')}
            className="text-xs flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-cyan-400/30 text-cyan-400 hover:bg-cyan-400/10 transition-all"
          >
            <Pin size={13} /> Pin All
          </button>
          <button
            onClick={() => bulkPin('unpin')}
            className="text-xs flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-white/15 text-white/50 hover:bg-white/5 transition-all"
          >
            <PinOff size={13} /> Unpin All
          </button>
          <button
            onClick={bulkDelete}
            className="text-xs flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-red-400/30 text-red-400 hover:bg-red-400/10 transition-all"
          >
            <Trash2 size={13} /> Delete All
          </button>
          <button
            onClick={() => { setSelectedIds(new Set()); setSelectMode(false) }}
            className="text-white/40 hover:text-white/70 transition-colors p-1"
            title="Cancel"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
