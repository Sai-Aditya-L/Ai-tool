'use client'

import { useState } from 'react'
import { formatDate, formatRelativeTime } from '@/lib/utils'
import Link from 'next/link'
import { CheckSquare, Bell, Activity, BarChart2, ChevronRight, Check, Clock, Mail, Layers, Bot } from 'lucide-react'

interface DashboardClientProps {
  initialData: {
    stats: {
      pendingTasks: number
      completedToday: number
      todayRemindersCount: number
      unreadNotifications: number
    }
    data: {
      todayReminders: any[]
      upcomingReminders: any[]
      recentActivity: any[]
      urgentTasks: any[]
      recentTasks: any[]
      trackers: any[]
      recentFiles: any[]
      agentRuns: any[]
    }
  }
  userId: string
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-yellow-400',
  low: 'text-green-400',
}

const ACTION_ICONS: Record<string, string> = {
  TASK_CREATED: '✚',
  TASK_UPDATED: '✎',
  TASK_DELETED: '✕',
  REMINDER_CREATED: '◎',
  NOTE_CREATED: '✐',
  TRACKER_CREATED: '◈',
  AI_TOOLS_EXECUTED: '◆',
  ACCOUNT_CREATED: '★',
}

export function DashboardClient({ initialData }: DashboardClientProps) {
  const { data, stats } = initialData
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set())

  async function completeTask(taskId: string) {
    setCompletedTasks(prev => { const s = new Set(Array.from(prev)); s.add(taskId); return s })
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    })
  }

  return (
    <>
      {/* Tasks Widget */}
      <div className="glass-panel-hover rounded-2xl p-5 md:col-span-2 lg:col-span-1 xl:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CheckSquare size={14} className="text-cyan-400" />
            <h3 className="text-white/70 text-sm font-medium">Active Tasks</h3>
          </div>
          <Link href="/tasks" className="text-cyan-400/50 text-xs hover:text-cyan-400 flex items-center gap-1 transition-colors">
            View all <ChevronRight size={12} />
          </Link>
        </div>
        {data.recentTasks.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-white/30 text-sm">No pending tasks</p>
            <Link href="/tasks" className="text-cyan-400/60 text-xs mt-2 inline-block hover:text-cyan-400">
              Create your first task →
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {data.recentTasks.map((task: any) => (
              <li key={task.id} className={`flex items-start gap-3 group ${completedTasks.has(task.id) ? 'opacity-50' : ''}`}>
                <button
                  onClick={() => completeTask(task.id)}
                  className="mt-0.5 w-4 h-4 rounded border border-white/20 group-hover:border-cyan-400/50 flex-shrink-0 flex items-center justify-center hover:bg-cyan-400/10 transition-all"
                >
                  {completedTasks.has(task.id) && <Check size={10} className="text-cyan-400" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm text-white/80 truncate ${completedTasks.has(task.id) ? 'line-through' : ''}`}>
                    {task.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs ${PRIORITY_COLORS[task.priority] || 'text-white/40'}`}>
                      {task.priority}
                    </span>
                    {task.dueDate && (
                      <span className="text-white/30 text-xs flex items-center gap-1">
                        <Clock size={10} />
                        {formatDate(task.dueDate)}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Reminders Widget */}
      <div className="glass-panel-hover rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bell size={14} className="text-yellow-400" />
            <h3 className="text-white/70 text-sm font-medium">Upcoming Reminders</h3>
          </div>
          <Link href="/reminders" className="text-cyan-400/50 text-xs hover:text-cyan-400 flex items-center gap-1 transition-colors">
            View all <ChevronRight size={12} />
          </Link>
        </div>
        {data.upcomingReminders.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-white/30 text-sm">No upcoming reminders</p>
            <Link href="/reminders" className="text-cyan-400/60 text-xs mt-2 inline-block hover:text-cyan-400">
              Set a reminder →
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {data.upcomingReminders.slice(0, 4).map((r: any) => (
              <li key={r.id} className="flex items-start gap-3">
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                  r.priority === 'urgent' ? 'bg-red-400' :
                  r.priority === 'high' ? 'bg-orange-400' :
                  r.priority === 'medium' ? 'bg-yellow-400' : 'bg-green-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/80 truncate">{r.title}</p>
                  <p className="text-white/30 text-xs mt-0.5">{formatDate(r.dueAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Trackers Widget */}
      {data.trackers.length > 0 && (
        <div className="glass-panel-hover rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart2 size={14} className="text-orange-400" />
              <h3 className="text-white/70 text-sm font-medium">Active Trackers</h3>
            </div>
            <Link href="/trackers" className="text-cyan-400/50 text-xs hover:text-cyan-400 flex items-center gap-1 transition-colors">
              View all <ChevronRight size={12} />
            </Link>
          </div>
          <ul className="space-y-3">
            {data.trackers.map((t: any) => (
              <li key={t.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-white/30 text-xs capitalize bg-white/5 px-2 py-0.5 rounded-full">{t.type}</span>
                  <span className="text-sm text-white/70 truncate">{t.title}</span>
                </div>
                {t.amount && (
                  <span className="text-cyan-400 text-xs font-mono flex-shrink-0 ml-2">
                    {t.currency || '$'}{t.amount}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* System Status Widget */}
      <div className="glass-panel-hover rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Layers size={14} className="text-purple-400" />
          <h3 className="text-white/70 text-sm font-medium">System Status</h3>
        </div>
        <ul className="space-y-3">
          <li className="flex items-center justify-between">
            <span className="text-white/50 text-xs">Files uploaded</span>
            <span className="text-purple-400 text-sm font-semibold">{data.recentFiles.length}</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-white/50 text-xs">Unread notifications</span>
            <span className="text-yellow-400 text-sm font-semibold">{stats.unreadNotifications}</span>
          </li>
        </ul>
        <div className="mt-4 pt-3 border-t border-white/5 flex flex-col gap-2">
          <Link
            href="/emails"
            className="flex items-center gap-2 text-xs text-cyan-400/70 hover:text-cyan-400 transition-colors"
          >
            <Mail size={12} />
            Go to Emails
          </Link>
          <Link
            href="/integrations"
            className="flex items-center gap-2 text-xs text-cyan-400/70 hover:text-cyan-400 transition-colors"
          >
            <Layers size={12} />
            Go to Integrations
          </Link>
        </div>
      </div>

      {/* Agent Activity Widget */}
      <div className="glass-panel-hover rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bot size={14} className="text-violet-400" />
            <h3 className="text-white/70 text-sm font-medium">Agent Activity</h3>
          </div>
          <Link href="/agents" className="text-cyan-400/50 text-xs hover:text-cyan-400 flex items-center gap-1 transition-colors">
            Command Center <ChevronRight size={12} />
          </Link>
        </div>
        {data.agentRuns.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-white/30 text-sm">No agent activity</p>
            <Link href="/agents" className="text-cyan-400/60 text-xs mt-2 inline-block hover:text-cyan-400">
              Deploy your first agent →
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {data.agentRuns.slice(0, 4).map((run: any) => (
              <li key={run.id} className="flex items-center gap-3">
                <span className="text-lg flex-shrink-0">{run.agent?.avatar || '🤖'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/80 truncate">{run.agent?.name || 'Agent'}</p>
                  <p className="text-white/30 text-xs truncate">{run.task}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${
                  run.status === 'completed' ? 'text-green-400 border-green-400/30' :
                  run.status === 'running' ? 'text-cyan-400 border-cyan-400/30' :
                  run.status === 'failed' ? 'text-red-400 border-red-400/30' :
                  run.status === 'needs_approval' ? 'text-yellow-400 border-yellow-400/30' :
                  'text-white/30 border-white/15'
                }`}>
                  {run.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Activity Feed */}
      <div className="glass-panel-hover rounded-2xl p-5 md:col-span-2 xl:col-span-1">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-green-400" />
            <h3 className="text-white/70 text-sm font-medium">Recent Activity</h3>
          </div>
          <Link href="/activity" className="text-cyan-400/50 text-xs hover:text-cyan-400 flex items-center gap-1 transition-colors">
            View all <ChevronRight size={12} />
          </Link>
        </div>
        {data.recentActivity.length === 0 ? (
          <p className="text-white/30 text-sm text-center py-4">No activity yet</p>
        ) : (
          <ul className="space-y-3">
            {data.recentActivity.map((log: any) => (
              <li key={log.id} className="flex items-start gap-3">
                <span className="text-cyan-400/60 text-xs mt-0.5 w-4 text-center flex-shrink-0">
                  {ACTION_ICONS[log.action] || '·'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/60 truncate">{log.details || log.action.replace(/_/g, ' ')}</p>
                  <p className="text-white/25 text-xs mt-0.5">{formatRelativeTime(log.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
