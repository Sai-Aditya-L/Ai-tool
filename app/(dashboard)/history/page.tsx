'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { History, Clock, Filter, RefreshCw, ArrowDownCircle } from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActivityEntry {
  id: string
  action: string
  entityType?: string
  entityId?: string
  metadata?: string
  createdAt: string
}

type EntityFilter =
  | 'all' | 'task' | 'note' | 'meeting' | 'reminder'
  | 'goal' | 'habit' | 'agent_run' | 'automation'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const timeAgo = (d: string) => {
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return mins + 'm ago'
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return hrs + 'h ago'
  return Math.floor(hrs / 24) + 'd ago'
}

function formatAction(action: string): string {
  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function actionDotColor(action: string): string {
  const a = action.toLowerCase()
  if (a.includes('create') || a.includes('add') || a.includes('created')) return 'bg-green-400'
  if (a.includes('update') || a.includes('edit') || a.includes('patch') || a.includes('updated')) return 'bg-blue-400'
  if (a.includes('delete') || a.includes('remove') || a.includes('deleted')) return 'bg-red-400'
  return 'bg-white/20'
}

function actionDotLabel(action: string): string {
  const a = action.toLowerCase()
  if (a.includes('create') || a.includes('add') || a.includes('created')) return 'text-green-400'
  if (a.includes('update') || a.includes('edit') || a.includes('patch') || a.includes('updated')) return 'text-blue-400'
  if (a.includes('delete') || a.includes('remove') || a.includes('deleted')) return 'text-red-400'
  return 'text-white/40'
}

const ENTITY_BADGE: Record<string, string> = {
  task:       'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  note:       'bg-pink-500/10 text-pink-400 border-pink-500/20',
  meeting:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
  reminder:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  goal:       'bg-violet-500/10 text-violet-400 border-violet-500/20',
  habit:      'bg-orange-500/10 text-orange-400 border-orange-500/20',
  agent_run:  'bg-purple-500/10 text-purple-400 border-purple-500/20',
  automation: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
}

function parseMetaPreview(meta?: string): string {
  if (!meta) return ''
  try {
    const obj = JSON.parse(meta)
    const keys = Object.keys(obj).slice(0, 2)
    return keys.map(k => `${k}: ${String(obj[k]).slice(0, 40)}`).join(' · ')
  } catch {
    return meta.slice(0, 80)
  }
}

const ENTITY_FILTERS: EntityFilter[] = [
  'all', 'task', 'note', 'meeting', 'reminder', 'goal', 'habit', 'agent_run', 'automation',
]

const PAGE_SIZE = 30

// ─── Component ────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [entityFilter, setEntityFilter] = useState<EntityFilter>('all')
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [todayCount, setTodayCount] = useState(0)

  useEffect(() => {
    setEntries([])
    setOffset(0)
    setHasMore(true)
    fetchHistory(0, true)
  }, [entityFilter])

  async function fetchHistory(off: number, reset = false) {
    if (reset) setLoading(true); else setLoadingMore(true)
    try {
      const params = new URLSearchParams({ offset: String(off) })
      if (entityFilter !== 'all') params.set('entityType', entityFilter)
      const res = await fetch(`/api/history?${params}`)
      const data = await res.json()
      const batch: ActivityEntry[] = data.logs || []
      if (reset) {
        setEntries(batch)
        // Count today's activity from the first batch
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        setTodayCount(batch.filter(e => new Date(e.createdAt) >= todayStart).length)
      } else {
        setEntries(prev => [...prev, ...batch])
      }
      setHasMore(batch.length >= PAGE_SIZE)
    } catch {
      toast.error('Failed to load history')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  function loadMore() {
    const next = offset + PAGE_SIZE
    setOffset(next)
    fetchHistory(next)
  }

  function refresh() {
    setEntries([])
    setOffset(0)
    setHasMore(true)
    fetchHistory(0, true)
  }

  const filtered = entityFilter === 'all'
    ? entries
    : entries.filter(e => e.entityType === entityFilter)

  return (
    <div className="flex flex-col h-full" style={{ background: 'rgba(0,4,12,0.97)', minHeight: '100vh' }}>
      <Header title="Version History" />

      <div className="flex-1 overflow-auto p-6 space-y-6">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-[0.15em] text-white">
              VERSION <span style={{ color: '#00e5ff' }}>HISTORY</span>
            </h1>
            <p className="text-white/30 text-xs mt-1 tracking-widest">ACTIVITY TIMELINE & AUDIT LOG</p>
          </div>
          <button onClick={refresh} title="Refresh"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold tracking-wider transition-all text-white/40 hover:text-cyan-400"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-6 text-xs text-white/30">
          <span className="flex items-center gap-1.5">
            <History size={12} style={{ color: '#00e5ff' }} />
            <span style={{ color: '#00e5ff' }} className="font-semibold">{todayCount}</span> events today
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={12} />
            {filtered.length} shown
          </span>
        </div>

        {/* Entity filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={12} className="text-white/20" />
          {ENTITY_FILTERS.map(f => (
            <button key={f} onClick={() => setEntityFilter(f)}
              className="px-3 py-1 rounded-lg text-xs font-semibold tracking-widest uppercase transition-all"
              style={entityFilter === f
                ? { background: 'rgba(0,229,255,0.15)', border: '1px solid rgba(0,229,255,0.4)', color: '#00e5ff' }
                : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.35)' }}>
              {f}
            </button>
          ))}
        </div>

        {/* Timeline */}
        {loading ? (
          <div className="text-white/25 text-sm text-center py-16 tracking-widest">LOADING HISTORY...</div>
        ) : filtered.length === 0 ? (
          <div className="text-white/15 text-sm text-center py-16 tracking-widest">NO ACTIVITY FOUND</div>
        ) : (
          <div className="relative space-y-0">
            {/* Vertical line */}
            <div className="absolute left-[18px] top-0 bottom-0 w-px" style={{ background: 'rgba(0,229,255,0.06)' }} />

            {filtered.map(entry => {
              const dotColor = actionDotColor(entry.action)
              const labelColor = actionDotLabel(entry.action)
              const badgeCls = entry.entityType ? (ENTITY_BADGE[entry.entityType] || 'bg-white/5 text-white/30 border-white/10') : ''
              const metaPreview = parseMetaPreview(entry.metadata)

              return (
                <div key={entry.id} className="relative flex items-start gap-4 pl-10 py-3 group hover:bg-white/[0.015] rounded-lg transition-colors">
                  {/* Dot */}
                  <span className={`absolute left-[13px] top-[18px] w-2.5 h-2.5 rounded-full border-2 border-[rgba(0,4,12,0.97)] ${dotColor}`} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-medium ${labelColor}`}>{formatAction(entry.action)}</span>
                      {entry.entityType && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${badgeCls}`}>{entry.entityType}</span>
                      )}
                    </div>
                    {metaPreview && (
                      <p className="text-xs text-white/25 mt-0.5 truncate">{metaPreview}</p>
                    )}
                  </div>

                  {/* Time */}
                  <span className="text-xs text-white/20 flex-shrink-0 mt-0.5">{timeAgo(entry.createdAt)}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Load more */}
        {!loading && hasMore && filtered.length > 0 && (
          <div className="flex justify-center pt-2">
            <button onClick={loadMore} disabled={loadingMore}
              className="flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-semibold tracking-wider transition-all disabled:opacity-50"
              style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.15)', color: 'rgba(0,229,255,0.6)' }}>
              <ArrowDownCircle size={14} className={loadingMore ? 'animate-bounce' : ''} />
              {loadingMore ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
