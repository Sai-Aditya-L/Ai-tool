'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Header } from '@/components/layout/header'
import { AIOrb } from '@/components/dashboard/ai-orb'
import { DashboardClient } from '@/components/dashboard/dashboard-client'
import { WeatherWidget } from '@/components/dashboard/weather-widget'
import { NewsWidget } from '@/components/dashboard/news-widget'
import { CryptoWidget } from '@/components/dashboard/crypto-widget'
import { CalendarWidget } from '@/components/dashboard/calendar-widget'
import Link from 'next/link'
import { Sparkles, BarChart2, Loader2, RotateCcw, Flame } from 'lucide-react'

interface DashboardStats {
  pendingTasks: number
  completedTasksToday: number
  urgentTasks: number
  todayRemindersCount: number
  unreadNotifications: number
  unreadEmailCount: number
}

interface DashboardData {
  stats: DashboardStats
  data: {
    todayReminders: unknown[]
    upcomingReminders: unknown[]
    recentActivity: unknown[]
    urgentTasks: unknown[]
    recentTasks: unknown[]
    trackers: unknown[]
    recentFiles: unknown[]
    agentRuns: unknown[]
    todayEvents: unknown[]
  }
  user: { name?: string | null }
}

const statCards = [
  {
    key: 'pendingTasks',
    label: 'Pending Tasks',
    color: 'yellow',
    icon: '⬡',
    subKey: 'completedTasksToday',
    subLabel: (v: number) => `${v} completed today`,
    subColor: 'text-green-400',
  },
  {
    key: 'todayRemindersCount',
    label: "Today's Reminders",
    color: 'cyan',
    icon: '◎',
    subKey: 'upcomingCount',
    subLabel: (v: number) => `${v} upcoming total`,
    subColor: 'text-cyan-400/60',
  },
  {
    key: 'urgentTasks',
    label: 'Urgent Tasks',
    color: 'red',
    icon: '⚠',
    subLabel: () => 'Needs attention',
    subColor: 'text-red-400/60',
  },
  {
    key: 'unreadNotifications',
    label: 'Unread Notifications',
    color: 'yellow',
    icon: '🔔',
    subLabel: () => 'Awaiting review',
    subColor: 'text-yellow-400/60',
  },
  {
    key: 'unreadEmailCount',
    label: 'Unread Emails',
    color: 'cyan',
    icon: '✉',
    subColor: 'text-cyan-400/60',
    isLink: true,
  },
]

const colorMap: Record<string, string> = {
  yellow: 'bg-yellow-400/10',
  cyan: 'bg-cyan-400/10',
  red: 'bg-red-400/10',
}

const iconColorMap: Record<string, string> = {
  yellow: 'text-yellow-400',
  cyan: 'text-cyan-400',
  red: 'text-red-400',
}

export default function DashboardPage() {
  const [dashData, setDashData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { document.title = 'Dashboard | NEXUS' }, [])

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [dashRes, notifRes, emailRes] = await Promise.all([
          fetch('/api/dashboard'),
          fetch('/api/notifications?unreadOnly=true').catch(() => null),
          fetch('/api/emails?unreadOnly=true').catch(() => null),
        ])

        const dash = await dashRes.json()
        const notifData = notifRes ? await notifRes.json().catch(() => ({ total: 0 })) : { total: 0 }
        const emailData = emailRes ? await emailRes.json().catch(() => ({ total: 0 })) : { total: 0 }

        setDashData({
          stats: {
            pendingTasks: dash.stats?.pendingTasks ?? 0,
            completedTasksToday: dash.stats?.completedTasksToday ?? 0,
            urgentTasks: dash.stats?.urgentTasks ?? 0,
            todayRemindersCount: dash.stats?.todayRemindersCount ?? 0,
            unreadNotifications: notifData.total ?? notifData.unreadCount ?? 0,
            unreadEmailCount: emailData.total ?? emailData.unreadCount ?? 0,
          },
          data: {
            todayReminders: dash.data?.todayReminders ?? [],
            upcomingReminders: dash.data?.upcomingReminders ?? [],
            recentActivity: dash.data?.recentActivity ?? [],
            urgentTasks: dash.data?.urgentTasks ?? [],
            recentTasks: dash.data?.recentTasks ?? [],
            trackers: dash.data?.trackers ?? [],
            recentFiles: [],
            agentRuns: [],
            todayEvents: dash.data?.todayReminders ?? [],
          },
          user: dash.user ?? {},
        })
      } catch {
        // fallback to empty state
        setDashData({
          stats: {
            pendingTasks: 0,
            completedTasksToday: 0,
            urgentTasks: 0,
            todayRemindersCount: 0,
            unreadNotifications: 0,
            unreadEmailCount: 0,
          },
          data: {
            todayReminders: [],
            upcomingReminders: [],
            recentActivity: [],
            urgentTasks: [],
            recentTasks: [],
            trackers: [],
            recentFiles: [],
            agentRuns: [],
            todayEvents: [],
          },
          user: {},
        })
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [])

  const stats = dashData?.stats
  const data = dashData?.data

  // --- AI Briefing state ---
  const [briefing, setBriefing] = useState<string | null>(null)
  const [briefingLoading, setBriefingLoading] = useState(true)
  const [generatingBriefing, setGeneratingBriefing] = useState(false)
  const [productivityScore, setProductivityScore] = useState<{ score: number; streak: number } | null>(null)

  useEffect(() => {
    fetch('/api/daily-summaries')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const today = new Date().toISOString().split('T')[0]
        const todaySummary = data?.summaries?.find((s: { date: string }) => s.date === today)
        setBriefing(todaySummary?.content ?? null)
      })
      .catch(() => {})
      .finally(() => setBriefingLoading(false))

    fetch('/api/analytics/productivity')
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setProductivityScore({ score: d.score, streak: d.streak }))
      .catch(() => {})
  }, [])

  async function generateBriefing() {
    setGeneratingBriefing(true)
    try {
      const res = await fetch('/api/daily-summaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'daily' }),
      })
      if (res.ok) {
        const d = await res.json()
        setBriefing(d.summary?.content ?? null)
      }
    } catch {}
    setGeneratingBriefing(false)
  }

  const clientDashData = dashData
    ? {
        stats: {
          pendingTasks: stats!.pendingTasks,
          completedToday: stats!.completedTasksToday,
          todayRemindersCount: stats!.todayRemindersCount,
          unreadNotifications: stats!.unreadNotifications,
          unreadEmailCount: stats!.unreadEmailCount,
        },
        data: data!,
      }
    : null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Header
          title="Command Center"
          subtitle={`${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}
        />
      </motion.div>
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-[1600px] mx-auto">

          {/* AI Orb - spans 1 col */}
          <motion.div
            className="lg:row-span-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0, duration: 0.4, ease: 'easeOut' }}
          >
            <AIOrb userName={dashData?.user?.name} />
          </motion.div>

          {/* Pending Tasks */}
          <motion.div
            className="hud-stat-card rounded-xl p-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="text-white/40 text-xs uppercase tracking-wider">Pending Tasks</div>
              <div className="w-8 h-8 rounded-lg bg-yellow-400/10 flex items-center justify-center">
                <span className="text-yellow-400 text-sm">⬡</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {loading ? <span className="opacity-40">—</span> : stats?.pendingTasks ?? 0}
            </div>
            <div className="text-green-400 text-xs">
              {loading ? '' : `${stats?.completedTasksToday ?? 0} completed today`}
            </div>
          </motion.div>

          {/* Today's Reminders */}
          <motion.div
            className="hud-stat-card rounded-xl p-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4, ease: 'easeOut' }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="text-white/40 text-xs uppercase tracking-wider">Today&apos;s Reminders</div>
              <div className="w-8 h-8 rounded-lg bg-cyan-400/10 flex items-center justify-center">
                <span className="text-cyan-400 text-sm">◎</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {loading ? <span className="opacity-40">—</span> : stats?.todayRemindersCount ?? 0}
            </div>
            <div className="text-cyan-400/60 text-xs">
              {loading ? '' : `${data?.upcomingReminders?.length ?? 0} upcoming total`}
            </div>
          </motion.div>

          {/* Urgent Tasks */}
          <motion.div
            className="hud-stat-card rounded-xl p-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4, ease: 'easeOut' }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="text-white/40 text-xs uppercase tracking-wider">Urgent Tasks</div>
              <div className="w-8 h-8 rounded-lg bg-red-400/10 flex items-center justify-center">
                <span className="text-red-400 text-sm">⚠</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {loading ? <span className="opacity-40">—</span> : stats?.urgentTasks ?? 0}
            </div>
            <div className="text-red-400/60 text-xs">Needs attention</div>
          </motion.div>

          {/* Unread Notifications */}
          <motion.div
            className="hud-stat-card rounded-xl p-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4, ease: 'easeOut' }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="text-white/40 text-xs uppercase tracking-wider">Unread Notifications</div>
              <div className="w-8 h-8 rounded-lg bg-yellow-400/10 flex items-center justify-center">
                <span className="text-yellow-400 text-sm">🔔</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {loading ? <span className="opacity-40">—</span> : stats?.unreadNotifications ?? 0}
            </div>
            <div className="text-yellow-400/60 text-xs">Awaiting review</div>
          </motion.div>

          {/* Unread Emails */}
          <motion.div
            className="hud-stat-card rounded-xl p-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4, ease: 'easeOut' }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="text-white/40 text-xs uppercase tracking-wider">Unread Emails</div>
              <div className="w-8 h-8 rounded-lg bg-cyan-400/10 flex items-center justify-center">
                <span className="text-cyan-400 text-sm">✉</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {loading ? <span className="opacity-40">—</span> : stats?.unreadEmailCount ?? 0}
            </div>
            <Link href="/emails" className="text-cyan-400/60 text-xs hover:text-cyan-400 transition-colors">
              View emails →
            </Link>
          </motion.div>

          {/* Productivity Score */}
          <motion.div
            className="hud-stat-card rounded-xl p-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.4, ease: 'easeOut' }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="text-white/40 text-xs uppercase tracking-wider">Today&apos;s Score</div>
              <div className="w-8 h-8 rounded-lg bg-cyan-400/10 flex items-center justify-center">
                <BarChart2 size={14} className="text-cyan-400" />
              </div>
            </div>
            {productivityScore ? (
              <>
                <div className="text-3xl font-bold text-white mb-1">{productivityScore.score}<span className="text-sm text-white/30">/100</span></div>
                <div className="flex items-center gap-1 text-orange-400 text-xs">
                  <Flame size={11} />
                  {productivityScore.streak} day streak
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 transition-all duration-700" style={{ width: `${productivityScore.score}%` }} />
                </div>
              </>
            ) : (
              <div className="text-3xl font-bold text-white/20">—</div>
            )}
          </motion.div>

          {/* AI Morning Briefing */}
          <motion.div
            className="col-span-1 md:col-span-2 xl:col-span-3 hud-stat-card rounded-xl p-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.4, ease: 'easeOut' }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-cyan-400" />
                <span className="text-white/40 text-xs uppercase tracking-wider">NEXUS Morning Briefing</span>
              </div>
              <div className="flex items-center gap-2">
                {briefing && (
                  <Link href="/daily-summaries" className="text-white/25 hover:text-cyan-400 text-xs transition-colors">View all →</Link>
                )}
                <button
                  onClick={generateBriefing}
                  disabled={generatingBriefing}
                  className="text-white/25 hover:text-cyan-400 transition-colors p-1 rounded"
                  title="Generate briefing"
                >
                  {generatingBriefing ? <Loader2 size={12} className="animate-spin text-cyan-400" /> : <RotateCcw size={12} />}
                </button>
              </div>
            </div>
            {briefingLoading ? (
              <div className="space-y-2">
                {[80,65,75].map((w,i) => <div key={i} className="h-2.5 bg-white/5 rounded animate-pulse" style={{ width: `${w}%` }} />)}
              </div>
            ) : briefing ? (
              <p className="text-white/65 text-sm leading-relaxed line-clamp-3">
                {briefing.replace(/#{1,3} /g, '').replace(/\*\*/g, '').replace(/\n/g, ' ').slice(0, 280)}
                {briefing.length > 280 && '…'}
              </p>
            ) : (
              <div className="flex items-center gap-3">
                <p className="text-white/30 text-sm flex-1">No briefing for today yet.</p>
                <button
                  onClick={generateBriefing}
                  disabled={generatingBriefing}
                  className="text-xs text-cyan-400 border border-cyan-400/30 rounded-lg px-3 py-1.5 hover:bg-cyan-400/10 transition-colors disabled:opacity-40 flex items-center gap-1.5"
                >
                  {generatingBriefing ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                  Generate
                </button>
              </div>
            )}
          </motion.div>

          {/* Client-side dynamic components */}
          {clientDashData && (
            <DashboardClient
              initialData={clientDashData}
              userId=""
            />
          )}

          {/* Calendar + Live Data Row */}
          <motion.div
            className="col-span-full grid grid-cols-1 lg:grid-cols-3 gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.4, ease: 'easeOut' }}
          >
            <div className="lg:col-span-1">
              <CalendarWidget />
            </div>
          </motion.div>

          {/* Live Data Row */}
          <motion.div
            className="col-span-full grid grid-cols-1 md:grid-cols-3 gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.4, ease: 'easeOut' }}
          >
            <WeatherWidget />
            <NewsWidget />
            <CryptoWidget />
          </motion.div>
        </div>
      </div>
    </div>
  )
}
