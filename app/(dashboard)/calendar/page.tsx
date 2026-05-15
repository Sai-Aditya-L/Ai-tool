import { Header } from '@/components/layout/header'
import { Calendar, Clock, Plus, Link as LinkIcon } from 'lucide-react'
import Link from 'next/link'

export default function CalendarPage() {
  const today = new Date()
  const monthName = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay()
  const todayDate = today.getDate()
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const calendarCells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  while (calendarCells.length % 7 !== 0) calendarCells.push(null)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Calendar" subtitle="Schedule & time management" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-4">

          {/* Integration notice */}
          <div className="glass-panel rounded-xl p-4 border border-cyan-400/15 flex items-start gap-3">
            <Calendar size={18} className="text-cyan-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-white/70 text-sm font-medium">Google Calendar Integration — Phase 2</p>
              <p className="text-white/40 text-xs mt-0.5">
                Full calendar sync with Google Calendar and Outlook is coming in Phase 2.
                Use the AI chat to create and manage reminders with date/time intelligence now.
              </p>
            </div>
            <Link href="/chat" className="nexus-btn-primary text-xs py-1.5 px-3 whitespace-nowrap flex items-center gap-1">
              <LinkIcon size={12} />
              Ask NEXUS
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Calendar grid */}
            <div className="lg:col-span-2 glass-panel rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-semibold">{monthName}</h2>
                <div className="flex gap-2">
                  <button className="nexus-btn-secondary text-xs px-3 py-1.5">◀</button>
                  <button className="nexus-btn-secondary text-xs px-3 py-1.5 text-cyan-400">Today</button>
                  <button className="nexus-btn-secondary text-xs px-3 py-1.5">▶</button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {days.map(d => (
                  <div key={d} className="text-center text-white/30 text-xs py-1.5 nexus-mono">{d}</div>
                ))}
                {calendarCells.map((day, i) => (
                  <div
                    key={i}
                    className={`
                      aspect-square flex items-center justify-center rounded-lg text-sm transition-all cursor-pointer
                      ${!day ? 'opacity-0 pointer-events-none' : ''}
                      ${day === todayDate
                        ? 'bg-cyan-400/20 border border-cyan-400/40 text-cyan-400 font-bold'
                        : day ? 'text-white/50 hover:text-white/80 hover:bg-white/5' : ''}
                    `}
                  >
                    {day}
                  </div>
                ))}
              </div>
            </div>

            {/* Today panel */}
            <div className="space-y-3">
              <div className="glass-panel rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={14} className="text-cyan-400" />
                  <h3 className="text-white/70 text-sm font-medium">Today</h3>
                </div>
                <p className="text-white font-bold text-2xl">{todayDate}</p>
                <p className="text-white/40 text-sm">
                  {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long' })}
                </p>
              </div>

              <div className="glass-panel rounded-xl p-4">
                <p className="text-white/50 text-xs mb-3 uppercase tracking-wider">Quick Actions</p>
                <div className="space-y-2">
                  <Link href="/reminders" className="flex items-center gap-2 text-sm text-white/60 hover:text-white/80 p-2 rounded-lg hover:bg-white/5 transition-all">
                    <Plus size={14} className="text-cyan-400" />
                    Set a reminder
                  </Link>
                  <Link href="/tasks" className="flex items-center gap-2 text-sm text-white/60 hover:text-white/80 p-2 rounded-lg hover:bg-white/5 transition-all">
                    <Plus size={14} className="text-green-400" />
                    Create a task
                  </Link>
                  <Link href="/chat" className="flex items-center gap-2 text-sm text-white/60 hover:text-white/80 p-2 rounded-lg hover:bg-white/5 transition-all">
                    <Calendar size={14} className="text-violet-400" />
                    Schedule with AI
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
