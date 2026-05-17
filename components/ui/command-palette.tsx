'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  MessageSquare,
  CheckSquare,
  Bell,
  Calendar,
  StickyNote,
  Bot,
  Mic,
  Brain,
  FolderOpen,
  Target,
  FlameKindling,
  Microscope,
  Code2,
  Shield,
  Network,
  Eye,
  Gauge,
  MousePointer2,
  Users,
  Blocks,
  HeartPulse,
  BarChart2,
  Smartphone,
  Lock,
  Settings,
  Plus,
  Download,
  Search,
  Loader2,
  Sparkles,
  FileText,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  LayoutDashboard, MessageSquare, CheckSquare, Bell, Calendar, StickyNote,
  Bot, Mic, Brain, FolderOpen, Target, FlameKindling, Microscope, Code2,
  Shield, Network, Eye, Gauge, MousePointer2, Users, Blocks, HeartPulse,
  BarChart2, Smartphone, Lock, Settings, Plus, Download, FileText, Zap,
}

interface NavItem {
  type: 'nav'
  label: string
  href: string
  icon: string
  shortcut?: string
}

interface ActionItem {
  type: 'action'
  label: string
  description: string
  icon: string
  action: () => void
}

interface SearchResultItem {
  type: 'result'
  id: string
  resultType: string
  label: string
  subtitle?: string
  href: string
  icon: string
}

type CommandItem = NavItem | ActionItem | SearchResultItem

const NAV_ITEMS: Omit<NavItem, 'type'>[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard', shortcut: 'G D' },
  { label: 'AI Chat', href: '/chat', icon: 'MessageSquare', shortcut: 'G C' },
  { label: 'Tasks', href: '/tasks', icon: 'CheckSquare', shortcut: 'G T' },
  { label: 'Reminders', href: '/reminders', icon: 'Bell' },
  { label: 'Calendar', href: '/calendar', icon: 'Calendar' },
  { label: 'Notes', href: '/notes', icon: 'StickyNote' },
  { label: 'Agents', href: '/agents', icon: 'Bot', shortcut: 'G A' },
  { label: 'Voice Center', href: '/voice', icon: 'Mic', shortcut: 'G V' },
  { label: 'Memory', href: '/memory', icon: 'Brain' },
  { label: 'Files', href: '/files', icon: 'FolderOpen' },
  { label: 'Goals', href: '/goals', icon: 'Target' },
  { label: 'Habits', href: '/habits', icon: 'FlameKindling' },
  { label: 'Research', href: '/research', icon: 'Microscope' },
  { label: 'Dev Workspace', href: '/dev', icon: 'Code2' },
  { label: 'Cybersecurity', href: '/cybersecurity', icon: 'Shield' },
  { label: 'Knowledge Graph', href: '/knowledge-graph', icon: 'Network' },
  { label: 'Visual AI', href: '/visual', icon: 'Eye' },
  { label: 'Simulation', href: '/simulate', icon: 'Gauge' },
  { label: 'Computer Control', href: '/computer-control', icon: 'MousePointer2' },
  { label: 'Workspaces', href: '/workspaces', icon: 'Users' },
  { label: 'Plugins & SDK', href: '/plugins', icon: 'Blocks' },
  { label: 'Observability', href: '/observability', icon: 'HeartPulse' },
  { label: 'AI Usage', href: '/usage', icon: 'BarChart2' },
  { label: 'Mobile & PWA', href: '/mobile', icon: 'Smartphone' },
  { label: 'Trust Center', href: '/trust-center', icon: 'Lock' },
  { label: 'Settings', href: '/settings', icon: 'Settings' },
]

const RESULT_TYPE_ICONS: Record<string, string> = {
  task: 'CheckSquare',
  note: 'StickyNote',
  goal: 'Target',
  habit: 'FlameKindling',
  reminder: 'Bell',
  memory: 'Brain',
  meeting: 'Calendar',
  snippet: 'Code2',
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([])
  const [searching, setSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const debouncedQuery = useDebounce(query, 300)

  const ACTIONS: Omit<ActionItem, 'type'>[] = [
    { label: 'New Task', description: 'Create a new task', icon: 'Plus', action: () => router.push('/tasks?new=1') },
    { label: 'New Reminder', description: 'Set a reminder', icon: 'Bell', action: () => router.push('/reminders?new=1') },
    { label: 'New Note', description: 'Create a note', icon: 'StickyNote', action: () => router.push('/notes?new=1') },
    { label: 'Open AI Chat', description: 'Start a conversation', icon: 'MessageSquare', action: () => router.push('/chat') },
    { label: 'Voice Command', description: 'Speak a command', icon: 'Mic', action: () => router.push('/voice') },
    { label: 'Deploy Agent', description: 'Launch an AI agent', icon: 'Bot', action: () => router.push('/agents') },
    { label: 'Run Simulation', description: 'Predict and plan', icon: 'Gauge', action: () => router.push('/simulate') },
    { label: 'Analyze Image', description: 'Upload image for analysis', icon: 'Eye', action: () => router.push('/visual') },
    { label: 'Export Data', description: 'Download your data', icon: 'Download', action: () => window.open('/api/export?format=json', '_blank') },
  ]

  // Live search from API
  useEffect(() => {
    if (!open || debouncedQuery.length < 2) {
      setSearchResults([])
      return
    }
    let cancelled = false
    setSearching(true)
    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}&limit=6`)
      .then(r => r.ok ? r.json() : { results: [] })
      .then(data => {
        if (cancelled) return
        const results: SearchResultItem[] = (data.results ?? []).map((r: { id: string; type: string; title: string; subtitle?: string; href: string }) => ({
          type: 'result' as const,
          id: r.id,
          resultType: r.type,
          label: r.title,
          subtitle: r.subtitle,
          href: r.href,
          icon: RESULT_TYPE_ICONS[r.type] ?? 'FileText',
        }))
        setSearchResults(results)
      })
      .catch(() => { if (!cancelled) setSearchResults([]) })
      .finally(() => { if (!cancelled) setSearching(false) })
    return () => { cancelled = true }
  }, [debouncedQuery, open])

  const filteredNavItems = NAV_ITEMS.filter((item) => {
    if (!query) return true
    return item.label.toLowerCase().includes(query.toLowerCase())
  })

  const filteredActions = ACTIONS.filter((item) => {
    if (!query) return true
    return (
      item.label.toLowerCase().includes(query.toLowerCase()) ||
      item.description.toLowerCase().includes(query.toLowerCase())
    )
  })

  // When there's a search query, put search results first
  const allItems: CommandItem[] = query.length >= 2
    ? [
        ...searchResults,
        ...filteredNavItems.map(i => ({ ...i, type: 'nav' as const })),
        ...filteredActions.map(i => ({ ...i, type: 'action' as const })),
      ]
    : [
        ...filteredNavItems.map(i => ({ ...i, type: 'nav' as const })),
        ...filteredActions.map(i => ({ ...i, type: 'action' as const })),
      ]

  const executeItem = useCallback(
    (item: CommandItem) => {
      if (item.type === 'nav' || item.type === 'result') {
        router.push(item.href)
      } else {
        item.action()
      }
      setOpen(false)
      setQuery('')
      setSelectedIndex(0)
      setSearchResults([])
    },
    [router]
  )

  // Ask NEXUS: navigate to chat with the query pre-filled
  const askNexus = useCallback(() => {
    if (!query.trim()) return
    router.push(`/chat?q=${encodeURIComponent(query.trim())}`)
    setOpen(false)
    setQuery('')
    setSelectedIndex(0)
    setSearchResults([])
  }, [query, router])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
        setQuery('')
        setSelectedIndex(0)
        setSearchResults([])
        return
      }

      if (!open) return

      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        setQuery('')
        setSelectedIndex(0)
        setSearchResults([])
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % Math.max(allItems.length, 1))
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + Math.max(allItems.length, 1)) % Math.max(allItems.length, 1))
        return
      }

      if (e.key === 'Enter') {
        e.preventDefault()
        // Shift+Enter = ask NEXUS
        if (e.shiftKey && query.trim()) {
          askNexus()
          return
        }
        const item = allItems[selectedIndex]
        if (item) executeItem(item)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, allItems, selectedIndex, executeItem, askNexus, query])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0)
  }, [open])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const searchOffset = 0
  const navOffset = query.length >= 2 ? searchResults.length : 0
  const actionsOffset = navOffset + filteredNavItems.length

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] sm:pt-[15vh] px-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => { setOpen(false); setQuery(''); setSelectedIndex(0); setSearchResults([]) }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background: 'rgba(0,4,12,0.97)',
              border: '1px solid rgba(0,229,255,0.2)',
              boxShadow: '0 0 60px rgba(0,229,255,0.1), 0 25px 50px rgba(0,0,0,0.8)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-3">
              {searching
                ? <Loader2 size={16} className="text-cyan-400 shrink-0 animate-spin" />
                : <Search size={16} className="text-cyan-400 shrink-0" />
              }
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search everything or type a command…"
                className="flex-1 bg-transparent text-white text-base outline-none placeholder:text-white/30"
              />
              {query.trim() && (
                <button
                  onClick={askNexus}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-violet-400/30 bg-violet-400/10 text-violet-400 hover:bg-violet-400/20 transition-all flex-shrink-0"
                  title="Ask NEXUS AI (Shift+Enter)"
                >
                  <Sparkles size={11} />
                  Ask
                </button>
              )}
            </div>

            {/* Separator */}
            <div className="h-px bg-white/10" />

            {/* Results */}
            <div ref={listRef} className="overflow-y-auto max-h-[400px] py-2">

              {/* Live Search Results */}
              {query.length >= 2 && (
                <div>
                  <div className="px-4 py-1.5 flex items-center gap-2">
                    <span className="text-white/30 text-xs font-medium uppercase tracking-wider">Search Results</span>
                    {searching && <Loader2 size={10} className="text-white/30 animate-spin" />}
                  </div>
                  {searchResults.length > 0 ? searchResults.map((item, idx) => {
                    const Icon = ICON_MAP[item.icon] ?? FileText
                    const isSelected = selectedIndex === searchOffset + idx
                    return (
                      <motion.button
                        key={`${item.resultType}-${item.id}`}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className={cn(
                          'flex items-center gap-3 w-full px-4 py-2.5 rounded-lg transition-all text-left',
                          isSelected ? 'bg-cyan-400/10 border border-cyan-400/20' : 'hover:bg-white/5'
                        )}
                        onClick={() => executeItem(item)}
                      >
                        <Icon size={15} className={cn('flex-shrink-0', isSelected ? 'text-cyan-400' : 'text-white/40')} />
                        <div className="flex-1 min-w-0">
                          <span className="text-white/90 text-sm block truncate">{item.label}</span>
                          {item.subtitle && <span className="text-white/35 text-xs block truncate">{item.subtitle}</span>}
                        </div>
                        <span className="text-white/20 text-[10px] flex-shrink-0 capitalize">{item.resultType}</span>
                      </motion.button>
                    )
                  }) : !searching ? (
                    <div className="px-4 py-2 text-white/25 text-xs">No content found for &quot;{query}&quot;</div>
                  ) : null}

                  {/* Ask NEXUS prompt */}
                  <motion.button
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg transition-all text-left hover:bg-violet-400/5 border border-transparent hover:border-violet-400/15"
                    onClick={askNexus}
                  >
                    <Sparkles size={15} className="text-violet-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-violet-400/80 text-sm">Ask NEXUS: &ldquo;{query.length > 40 ? query.slice(0, 40) + '…' : query}&rdquo;</span>
                    </div>
                    <kbd className="text-white/20 text-[10px] bg-white/5 px-1.5 py-0.5 rounded flex-shrink-0">⇧↵</kbd>
                  </motion.button>
                </div>
              )}

              {/* Navigate Group */}
              {filteredNavItems.length > 0 && (
                <div className={query.length >= 2 ? 'mt-1' : ''}>
                  <div className="px-4 py-1.5">
                    <span className="text-white/30 text-xs font-medium uppercase tracking-wider">Navigate</span>
                  </div>
                  {filteredNavItems.map((item, idx) => {
                    const Icon = ICON_MAP[item.icon]
                    const isSelected = selectedIndex === navOffset + idx
                    return (
                      <motion.button
                        key={item.href}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        className={cn(
                          'flex items-center gap-3 w-full px-4 py-2.5 rounded-lg transition-all text-left',
                          isSelected ? 'bg-cyan-400/10 border border-cyan-400/20' : 'hover:bg-white/5'
                        )}
                        onClick={() => executeItem({ ...item, type: 'nav' })}
                      >
                        {Icon && <Icon size={15} className={isSelected ? 'text-cyan-400' : 'text-white/40'} />}
                        <span className="text-white/90 text-sm flex-1">{item.label}</span>
                        {item.shortcut && (
                          <span className="text-white/25 text-[10px] nexus-mono hidden sm:block">{item.shortcut}</span>
                        )}
                      </motion.button>
                    )
                  })}
                </div>
              )}

              {/* Quick Actions Group */}
              {filteredActions.length > 0 && (
                <div className={filteredNavItems.length > 0 ? 'mt-2' : ''}>
                  <div className="px-4 py-1.5">
                    <span className="text-white/30 text-xs font-medium uppercase tracking-wider">Quick Actions</span>
                  </div>
                  {filteredActions.map((item, idx) => {
                    const Icon = ICON_MAP[item.icon]
                    const isSelected = selectedIndex === actionsOffset + idx
                    return (
                      <motion.button
                        key={item.label}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: (actionsOffset + idx) * 0.02 }}
                        className={cn(
                          'flex items-center gap-3 w-full px-4 py-2.5 rounded-lg transition-all text-left',
                          isSelected ? 'bg-cyan-400/10 border border-cyan-400/20' : 'hover:bg-white/5'
                        )}
                        onClick={() => executeItem({ ...item, type: 'action' })}
                      >
                        {Icon && <Icon size={15} className={isSelected ? 'text-cyan-400' : 'text-white/40'} />}
                        <div className="flex-1 min-w-0">
                          <span className="text-white/90 text-sm">{item.label}</span>
                          {item.description && (
                            <span className="text-white/40 text-xs ml-2">{item.description}</span>
                          )}
                        </div>
                      </motion.button>
                    )
                  })}
                </div>
              )}

              {/* Empty state */}
              {allItems.length === 0 && !searching && (
                <div className="px-4 py-8 text-center text-white/30 text-sm">
                  No results for &quot;{query}&quot;
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-4 px-4 py-2 border-t border-white/5 text-white/30 text-xs">
              <span><kbd className="bg-white/5 px-1 rounded">↑↓</kbd> Navigate</span>
              <span><kbd className="bg-white/5 px-1 rounded">↵</kbd> Open</span>
              <span><kbd className="bg-white/5 px-1 rounded">⇧↵</kbd> Ask NEXUS</span>
              <span><kbd className="bg-white/5 px-1 rounded">Esc</kbd> Close</span>
              <span className="ml-auto"><kbd className="bg-white/5 px-1 rounded">⌘K</kbd> Toggle</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
