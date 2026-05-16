'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import {
  Calendar, Users, Clock, Plus, Zap, CheckSquare, Trash2, ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Meeting {
  id: string
  title: string
  date: string
  duration?: number
  attendees: string
  notes?: string
  actionItems: string
  summary?: string
  transcript?: string
  status: string
  createdAt: string
}

type FilterTab = 'all' | 'upcoming' | 'completed'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function parseJSON<T>(str: string, fallback: T): T {
  try { return JSON.parse(str) } catch { return fallback }
}

const STATUS_STYLES: Record<string, { badge: string; dot: string }> = {
  scheduled:   { badge: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',   dot: 'bg-blue-400' },
  in_progress: { badge: 'bg-amber-500/15 text-amber-400 border border-amber-500/30', dot: 'bg-amber-400' },
  completed:   { badge: 'bg-green-500/15 text-green-400 border border-green-500/30', dot: 'bg-green-400' },
  cancelled:   { badge: 'bg-red-500/10 text-red-400/60 border border-red-500/20',    dot: 'bg-red-400/50' },
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Meeting | null>(null)
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [extracting, setExtracting] = useState(false)

  // Edit state
  const [editTitle, setEditTitle] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editAttendees, setEditAttendees] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  // Create form state
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newDuration, setNewDuration] = useState('')
  const [newAttendees, setNewAttendees] = useState('')
  const [newStatus, setNewStatus] = useState('scheduled')
  const [creating, setCreating] = useState(false)

  useEffect(() => { fetchMeetings() }, [filterTab])

  async function fetchMeetings() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterTab === 'completed') params.set('status', 'completed')
      const res = await fetch(`/api/meetings?${params}`)
      const data = await res.json()
      let list: Meeting[] = data.meetings || []
      if (filterTab === 'upcoming') {
        const now = new Date()
        list = list.filter(m => new Date(m.date) >= now && m.status !== 'cancelled' && m.status !== 'completed')
      }
      setMeetings(list)
    } catch {
      toast.error('Failed to load meetings')
    } finally {
      setLoading(false)
    }
  }

  function selectMeeting(m: Meeting) {
    setSelected(m)
    setEditTitle(m.title)
    setEditNotes(m.notes || '')
    setEditAttendees(parseJSON<string[]>(m.attendees, []).join(', '))
    setEditStatus(m.status)
    setDeleteConfirm(false)
  }

  async function saveEdit() {
    if (!selected) return
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/meetings/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          notes: editNotes,
          attendees: editAttendees.split(',').map(s => s.trim()).filter(Boolean),
          status: editStatus,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMeetings(prev => prev.map(m => m.id === selected.id ? data.meeting : m))
      setSelected(data.meeting)
      toast.success('Meeting updated')
    } catch {
      toast.error('Failed to update meeting')
    } finally {
      setSavingEdit(false)
    }
  }

  async function deleteMeeting() {
    if (!selected) return
    try {
      const res = await fetch(`/api/meetings/${selected.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setMeetings(prev => prev.filter(m => m.id !== selected.id))
      setSelected(null)
      toast.success('Meeting deleted')
    } catch {
      toast.error('Failed to delete meeting')
    }
  }

  async function extractInsights() {
    if (!selected) return
    setExtracting(true)
    try {
      const res = await fetch(`/api/meetings/${selected.id}?action=extract`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMeetings(prev => prev.map(m => m.id === selected.id ? data.meeting : m))
      setSelected(data.meeting)
      toast.success('Insights extracted')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Extraction failed')
    } finally {
      setExtracting(false)
    }
  }

  async function createMeeting() {
    if (!newTitle || !newDate) { toast.error('Title and date are required'); return }
    setCreating(true)
    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          date: newDate,
          duration: newDuration ? parseInt(newDuration) : undefined,
          attendees: newAttendees.split(',').map(s => s.trim()).filter(Boolean),
          status: newStatus,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMeetings(prev => [data.meeting, ...prev])
      setShowCreate(false)
      setNewTitle(''); setNewDate(''); setNewDuration(''); setNewAttendees(''); setNewStatus('scheduled')
      toast.success('Meeting created')
    } catch {
      toast.error('Failed to create meeting')
    } finally {
      setCreating(false)
    }
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const totalThisMonth = meetings.filter(m => new Date(m.createdAt) >= thisMonthStart).length
  const upcomingCount = meetings.filter(m => new Date(m.date) >= now && m.status !== 'cancelled' && m.status !== 'completed').length
  const completedCount = meetings.filter(m => m.status === 'completed').length
  const completedPct = meetings.length > 0 ? Math.round((completedCount / meetings.length) * 100) : 0
  const totalActionItems = meetings.reduce((acc, m) => acc + parseJSON<string[]>(m.actionItems, []).length, 0)

  const selectedActionItems = selected ? parseJSON<string[]>(selected.actionItems, []) : []

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white/90 text-sm focus:outline-none focus:border-cyan-400/50 focus:bg-cyan-400/5 transition-colors'
  const labelCls = 'block text-xs text-white/40 mb-1 font-medium tracking-wide uppercase'

  return (
    <div className="flex flex-col h-full" style={{ background: 'rgba(0,4,12,0.97)', minHeight: '100vh' }}>
      <Header title="Meeting Intelligence" />

      <div className="flex-1 overflow-auto p-6 space-y-6">

        {/* Header row */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-[0.15em] text-white">
              MEETING <span style={{ color: '#00e5ff' }}>INTELLIGENCE</span>
            </h1>
            <p className="text-white/30 text-xs mt-1 tracking-widest">AI-POWERED MEETING MANAGEMENT</p>
          </div>
          <button
            onClick={() => setShowCreate(v => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold tracking-wider transition-all"
            style={{ background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.3)', color: '#00e5ff' }}
          >
            <Plus size={14} />
            NEW MEETING
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'THIS MONTH', value: totalThisMonth, icon: Calendar, color: '#00e5ff' },
            { label: 'UPCOMING', value: upcomingCount, icon: Clock, color: '#60a5fa' },
            { label: 'ACTION ITEMS', value: totalActionItems, icon: CheckSquare, color: '#a78bfa' },
            { label: 'COMPLETED %', value: `${completedPct}%`, icon: Zap, color: '#4ade80' },
          ].map(stat => (
            <div key={stat.label} className="hud-panel p-4 rounded-lg" style={{ background: 'rgba(0,4,12,0.6)', border: '1px solid rgba(0,229,255,0.08)' }}>
              <div className="flex items-center gap-2 mb-2">
                <stat.icon size={14} style={{ color: stat.color }} />
                <span className="text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>{stat.label}</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="rounded-xl p-5 space-y-4" style={{ background: 'rgba(0,229,255,0.03)', border: '1px solid rgba(0,229,255,0.15)' }}>
            <h3 className="text-sm font-semibold tracking-widest text-cyan-400">NEW MEETING</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Title *</label>
                <input className={inputCls} value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Meeting title" />
              </div>
              <div>
                <label className={labelCls}>Date & Time *</label>
                <input type="datetime-local" className={inputCls} value={newDate} onChange={e => setNewDate(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Duration (minutes)</label>
                <input type="number" className={inputCls} value={newDuration} onChange={e => setNewDuration(e.target.value)} placeholder="60" />
              </div>
              <div>
                <label className={labelCls}>Attendees (comma-separated)</label>
                <input className={inputCls} value={newAttendees} onChange={e => setNewAttendees(e.target.value)} placeholder="alice@co.com, bob@co.com" />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select className={inputCls} value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                  <option value="scheduled">Scheduled</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={createMeeting} disabled={creating}
                className="px-4 py-2 rounded-lg text-sm font-semibold tracking-wider transition-all disabled:opacity-50"
                style={{ background: 'rgba(0,229,255,0.15)', border: '1px solid rgba(0,229,255,0.3)', color: '#00e5ff' }}>
                {creating ? 'Creating...' : 'Create Meeting'}
              </button>
              <button onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold tracking-wider text-white/40 hover:text-white/70 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-2">
          {(['all', 'upcoming', 'completed'] as FilterTab[]).map(tab => (
            <button key={tab} onClick={() => setFilterTab(tab)}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold tracking-widest uppercase transition-all"
              style={filterTab === tab
                ? { background: 'rgba(0,229,255,0.15)', border: '1px solid rgba(0,229,255,0.4)', color: '#00e5ff' }
                : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
              {tab}
            </button>
          ))}
        </div>

        {/* Main two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Meeting list */}
          <div className="lg:col-span-2 space-y-2">
            {loading ? (
              <div className="text-white/30 text-sm text-center py-10">Loading meetings...</div>
            ) : meetings.length === 0 ? (
              <div className="text-white/20 text-sm text-center py-10 tracking-widest">NO MEETINGS FOUND</div>
            ) : meetings.map(m => {
              const attendeeList = parseJSON<string[]>(m.attendees, [])
              const styles = STATUS_STYLES[m.status] || STATUS_STYLES.scheduled
              const isSelected = selected?.id === m.id
              return (
                <button key={m.id} onClick={() => selectMeeting(m)} className="w-full text-left rounded-xl p-4 transition-all group"
                  style={isSelected
                    ? { background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.3)' }
                    : { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${styles.dot}`} />
                      <span className="text-sm font-medium text-white/90 truncate">{m.title}</span>
                    </div>
                    <ChevronRight size={14} className="text-white/20 flex-shrink-0 group-hover:text-cyan-400 transition-colors" />
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-white/30">
                    <span className="flex items-center gap-1"><Calendar size={11} />{formatDate(m.date)}</span>
                    {attendeeList.length > 0 && (
                      <span className="flex items-center gap-1"><Users size={11} />{attendeeList.length}</span>
                    )}
                    {m.duration && (
                      <span className="flex items-center gap-1"><Clock size={11} />{m.duration}m</span>
                    )}
                  </div>
                  <div className="mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${styles.badge}`}>{m.status.replace('_', ' ')}</span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Detail view */}
          <div className="lg:col-span-3">
            {!selected ? (
              <div className="rounded-xl flex flex-col items-center justify-center py-20 text-white/20 text-sm tracking-widest"
                style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)' }}>
                SELECT A MEETING TO VIEW DETAILS
              </div>
            ) : (
              <div className="rounded-xl p-6 space-y-5" style={{ background: 'rgba(0,4,12,0.8)', border: '1px solid rgba(0,229,255,0.12)' }}>

                {/* Title */}
                <div>
                  <label className={labelCls}>Title</label>
                  <input className={inputCls} value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                </div>

                {/* Status */}
                <div>
                  <label className={labelCls}>Status</label>
                  <select className={inputCls} value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                    <option value="scheduled">Scheduled</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                {/* Attendees */}
                <div>
                  <label className={labelCls}>Attendees (comma-separated)</label>
                  <input className={inputCls} value={editAttendees} onChange={e => setEditAttendees(e.target.value)} placeholder="alice@co.com, bob@co.com" />
                </div>

                {/* Date & duration (read-only display) */}
                <div className="flex gap-4 text-xs text-white/30">
                  <span className="flex items-center gap-1"><Calendar size={12} />{formatDate(selected.date)}</span>
                  {selected.duration && <span className="flex items-center gap-1"><Clock size={12} />{selected.duration} min</span>}
                </div>

                {/* Notes */}
                <div>
                  <label className={labelCls}>Notes</label>
                  <textarea className={`${inputCls} resize-none`} rows={4} value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Meeting notes..." />
                </div>

                {/* Action buttons row */}
                <div className="flex gap-3 flex-wrap">
                  <button onClick={saveEdit} disabled={savingEdit}
                    className="px-4 py-2 rounded-lg text-xs font-semibold tracking-wider transition-all disabled:opacity-50"
                    style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.3)', color: '#00e5ff' }}>
                    {savingEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button onClick={extractInsights} disabled={extracting}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold tracking-wider transition-all disabled:opacity-50"
                    style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)', color: '#a78bfa' }}>
                    <Zap size={12} />
                    {extracting ? 'Extracting...' : 'AI Extract'}
                  </button>
                  {!deleteConfirm ? (
                    <button onClick={() => setDeleteConfirm(true)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold tracking-wider transition-all ml-auto"
                      style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: 'rgba(248,113,113,0.7)' }}>
                      <Trash2 size={12} /> Delete
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-xs text-red-400/70">Confirm?</span>
                      <button onClick={deleteMeeting}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400 border border-red-400/30 hover:bg-red-400/10 transition-colors">Yes</button>
                      <button onClick={() => setDeleteConfirm(false)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white/40 border border-white/10 hover:bg-white/5 transition-colors">No</button>
                    </div>
                  )}
                </div>

                {/* AI Summary */}
                {selected.summary && (
                  <div className="rounded-lg p-4" style={{ background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.15)' }}>
                    <p className="text-xs text-violet-400 font-semibold tracking-widest mb-2">AI SUMMARY</p>
                    <p className="text-sm text-white/70 leading-relaxed">{selected.summary}</p>
                  </div>
                )}

                {/* Action items */}
                {selectedActionItems.length > 0 && (
                  <div>
                    <p className="text-xs text-white/40 font-semibold tracking-widest mb-2">ACTION ITEMS</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedActionItems.map((item, i) => (
                        <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-green-400"
                          style={{ background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.2)' }}>
                          <CheckSquare size={10} />{item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
