'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  X,
  CheckSquare,
  Bell,
  FileText,
  Brain,
  File,
  Loader2,
  ChevronRight,
} from 'lucide-react'

// ---------- Types ----------

interface TaskResult {
  id: string
  title: string
  description?: string | null
  status: string
  priority: string
  tags?: string | null
}

interface ReminderResult {
  id: string
  title: string
  status: string
  priority: string
  dueAt: string
}

interface NoteResult {
  id: string
  title: string
  content: string
  tags?: string | null
  pinned: boolean
}

interface MemoryResult {
  id: string
  key: string
  value: string
  category: string
}

interface FileResult {
  id: string
  name: string
  originalName: string
  mimeType: string
  size: number
  tags?: string | null
}

interface SearchResults {
  tasks: TaskResult[]
  reminders: ReminderResult[]
  notes: NoteResult[]
  memories: MemoryResult[]
  files: FileResult[]
}

type FlatResult =
  | { type: 'task'; data: TaskResult }
  | { type: 'reminder'; data: ReminderResult }
  | { type: 'note'; data: NoteResult }
  | { type: 'memory'; data: MemoryResult }
  | { type: 'file'; data: FileResult }

// ---------- Helpers ----------

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function flattenResults(results: SearchResults): FlatResult[] {
  const flat: FlatResult[] = []
  results.tasks.forEach((d) => flat.push({ type: 'task', data: d }))
  results.reminders.forEach((d) => flat.push({ type: 'reminder', data: d }))
  results.notes.forEach((d) => flat.push({ type: 'note', data: d }))
  results.memories.forEach((d) => flat.push({ type: 'memory', data: d }))
  results.files.forEach((d) => flat.push({ type: 'file', data: d }))
  return flat
}

function getRoute(item: FlatResult) {
  switch (item.type) {
    case 'task': return '/tasks'
    case 'reminder': return '/reminders'
    case 'note': return '/notes'
    case 'memory': return '/memory'
    case 'file': return '/files'
  }
}

// ---------- Result item rendering ----------

const TYPE_META: Record<FlatResult['type'], { icon: React.ElementType; label: string; color: string }> = {
  task: { icon: CheckSquare, label: 'Task', color: 'text-cyan-400' },
  reminder: { icon: Bell, label: 'Reminder', color: 'text-violet-400' },
  note: { icon: FileText, label: 'Note', color: 'text-yellow-400' },
  memory: { icon: Brain, label: 'Memory', color: 'text-pink-400' },
  file: { icon: File, label: 'File', color: 'text-green-400' },
}

function ResultRow({
  item,
  isActive,
  onClick,
  onMouseEnter,
}: {
  item: FlatResult
  isActive: boolean
  onClick: () => void
  onMouseEnter: () => void
}) {
  const meta = TYPE_META[item.type]
  const Icon = meta.icon

  let title = ''
  let subtitle = ''

  if (item.type === 'task') {
    title = item.data.title
    const parts: string[] = []
    if (item.data.status) parts.push(item.data.status.replace('-', ' '))
    if (item.data.priority) parts.push(item.data.priority)
    if (item.data.tags) parts.push(item.data.tags)
    subtitle = parts.join(' · ')
  } else if (item.type === 'reminder') {
    title = item.data.title
    const due = new Date(item.data.dueAt).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric',
    })
    subtitle = `${item.data.status} · ${item.data.priority} · due ${due}`
  } else if (item.type === 'note') {
    title = item.data.title
    const preview = item.data.content.replace(/\n/g, ' ').slice(0, 80)
    subtitle = item.data.tags ? `${item.data.tags} · ${preview}` : preview
  } else if (item.type === 'memory') {
    title = item.data.key
    subtitle = `${item.data.category} · ${item.data.value.slice(0, 80)}`
  } else if (item.type === 'file') {
    title = item.data.originalName || item.data.name
    subtitle = `${item.data.mimeType} · ${formatBytes(item.data.size)}${item.data.tags ? ` · ${item.data.tags}` : ''}`
  }

  return (
    <button
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all group ${
        isActive
          ? 'bg-cyan-400/10 border-l-2 border-cyan-400'
          : 'border-l-2 border-transparent hover:bg-white/3'
      }`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      <div className={`flex-shrink-0 p-1.5 rounded-md ${isActive ? 'bg-cyan-400/15' : 'bg-white/5'}`}>
        <Icon size={14} className={meta.color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isActive ? 'text-white' : 'text-white/80'}`}>
          {title}
        </p>
        {subtitle && (
          <p className="text-xs text-white/35 truncate mt-0.5 nexus-mono">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-[10px] px-1.5 py-0.5 rounded nexus-mono ${isActive ? 'bg-cyan-400/20 text-cyan-300' : 'bg-white/5 text-white/25'}`}>
          {meta.label}
        </span>
        <ChevronRight size={12} className={`transition-opacity ${isActive ? 'text-cyan-400 opacity-100' : 'opacity-0'}`} />
      </div>
    </button>
  )
}

// ---------- Section header ----------

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-4 py-1.5 flex items-center gap-2">
      <span className="text-[10px] nexus-mono text-white/25 uppercase tracking-widest">{label}</span>
      <div className="flex-1 h-px bg-white/5" />
    </div>
  )
}

// ---------- Main component ----------

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  initialQuery?: string
}

export function CommandPalette({ isOpen, onClose, initialQuery = '' }: CommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Sync initial query
  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery)
      setResults(null)
      setActiveIndex(0)
    }
  }, [isOpen, initialQuery])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  // Global Cmd+K / Ctrl+K handler lives in SearchProvider via the context; we handle Escape here
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // Debounced search
  const doSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim()) {
      setResults(null)
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
        if (res.ok) {
          const data: SearchResults = await res.json()
          setResults(data)
          setActiveIndex(0)
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [])

  useEffect(() => {
    doSearch(query)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, doSearch])

  // Build flat list for keyboard nav
  const flatItems: FlatResult[] = results ? flattenResults(results) : []
  const totalResults = flatItems.length

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, totalResults - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && totalResults > 0) {
        e.preventDefault()
        const item = flatItems[activeIndex]
        if (item) navigate(item)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeIndex, totalResults, flatItems])

  // Scroll active item into view
  useEffect(() => {
    const el = containerRef.current?.querySelector(`[data-index="${activeIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  function navigate(item: FlatResult) {
    router.push(getRoute(item))
    onClose()
  }

  const hasResults = results && totalResults > 0
  const hasQuery = query.trim().length > 0
  const noResults = results && totalResults === 0 && hasQuery && !loading

  if (!isOpen) return null

  // Build grouped display
  const groups: { key: FlatResult['type']; label: string; items: FlatResult[] }[] = ([
    { key: 'task' as const, label: 'Tasks', items: flatItems.filter((i) => i.type === 'task') as FlatResult[] },
    { key: 'reminder' as const, label: 'Reminders', items: flatItems.filter((i) => i.type === 'reminder') as FlatResult[] },
    { key: 'note' as const, label: 'Notes', items: flatItems.filter((i) => i.type === 'note') as FlatResult[] },
    { key: 'memory' as const, label: 'Memory', items: flatItems.filter((i) => i.type === 'memory') as FlatResult[] },
    { key: 'file' as const, label: 'Files', items: flatItems.filter((i) => i.type === 'file') as FlatResult[] },
  ]).filter((g) => g.items.length > 0)

  // Track cumulative index for active highlight
  let cursor = 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4"
      style={{ background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: 'rgba(10,10,26,0.97)',
          border: '1px solid rgba(0,212,255,0.18)',
          boxShadow: '0 0 60px rgba(0,212,255,0.08), 0 25px 60px rgba(0,0,0,0.6)',
        }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-cyan-400/10">
          {loading ? (
            <Loader2 size={16} className="text-cyan-400 animate-spin flex-shrink-0" />
          ) : (
            <Search size={16} className="text-cyan-400/60 flex-shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            placeholder="Search tasks, reminders, notes, memory, files…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-white/90 placeholder-white/25 text-sm outline-none"
          />
          <div className="flex items-center gap-2">
            {query && (
              <button
                onClick={() => { setQuery(''); setResults(null); inputRef.current?.focus() }}
                className="text-white/30 hover:text-white/60 transition-colors"
              >
                <X size={14} />
              </button>
            )}
            <kbd
              className="text-white/20 text-[10px] nexus-mono border border-white/10 rounded px-1.5 py-0.5"
              title="Escape to close"
            >
              ESC
            </kbd>
          </div>
        </div>

        {/* Results area */}
        <div
          ref={containerRef}
          className="overflow-y-auto"
          style={{ maxHeight: 'min(480px, 60vh)' }}
        >
          {/* Empty state */}
          {!hasQuery && !loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-white/25">
              <Search size={28} className="opacity-40" />
              <p className="text-sm nexus-mono">Type to search across NEXUS</p>
              <div className="flex items-center gap-4 mt-2 text-[11px]">
                <span className="flex items-center gap-1">
                  <kbd className="border border-white/10 rounded px-1 py-0.5">↑↓</kbd> navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="border border-white/10 rounded px-1 py-0.5">↵</kbd> open
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="border border-white/10 rounded px-1 py-0.5">ESC</kbd> close
                </span>
              </div>
            </div>
          )}

          {/* No results */}
          {noResults && (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-white/25">
              <Search size={28} className="opacity-40" />
              <p className="text-sm">No results for <span className="text-white/50">"{query}"</span></p>
              <p className="text-xs nexus-mono">Try a different search term</p>
            </div>
          )}

          {/* Grouped results */}
          {hasResults && (
            <div className="py-2">
              {groups.map((group) => (
                <div key={group.key}>
                  <SectionHeader label={group.label} />
                  {group.items.map((item) => {
                    const idx = cursor++
                    return (
                      <div key={`${item.type}-${item.type === 'task' ? (item.data as TaskResult).id : item.type === 'reminder' ? (item.data as ReminderResult).id : item.type === 'note' ? (item.data as NoteResult).id : item.type === 'memory' ? (item.data as MemoryResult).id : (item.data as FileResult).id}`} data-index={idx}>
                        <ResultRow
                          item={item}
                          isActive={idx === activeIndex}
                          onClick={() => navigate(item)}
                          onMouseEnter={() => setActiveIndex(idx)}
                        />
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {hasResults && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-white/5">
            <span className="text-[11px] text-white/20 nexus-mono">
              {totalResults} result{totalResults !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-3 text-[11px] text-white/20 nexus-mono">
              <span className="flex items-center gap-1">
                <kbd className="border border-white/10 rounded px-1 py-0.5">↑↓</kbd> navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="border border-white/10 rounded px-1 py-0.5">↵</kbd> open
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
