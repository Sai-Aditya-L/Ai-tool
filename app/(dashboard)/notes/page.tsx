'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Plus, StickyNote, Pin, PinOff, Trash2, X, Search, Edit3, Save } from 'lucide-react'
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

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ title: '', content: '', tags: '', color: '' })

  useEffect(() => { fetchNotes() }, [search])

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

  function startEditing(note: Note) {
    setEditingNote(note)
    setForm({ title: note.title, content: note.content, tags: note.tags || '', color: note.color || '' })
    setShowForm(true)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Notes" subtitle={`${notes.length} notes`} />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-5xl mx-auto space-y-4">

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => { setEditingNote(null); setForm({ title: '', content: '', tags: '', color: '' }); setShowForm(!showForm) }}
              className="nexus-btn-primary flex items-center gap-2 text-sm"
            >
              <Plus size={16} />
              New Note
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
              <h3 className="text-white font-medium mb-4">
                {editingNote ? 'Edit Note' : 'New Note'}
              </h3>
              <form onSubmit={saveNote} className="space-y-3">
                <input
                  type="text"
                  placeholder="Note title *"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  required
                  className="nexus-input"
                  autoFocus
                />
                <textarea
                  placeholder="Note content..."
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  rows={5}
                  className="nexus-input resize-none"
                />
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
                <div className="flex gap-2">
                  <button type="submit" className="nexus-btn-primary flex-1 flex items-center justify-center gap-2">
                    <Save size={14} /> {editingNote ? 'Update Note' : 'Create Note'}
                  </button>
                  <button type="button" onClick={() => { setShowForm(false); setEditingNote(null) }} className="nexus-btn-secondary px-4">
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
                    'glass-panel-hover rounded-xl p-4 border flex flex-col gap-2 group cursor-pointer',
                    COLOR_CLASSES[note.color || ''] || COLOR_CLASSES['']
                  )}
                  onClick={() => startEditing(note)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-white/85 font-medium text-sm line-clamp-1">{note.title}</h3>
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
    </div>
  )
}
