'use client'

import { useState, useEffect } from 'react'
import { Calendar, Clock, MapPin, Video, ChevronRight, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface CalendarEvent {
  id: string
  title: string
  description?: string
  location?: string
  startTime: string
  endTime: string
  allDay: boolean
  meetLink?: string
  status: string
  source: string
}

function formatTime(t: string) {
  return new Date(t).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function isEventNow(event: CalendarEvent): boolean {
  const now = Date.now()
  return now >= new Date(event.startTime).getTime() && now <= new Date(event.endTime).getTime()
}

function isEventSoon(event: CalendarEvent): boolean {
  const now = Date.now()
  const start = new Date(event.startTime).getTime()
  return start > now && start - now <= 30 * 60 * 1000
}

export function CalendarWidget() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const fetchEvents = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/calendar/events?days=1&maxResults=20')
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to load events')
        setLoading(false)
        return
      }
      const data = await res.json()
      const allEvents: CalendarEvent[] = data.events || []

      // Filter to today only
      const today = new Date()
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
      const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1

      const todayEvents = allEvents.filter(e => {
        if (e.allDay) {
          // allDay events: check if they fall on today
          const eStart = new Date(e.startTime).getTime()
          return eStart >= startOfDay && eStart <= endOfDay
        }
        const eStart = new Date(e.startTime).getTime()
        const eEnd = new Date(e.endTime).getTime()
        // Include if event overlaps today
        return eStart <= endOfDay && eEnd >= startOfDay
      })

      // Sort by start time
      todayEvents.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

      setEvents(todayEvents)
      setLastRefresh(new Date())
    } catch {
      setError('Calendar unavailable')
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchEvents()
    const interval = setInterval(fetchEvents, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const today = new Date()
  const dateLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  const displayEvents = events.slice(0, 5)

  return (
    <div className="hud-stat-card rounded-xl p-5 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-cyan-400" />
          <span className="text-white/40 text-xs uppercase tracking-wider">Today&apos;s Agenda</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/25 text-xs">{dateLabel}</span>
          <button
            onClick={fetchEvents}
            disabled={loading}
            className="text-white/25 hover:text-cyan-400 transition-colors disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw size={11} className={cn(loading && 'animate-spin')} />
          </button>
          <Link href="/calendar" className="text-white/25 hover:text-cyan-400 transition-colors">
            <ChevronRight size={14} />
          </Link>
        </div>
      </div>

      {/* Body */}
      {loading && events.length === 0 ? (
        <div className="flex items-center justify-center py-6">
          <div className="flex flex-col items-center gap-2">
            <Calendar size={20} className="text-cyan-400/30 animate-pulse" />
            <span className="text-white/30 text-xs">Loading events...</span>
          </div>
        </div>
      ) : error ? (
        <div className="flex flex-col gap-2 py-2">
          <p className="text-white/30 text-xs">{error}</p>
          <button onClick={fetchEvents} className="text-cyan-400/60 hover:text-cyan-400 text-xs transition-colors self-start">
            Try again
          </button>
        </div>
      ) : displayEvents.length === 0 ? (
        <div className="flex items-center justify-between py-4">
          <span className="text-white/25 text-xs italic">No events today</span>
          <Link
            href="/calendar"
            className="text-white/20 hover:text-cyan-400 text-xs transition-colors flex items-center gap-1"
            title="Add event"
          >
            <span>+</span>
            <span>Add</span>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {displayEvents.map(event => {
            const now = isEventNow(event)
            const soon = isEventSoon(event)
            return (
              <div
                key={event.id}
                className={cn(
                  'border-l-2 pl-3 py-1.5 rounded-r transition-colors group hover:bg-white/3',
                  now
                    ? 'border-green-400 animate-pulse'
                    : soon
                    ? 'border-cyan-400 shadow-[0_0_8px_rgba(0,229,255,0.15)]'
                    : 'border-cyan-400/30'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {now && (
                        <span className="flex items-center gap-1 text-green-400 text-xs font-medium shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                          IN PROGRESS
                        </span>
                      )}
                      <span className={cn(
                        'text-sm font-medium truncate',
                        now ? 'text-green-300' : soon ? 'text-cyan-300' : 'text-white/80'
                      )}>
                        {event.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {!event.allDay && (
                        <span className="flex items-center gap-1 text-white/35 text-xs">
                          <Clock size={9} />
                          {formatTime(event.startTime)} – {formatTime(event.endTime)}
                        </span>
                      )}
                      {event.allDay && (
                        <span className="text-white/35 text-xs">All day</span>
                      )}
                      {event.location && (
                        <span className="flex items-center gap-1 text-white/30 text-xs truncate max-w-[120px]">
                          <MapPin size={9} />
                          {event.location}
                        </span>
                      )}
                      {event.meetLink && (
                        <a
                          href={event.meetLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-cyan-400/60 hover:text-cyan-400 text-xs transition-colors"
                          onClick={e => e.stopPropagation()}
                        >
                          <Video size={9} />
                          Join
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Footer */}
      {!loading && !error && events.length > 0 && (
        <div className="flex items-center justify-between pt-1 border-t border-white/5">
          <span className="text-white/25 text-xs">
            {events.length} event{events.length !== 1 ? 's' : ''} today
          </span>
          <Link href="/calendar" className="text-cyan-400/50 hover:text-cyan-400 text-xs transition-colors flex items-center gap-0.5">
            View Calendar <ChevronRight size={10} />
          </Link>
        </div>
      )}
    </div>
  )
}
