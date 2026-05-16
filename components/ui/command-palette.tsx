'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICON_MAP: Record<string, React.ComponentType<any>> = {
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

type CommandItem = NavItem | ActionItem

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

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const ACTIONS: Omit<ActionItem, 'type'>[] = [
    { label: 'New Task', description: 'Create a new task', icon: 'Plus', action: () => router.push('/tasks?new=1') },
    { label: 'New Reminder', description: 'Set a reminder', icon: 'Bell', action: () => router.push('/reminders?new=1') },
    { label: 'New Note', description: 'Create a note', icon: 'StickyNote', action: () => router.push('/notes?new=1') },
    { label: 'Open AI Chat', description: 'Start a conversation', icon: 'MessageSquare', action: () => router.push('/chat') },
    { label: 'Voice Command', description: 'Speak a command', icon: 'Mic', action: () => router.push('/voice') },
    { label: 'Deploy Agent', description: 'Launch an AI agent', icon: 'Bot', action: () => router.push('/agents') },
    { label: 'Run Simulation', description: 'Predict and plan', icon: 'Gauge', action: () => router.push('/simulate') },
    { label: 'Analyze Image', description: 'Upload image for analysis', icon: 'Eye', action: () => router.push('/visual') },
    { label: 'Export Data', description: 'Download your data', icon: 'Download', action: () => window.open('/api/export', '_blank') },
  ]

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

  const allItems: CommandItem[] = [
    ...filteredNavItems.map((item) => ({ ...item, type: 'nav' as const })),
    ...filteredActions.map((item) => ({ ...item, type: 'action' as const })),
  ]

  const executeItem = useCallback(
    (item: CommandItem) => {
      if (item.type === 'nav') {
        router.push(item.href)
      } else {
        item.action()
      }
      setOpen(false)
      setQuery('')
      setSelectedIndex(0)
    },
    [router]
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
        setQuery('')
        setSelectedIndex(0)
        return
      }

      if (!open) return

      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        setQuery('')
        setSelectedIndex(0)
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % Math.max(allItems.length, 1))
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + Math.max(allItems.length, 1)) % Math.max(allItems.length, 1))
        return
      }

      if (e.key === 'Enter') {
        e.preventDefault()
        const item = allItems[selectedIndex]
        if (item) {
          executeItem(item)
        }
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, allItems, selectedIndex, executeItem])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  if (!open) return null

  const navOffset = 0
  const actionsOffset = filteredNavItems.length

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={() => {
        setOpen(false)
        setQuery('')
        setSelectedIndex(0)
      }}
    >
      <div
        className="w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: 'rgba(0,4,12,0.97)',
          border: '1px solid rgba(0,229,255,0.2)',
          boxShadow: '0 0 60px rgba(0,229,255,0.1), 0 25px 50px rgba(0,0,0,0.8)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3">
          <Search size={16} className="text-cyan-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands, pages, actions..."
            className="flex-1 bg-transparent text-white text-base outline-none placeholder:text-white/30"
          />
        </div>

        {/* Separator */}
        <div className="h-px bg-white/10" />

        {/* Results */}
        <div ref={listRef} className="overflow-y-auto max-h-[360px] py-2">
          {/* Navigate Group */}
          {filteredNavItems.length > 0 && (
            <div>
              <div className="px-4 py-1.5">
                <span className="text-white/30 text-xs font-medium uppercase tracking-wider">Navigate</span>
              </div>
              {filteredNavItems.map((item, idx) => {
                const Icon = ICON_MAP[item.icon]
                const isSelected = selectedIndex === navOffset + idx
                return (
                  <button
                    key={item.href}
                    className={cn(
                      'flex items-center gap-3 w-full px-4 py-2.5 rounded-lg transition-all text-left',
                      isSelected ? 'bg-cyan-400/10 border border-cyan-400/20' : 'hover:bg-white/5'
                    )}
                    onClick={() => executeItem({ ...item, type: 'nav' })}
                  >
                    {Icon && (
                      <Icon size={15} className={isSelected ? 'text-cyan-400' : 'text-white/40'} />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-white/90 text-sm">{item.label}</span>
                    </div>
                    {item.shortcut && (
                      <kbd className="text-white/30 text-xs font-mono bg-white/5 px-1.5 py-0.5 rounded">
                        {item.shortcut}
                      </kbd>
                    )}
                  </button>
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
                  <button
                    key={item.label}
                    className={cn(
                      'flex items-center gap-3 w-full px-4 py-2.5 rounded-lg transition-all text-left',
                      isSelected ? 'bg-cyan-400/10 border border-cyan-400/20' : 'hover:bg-white/5'
                    )}
                    onClick={() => executeItem({ ...item, type: 'action' })}
                  >
                    {Icon && (
                      <Icon size={15} className={isSelected ? 'text-cyan-400' : 'text-white/40'} />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-white/90 text-sm">{item.label}</span>
                      {item.description && (
                        <span className="text-white/40 text-xs ml-2">{item.description}</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Empty state */}
          {allItems.length === 0 && (
            <div className="px-4 py-8 text-center text-white/30 text-sm">
              No results for &quot;{query}&quot;
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-white/5 text-white/30 text-xs">
          <span>
            <kbd className="bg-white/5 px-1 rounded">↑↓</kbd> Navigate
          </span>
          <span>
            <kbd className="bg-white/5 px-1 rounded">↵</kbd> Open
          </span>
          <span>
            <kbd className="bg-white/5 px-1 rounded">Esc</kbd> Close
          </span>
          <span className="ml-auto">
            <kbd className="bg-white/5 px-1 rounded">⌘K</kbd> Toggle
          </span>
        </div>
      </div>
    </div>
  )
}
