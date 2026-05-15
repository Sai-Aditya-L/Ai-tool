'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Activity, Filter } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import toast from 'react-hot-toast'

interface ActivityLog {
  id: string
  action: string
  entityType?: string
  entityId?: string
  details?: string
  createdAt: string
}

const ACTION_COLORS: Record<string, string> = {
  TASK_CREATED: 'text-green-400',
  TASK_UPDATED: 'text-blue-400',
  TASK_DELETED: 'text-red-400',
  REMINDER_CREATED: 'text-yellow-400',
  NOTE_CREATED: 'text-pink-400',
  TRACKER_CREATED: 'text-orange-400',
  AI_TOOLS_EXECUTED: 'text-cyan-400',
  ACCOUNT_CREATED: 'text-violet-400',
}

const ACTION_ICONS: Record<string, string> = {
  TASK_CREATED: '✚', TASK_UPDATED: '✎', TASK_DELETED: '✕',
  REMINDER_CREATED: '◎', NOTE_CREATED: '✐', TRACKER_CREATED: '◈',
  AI_TOOLS_EXECUTED: '◆', ACCOUNT_CREATED: '★',
}

export default function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const LIMIT = 20

  useEffect(() => { fetchActivity() }, [page])

  async function fetchActivity() {
    setLoading(true)
    try {
      const res = await fetch(`/api/activity?limit=${LIMIT}&page=${page}`)
      const data = await res.json()
      setLogs(data.logs || [])
      setTotal(data.total || 0)
    } catch {
      toast.error('Failed to load activity')
    } finally {
      setLoading(false)
    }
  }

  function groupByDate(logs: ActivityLog[]) {
    const groups: Record<string, ActivityLog[]> = {}
    logs.forEach(log => {
      const date = new Date(log.createdAt)
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      let key: string
      if (date.toDateString() === today.toDateString()) key = 'Today'
      else if (date.toDateString() === yesterday.toDateString()) key = 'Yesterday'
      else key = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
      if (!groups[key]) groups[key] = []
      groups[key].push(log)
    })
    return groups
  }

  const grouped = groupByDate(logs)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Activity Log" subtitle={`${total} total actions`} />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 glass-panel rounded-2xl">
              <Activity size={40} className="text-white/20 mx-auto mb-3" />
              <p className="text-white/40 font-medium">No activity yet</p>
            </div>
          ) : (
            <>
              {Object.entries(grouped).map(([date, dateLogs]) => (
                <div key={date}>
                  <p className="text-white/30 text-xs uppercase tracking-wider mb-2 nexus-mono">{date}</p>
                  <div className="glass-panel rounded-xl overflow-hidden">
                    <div className="divide-y divide-white/5">
                      {dateLogs.map(log => (
                        <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-white/2">
                          <span className={`text-sm mt-0.5 w-5 text-center flex-shrink-0 ${ACTION_COLORS[log.action] || 'text-white/40'}`}>
                            {ACTION_ICONS[log.action] || '·'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-white/70 text-sm">{log.details || log.action.replace(/_/g, ' ')}</p>
                            {log.entityType && (
                              <p className="text-white/30 text-xs mt-0.5 nexus-mono">
                                {log.entityType} {log.entityId ? `#${log.entityId.slice(-6)}` : ''}
                              </p>
                            )}
                          </div>
                          <span className="text-white/25 text-xs flex-shrink-0">{formatRelativeTime(log.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between py-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="nexus-btn-secondary text-sm disabled:opacity-30"
                >
                  ← Previous
                </button>
                <span className="text-white/30 text-xs">Page {page} of {Math.ceil(total / LIMIT)}</span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * LIMIT >= total}
                  className="nexus-btn-secondary text-sm disabled:opacity-30"
                >
                  Next →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
