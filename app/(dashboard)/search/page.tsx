'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import {
  Search,
  CheckSquare,
  StickyNote,
  Calendar,
  Target,
  Brain,
  Flame,
  Bell,
  Code2,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface SearchResult {
  id: string
  type: string
  title: string
  subtitle?: string
  href: string
  icon: string
  updatedAt?: string
}

const TYPE_COLORS: Record<string, string> = {
  task: 'text-green-400',
  note: 'text-pink-400',
  goal: 'text-violet-400',
  habit: 'text-orange-400',
  reminder: 'text-yellow-400',
  meeting: 'text-blue-400',
  memory: 'text-violet-400',
  snippet: 'text-orange-400',
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  task: <CheckSquare size={16} />,
  note: <StickyNote size={16} />,
  goal: <Target size={16} />,
  habit: <Flame size={16} />,
  reminder: <Bell size={16} />,
  meeting: <Calendar size={16} />,
  memory: <Brain size={16} />,
  snippet: <Code2 size={16} />,
}

const ALL_TYPES = ['task', 'note', 'goal', 'habit', 'reminder', 'meeting', 'memory', 'snippet']

const TYPE_LABELS: Record<string, string> = {
  task: 'Tasks',
  note: 'Notes',
  goal: 'Goals',
  habit: 'Habits',
  reminder: 'Reminders',
  meeting: 'Meetings',
  memory: 'Memory',
  snippet: 'Snippets',
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg animate-pulse">
      <div className="w-8 h-8 rounded-lg bg-white/5 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-white/8 rounded w-2/5" />
        <div className="h-2 bg-white/5 rounded w-1/3" />
      </div>
    </div>
  )
}

export default function SearchPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTypes, setActiveTypes] = useState<string[]>(ALL_TYPES)

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([])
      return
    }
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query)}&types=${activeTypes.join(',')}`
        )
        const data = await res.json()
        setResults(data.results || [])
      } catch {
        toast.error('Search failed')
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query, activeTypes])

  function toggleType(type: string) {
    setActiveTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    )
  }

  function toggleAll() {
    setActiveTypes(prev => (prev.length === ALL_TYPES.length ? [] : ALL_TYPES))
  }

  // Group results by type
  const grouped = ALL_TYPES.reduce<Record<string, SearchResult[]>>((acc, type) => {
    const items = results.filter(r => r.type === type)
    if (items.length > 0) acc[type] = items
    return acc
  }, {})

  const hasResults = results.length > 0
  const showEmpty = query.length >= 2 && !loading && !hasResults
  const showInitial = query.length < 2 && !loading

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="GLOBAL SEARCH" />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
          {/* Search input */}
          <div className="relative">
            <Search
              size={20}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
            />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search everything..."
              className="w-full pl-12 pr-12 py-4 rounded-2xl text-lg bg-white/5 border border-cyan-400/20 text-white placeholder-white/25 outline-none focus:border-cyan-400/50 focus:bg-white/7 transition-all"
            />
            {query && (
              <button
                onClick={() => { setQuery(''); setResults([]) }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Type filter pills */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={toggleAll}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                activeTypes.length === ALL_TYPES.length
                  ? 'bg-cyan-400/20 border-cyan-400/50 text-cyan-400'
                  : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
              }`}
            >
              All
            </button>
            {ALL_TYPES.map(type => {
              const active = activeTypes.includes(type)
              const color = TYPE_COLORS[type]
              return (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    active
                      ? `bg-white/8 border-white/20 ${color}`
                      : 'bg-white/3 border-white/8 text-white/30 hover:border-white/15 hover:text-white/50'
                  }`}
                >
                  <span className={active ? color : 'text-white/30'}>
                    {TYPE_ICONS[type]}
                  </span>
                  {TYPE_LABELS[type]}
                </button>
              )
            })}
          </div>

          {/* Loading state */}
          {loading && (
            <div className="space-y-1">
              {[...Array(6)].map((_, i) => <SkeletonRow key={i} />)}
            </div>
          )}

          {/* Results grouped by type */}
          {!loading && hasResults && (
            <div className="space-y-6">
              {Object.entries(grouped).map(([type, items]) => (
                <div key={type}>
                  {/* Group header */}
                  <div className={`flex items-center gap-2 mb-2 ${TYPE_COLORS[type]}`}>
                    {TYPE_ICONS[type]}
                    <span className="text-xs font-semibold uppercase tracking-widest">
                      {TYPE_LABELS[type]}
                    </span>
                    <span className="text-xs opacity-60 ml-1">({items.length})</span>
                  </div>

                  {/* Group items */}
                  <div className="space-y-1">
                    {items.map(result => (
                      <button
                        key={result.id}
                        onClick={() => router.push(result.href)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left hover:bg-white/5 border border-transparent hover:border-white/8 transition-all group"
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/5 ${TYPE_COLORS[type]}`}
                        >
                          {TYPE_ICONS[type]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white/85 group-hover:text-white truncate transition-colors">
                            {result.title}
                          </div>
                          {result.subtitle && (
                            <div className="text-xs text-white/35 truncate mt-0.5">
                              {result.subtitle}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state after search */}
          {showEmpty && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Search size={40} className="text-white/15 mb-4" />
              <p className="text-white/40 text-sm">No results for &quot;{query}&quot;</p>
              <p className="text-white/20 text-xs mt-1">Try different keywords or adjust the type filters</p>
            </div>
          )}

          {/* Initial state */}
          {showInitial && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.15)' }}
              >
                <Search size={28} className="text-cyan-400/60" />
              </div>
              <p className="text-white/40 text-sm">Start typing to search across all your data</p>
              <p className="text-white/20 text-xs mt-1">Tasks, notes, goals, habits, meetings, memory &amp; more</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
