'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Calendar, Plus, Clock, MapPin, Users, Video, ExternalLink, RefreshCw, Trash2, X, Link as LinkIcon, AlertTriangle } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import Link from 'next/link'

interface CalendarEvent {
  id: string
  title: string
  description: string
  location: string
  startTime: string
  endTime: string
  allDay: boolean
  attendees: string
  meetLink: string
  status: string
  organizer?: string
  type?: string
  source?: string
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [source, setSource] = useState<'google' | 'nexus'>('nexus')
  const [selectedDate, setSelectedDate] = useState<number | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [form, setForm] = useState({
    title: '', description: '', location: '',
    startTime: '', endTime: '', attendees: '',
  })
  const [conflicts, setConflicts] = useState<{ title: string; startTime: string; endTime: string }[]>([])
  const [checkingConflicts, setCheckingConflicts] = useState(false)

  useEffect(() => { fetchEvents() }, [])

  async function fetchEvents() {
    setLoading(true)
    try {
      const res = await fetch('/api/calendar/events?days=60&maxResults=50')
      const data = await res.json()
      setEvents(data.events || [])
      setConnected(data.connected ?? false)
      setSource(data.source || 'nexus')
    } catch {
      toast.error('Failed to load calendar events')
    } finally {
      setLoading(false)
    }
  }

  async function checkConflicts(startTime: string, endTime: string) {
    if (!startTime || !endTime) { setConflicts([]); return }
    setCheckingConflicts(true)
    try {
      const res = await fetch('/api/calendar/conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startTime: new Date(startTime).toISOString(), endTime: new Date(endTime).toISOString() }),
      })
      const data = await res.json()
      setConflicts(data.conflicts ?? [])
    } catch {
      setConflicts([])
    } finally {
      setCheckingConflicts(false)
    }
  }

  async function createEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.startTime || !form.endTime) return
    try {
      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          startTime: new Date(form.startTime).toISOString(),
          endTime: new Date(form.endTime).toISOString(),
          attendees: form.attendees ? form.attendees.split(',').map(s => s.trim()) : [],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(data.message || 'Event created!')
      setForm({ title: '', description: '', location: '', startTime: '', endTime: '', attendees: '' })
      setShowCreateForm(false)
      fetchEvents()
    } catch {
      toast.error('Failed to create event')
    }
  }

  async function deleteEvent(eventId: string) {
    if (!confirm('Delete this event?')) return
    try {
      await fetch(`/api/calendar/events/${eventId}`, { method: 'DELETE' })
      setEvents(prev => prev.filter(e => e.id !== eventId))
      setSelectedEvent(null)
      toast.success('Event deleted')
    } catch {
      toast.error('Failed to delete event')
    }
  }

  // Calendar grid logic
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const today = new Date()
  const todayDate = today.getDate()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month

  const calendarCells: (number | null)[] = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (calendarCells.length % 7 !== 0) calendarCells.push(null)

  function getEventsForDay(day: number): CalendarEvent[] {
    return events.filter(event => {
      const eventDate = new Date(event.startTime)
      return eventDate.getFullYear() === year &&
        eventDate.getMonth() === month &&
        eventDate.getDate() === day
    })
  }

  const selectedDayEvents = selectedDate ? getEventsForDay(selectedDate) : []

  // Today's events
  const todayEvents = events.filter(e => {
    const d = new Date(e.startTime)
    return d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
  })

  // Upcoming events (next 7 days)
  const upcomingEvents = events.filter(e => {
    const d = new Date(e.startTime)
    const diff = (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    return diff >= 0 && diff <= 7
  }).slice(0, 8)

  function setDefaultEventTimes() {
    const start = new Date()
    start.setMinutes(0, 0, 0)
    start.setHours(start.getHours() + 1)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    setForm(f => ({
      ...f,
      startTime: start.toISOString().slice(0, 16),
      endTime: end.toISOString().slice(0, 16),
    }))
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Calendar"
        subtitle={connected ? 'Google Calendar synced' : 'Showing NEXUS reminders'}
      />
      <div className="flex-1 overflow-y-auto p-4 md:p-5">
        <div className="max-w-6xl mx-auto space-y-4">

          {/* Source badge */}
          {!connected && (
            <div className="glass-panel rounded-xl p-3 border border-yellow-400/20 flex items-center justify-between">
              <div className="flex items-center gap-2 text-yellow-400/80 text-sm">
                <Calendar size={14} />
                <span>Showing NEXUS reminders as events. Connect Google for full calendar sync.</span>
              </div>
              <Link href="/api/integrations/google/auth" className="nexus-btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
                <LinkIcon size={11} /> Connect Google
              </Link>
            </div>
          )}
          {connected && (
            <div className="flex items-center gap-2 text-green-400/60 text-xs px-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Google Calendar synced · {events.length} events
              <button onClick={fetchEvents} className="ml-auto text-white/30 hover:text-white/60 transition-colors">
                <RefreshCw size={12} />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Calendar grid */}
            <div className="lg:col-span-2 glass-panel rounded-2xl p-5">
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-semibold">{MONTHS[month]} {year}</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                    className="nexus-btn-secondary text-xs px-3 py-1.5"
                  >◀</button>
                  <button
                    onClick={() => { setCurrentDate(new Date()); setSelectedDate(today.getDate()) }}
                    className="nexus-btn-secondary text-xs px-3 py-1.5 text-cyan-400"
                  >Today</button>
                  <button
                    onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                    className="nexus-btn-secondary text-xs px-3 py-1.5"
                  >▶</button>
                  <button
                    onClick={() => { setShowCreateForm(true); setDefaultEventTimes() }}
                    className="nexus-btn-primary text-xs px-3 py-1.5 flex items-center gap-1"
                  >
                    <Plus size={12} /> Event
                  </button>
                </div>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {DAYS.map(d => (
                  <div key={d} className="text-center text-white/30 text-xs py-1 nexus-mono">{d}</div>
                ))}
              </div>

              {/* Calendar cells */}
              <div className="grid grid-cols-7 gap-1">
                {calendarCells.map((day, i) => {
                  if (!day) return <div key={i} />
                  const dayEvents = getEventsForDay(day)
                  const isToday = isCurrentMonth && day === todayDate
                  const isSelected = day === selectedDate
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDate(day === selectedDate ? null : day)}
                      className={cn(
                        'relative aspect-square flex flex-col items-center justify-start pt-1.5 rounded-lg text-sm transition-all',
                        isToday ? 'bg-cyan-400/20 border border-cyan-400/40 text-cyan-400 font-bold' : '',
                        isSelected && !isToday ? 'bg-violet-500/15 border border-violet-500/30 text-violet-300' : '',
                        !isToday && !isSelected ? 'text-white/50 hover:text-white/80 hover:bg-white/5' : ''
                      )}
                    >
                      <span>{day}</span>
                      {dayEvents.length > 0 && (
                        <div className="flex gap-0.5 mt-0.5">
                          {dayEvents.slice(0, 3).map((_, ei) => (
                            <span key={ei} className="w-1 h-1 rounded-full bg-cyan-400/70" />
                          ))}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Right panel: today / selected day / upcoming */}
            <div className="space-y-3">
              {/* Selected day events */}
              {selectedDate && (
                <div className="glass-panel rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                    <h3 className="text-white/70 text-sm font-medium">
                      {MONTHS[month]} {selectedDate}
                    </h3>
                    <button onClick={() => setSelectedDate(null)} className="text-white/30 hover:text-white/60">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="p-3">
                    {selectedDayEvents.length === 0 ? (
                      <p className="text-white/30 text-sm text-center py-3">No events</p>
                    ) : (
                      selectedDayEvents.map(event => (
                        <EventCard key={event.id} event={event} onClick={() => setSelectedEvent(event)} compact />
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Today */}
              {(!selectedDate || (isCurrentMonth && selectedDate === todayDate)) && (
                <div className="glass-panel rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/5">
                    <h3 className="text-white/70 text-sm font-medium flex items-center gap-2">
                      <Clock size={13} className="text-cyan-400" />
                      Today — {today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </h3>
                  </div>
                  <div className="p-3">
                    {loading ? (
                      <div className="w-5 h-5 border border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin mx-auto" />
                    ) : todayEvents.length === 0 ? (
                      <p className="text-white/30 text-sm text-center py-3">No events today</p>
                    ) : (
                      todayEvents.map(event => (
                        <EventCard key={event.id} event={event} onClick={() => setSelectedEvent(event)} compact />
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Upcoming */}
              <div className="glass-panel rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5">
                  <h3 className="text-white/70 text-sm font-medium">Next 7 Days</h3>
                </div>
                <div className="p-3 space-y-1">
                  {loading ? (
                    <div className="w-5 h-5 border border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin mx-auto" />
                  ) : upcomingEvents.length === 0 ? (
                    <p className="text-white/30 text-sm text-center py-3">No upcoming events</p>
                  ) : (
                    upcomingEvents.map(event => (
                      <EventCard key={event.id} event={event} onClick={() => setSelectedEvent(event)} compact />
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Create Event Modal */}
          {showCreateForm && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="glass-panel rounded-2xl p-6 w-full max-w-md">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold">New Event</h3>
                  <button onClick={() => setShowCreateForm(false)} className="text-white/40 hover:text-white/70">
                    <X size={18} />
                  </button>
                </div>
                <form onSubmit={createEvent} className="space-y-3">
                  <input type="text" placeholder="Event title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required className="nexus-input" autoFocus />
                  <textarea placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="nexus-input resize-none" />
                  <input type="text" placeholder="Location" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className="nexus-input" />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-white/40 text-xs mb-1 block">Start *</label>
                      <input
                        type="datetime-local"
                        value={form.startTime}
                        onChange={e => {
                          const v = e.target.value
                          setForm(f => ({ ...f, startTime: v }))
                          if (form.endTime) checkConflicts(v, form.endTime)
                        }}
                        required
                        className="nexus-input"
                      />
                    </div>
                    <div>
                      <label className="text-white/40 text-xs mb-1 block">End *</label>
                      <input
                        type="datetime-local"
                        value={form.endTime}
                        onChange={e => {
                          const v = e.target.value
                          setForm(f => ({ ...f, endTime: v }))
                          if (form.startTime) checkConflicts(form.startTime, v)
                        }}
                        required
                        className="nexus-input"
                      />
                    </div>
                  </div>
                  {/* Conflict warnings */}
                  {checkingConflicts && (
                    <p className="text-white/30 text-[10px] flex items-center gap-1.5">
                      <span className="w-2 h-2 border border-white/30 border-t-white rounded-full animate-spin inline-block" />
                      Checking for conflicts…
                    </p>
                  )}
                  {!checkingConflicts && conflicts.length > 0 && (
                    <div className="p-2.5 rounded-lg border border-red-400/25 bg-red-400/5">
                      <div className="flex items-center gap-1.5 text-red-400 text-xs font-medium mb-1">
                        <AlertTriangle size={12} />
                        {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} detected
                      </div>
                      {conflicts.map(c => (
                        <p key={c.title} className="text-red-400/70 text-[11px]">
                          • {c.title} ({new Date(c.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} – {new Date(c.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })})
                        </p>
                      ))}
                    </div>
                  )}
                  <input type="text" placeholder="Attendees (comma-separated emails)" value={form.attendees} onChange={e => setForm(f => ({ ...f, attendees: e.target.value }))} className="nexus-input" />
                  <div className="flex gap-2">
                    <button type="submit" className="nexus-btn-primary flex-1">Create Event</button>
                    <button type="button" onClick={() => setShowCreateForm(false)} className="nexus-btn-secondary px-4"><X size={16} /></button>
                  </div>
                  {!connected && (
                    <p className="text-white/30 text-xs text-center">Will be saved as NEXUS reminder (Google Calendar not connected)</p>
                  )}
                </form>
              </div>
            </div>
          )}

          {/* Event Detail Modal */}
          {selectedEvent && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="glass-panel rounded-2xl p-6 w-full max-w-md">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-white font-semibold text-lg pr-4">{selectedEvent.title}</h3>
                  <button onClick={() => setSelectedEvent(null)} className="text-white/40 hover:text-white/70 flex-shrink-0">
                    <X size={18} />
                  </button>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-white/60 text-sm">
                    <Clock size={14} className="text-cyan-400 flex-shrink-0" />
                    <span>{formatDate(selectedEvent.startTime)}</span>
                    {selectedEvent.endTime && <span className="text-white/30">→ {formatDate(selectedEvent.endTime)}</span>}
                  </div>
                  {selectedEvent.location && (
                    <div className="flex items-center gap-2 text-white/60 text-sm">
                      <MapPin size={14} className="text-cyan-400 flex-shrink-0" />
                      <span>{selectedEvent.location}</span>
                    </div>
                  )}
                  {selectedEvent.attendees && (
                    <div className="flex items-start gap-2 text-white/60 text-sm">
                      <Users size={14} className="text-cyan-400 flex-shrink-0 mt-0.5" />
                      <span>{selectedEvent.attendees}</span>
                    </div>
                  )}
                  {selectedEvent.meetLink && (
                    <a href={selectedEvent.meetLink} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-cyan-400 text-sm hover:text-cyan-300 transition-colors">
                      <Video size={14} />
                      <span>Join Google Meet</span>
                      <ExternalLink size={12} />
                    </a>
                  )}
                  {selectedEvent.description && (
                    <p className="text-white/50 text-sm mt-2">{selectedEvent.description}</p>
                  )}
                </div>
                {connected && (
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => deleteEvent(selectedEvent.id)}
                      className="nexus-btn-secondary flex items-center gap-2 text-sm text-red-400"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EventCard({ event, onClick, compact }: { event: CalendarEvent; onClick: () => void; compact?: boolean }) {
  const start = new Date(event.startTime)
  const timeStr = event.allDay ? 'All day' : start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-2 rounded-lg hover:bg-cyan-400/5 border border-transparent hover:border-cyan-400/15 transition-all group"
    >
      <div className="flex items-start gap-2">
        <div className="w-1 h-full min-h-[2rem] rounded-full bg-cyan-400/50 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-white/80 text-xs font-medium truncate">{event.title}</p>
          <p className="text-white/35 text-[10px] flex items-center gap-1 mt-0.5">
            <Clock size={9} />
            {timeStr}
            {event.location && <span className="ml-1 truncate">· {event.location}</span>}
          </p>
          {event.meetLink && (
            <span className="text-cyan-400/50 text-[10px] flex items-center gap-1 mt-0.5">
              <Video size={9} /> Meet link
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
