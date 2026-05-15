import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Header } from '@/components/layout/header'
import { AIOrb } from '@/components/dashboard/ai-orb'
import { DashboardClient } from '@/components/dashboard/dashboard-client'
import { WeatherWidget } from '@/components/dashboard/weather-widget'
import { NewsWidget } from '@/components/dashboard/news-widget'
import { CryptoWidget } from '@/components/dashboard/crypto-widget'
import { CalendarWidget } from '@/components/dashboard/calendar-widget'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  const user = await prisma.user.findUnique({
    where: { email: session!.user!.email! },
    include: { preferences: true },
  })

  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

  const [
    pendingTasks,
    completedToday,
    todayReminders,
    upcomingReminders,
    recentActivity,
    urgentTasks,
    recentTasks,
    trackers,
    unreadNotifications,
    upcomingFiles,
    agentRuns,
    todayEvents,
    unreadEmailCount,
  ] = await Promise.all([
    prisma.task.count({ where: { userId: user!.id, status: { in: ['pending', 'in_progress'] } } }),
    prisma.task.count({ where: { userId: user!.id, status: 'completed', completedAt: { gte: startOfDay } } }),
    prisma.reminder.findMany({
      where: { userId: user!.id, status: 'pending', dueAt: { gte: startOfDay, lte: endOfDay } },
      orderBy: { dueAt: 'asc' },
    }),
    prisma.reminder.findMany({
      where: { userId: user!.id, status: 'pending', dueAt: { gte: now } },
      orderBy: { dueAt: 'asc' },
      take: 5,
    }),
    prisma.activityLog.findMany({
      where: { userId: user!.id },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    prisma.task.findMany({
      where: { userId: user!.id, priority: 'urgent', status: { not: 'completed' } },
      take: 3,
    }),
    prisma.task.findMany({
      where: { userId: user!.id, status: { in: ['pending', 'in_progress'] } },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      take: 6,
    }),
    prisma.tracker.findMany({
      where: { userId: user!.id, status: 'active' },
      orderBy: { dueDate: 'asc' },
      take: 4,
    }),
    prisma.notification.count({ where: { userId: user!.id, read: false } }),
    prisma.userFile.findMany({ where: { userId: user!.id }, orderBy: { createdAt: 'desc' }, take: 3 }),
    prisma.agentRun.findMany({ where: { userId: user!.id }, orderBy: { createdAt: 'desc' }, take: 5, include: { agent: true } }),
    prisma.reminder.findMany({
      where: { userId: user!.id, status: 'pending', dueAt: { gte: startOfDay, lte: endOfDay } },
      orderBy: { dueAt: 'asc' },
      take: 5,
    }),
    prisma.emailCache.count({ where: { userId: user!.id, isRead: false } }).catch(() => 0),
  ])

  const dashData = {
    stats: { pendingTasks, completedToday, todayRemindersCount: todayReminders.length, unreadNotifications, unreadEmailCount },
    data: { todayReminders, upcomingReminders, recentActivity, urgentTasks, recentTasks, trackers, recentFiles: upcomingFiles, agentRuns, todayEvents },
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Command Center"
        subtitle={`${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}
      />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-[1600px] mx-auto">

          {/* AI Orb - spans 1 col */}
          <div className="lg:row-span-2">
            <AIOrb userName={user?.name} />
          </div>

          {/* Stats row */}
          <div className="hud-stat-card rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="text-white/40 text-xs uppercase tracking-wider">Pending Tasks</div>
              <div className="w-8 h-8 rounded-lg bg-yellow-400/10 flex items-center justify-center">
                <span className="text-yellow-400 text-sm">⬡</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{pendingTasks}</div>
            <div className="text-green-400 text-xs">{completedToday} completed today</div>
          </div>

          <div className="hud-stat-card rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="text-white/40 text-xs uppercase tracking-wider">Today&apos;s Reminders</div>
              <div className="w-8 h-8 rounded-lg bg-cyan-400/10 flex items-center justify-center">
                <span className="text-cyan-400 text-sm">◎</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{todayReminders.length}</div>
            <div className="text-cyan-400/60 text-xs">{upcomingReminders.length} upcoming total</div>
          </div>

          <div className="hud-stat-card rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="text-white/40 text-xs uppercase tracking-wider">Urgent Tasks</div>
              <div className="w-8 h-8 rounded-lg bg-red-400/10 flex items-center justify-center">
                <span className="text-red-400 text-sm">⚠</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{urgentTasks.length}</div>
            <div className="text-red-400/60 text-xs">Needs attention</div>
          </div>

          {/* Unread Notifications stat card */}
          <div className="hud-stat-card rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="text-white/40 text-xs uppercase tracking-wider">Unread Notifications</div>
              <div className="w-8 h-8 rounded-lg bg-yellow-400/10 flex items-center justify-center">
                <span className="text-yellow-400 text-sm">🔔</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{unreadNotifications}</div>
            <div className="text-yellow-400/60 text-xs">Awaiting review</div>
          </div>

          {/* Unread Emails stat card */}
          <div className="hud-stat-card rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="text-white/40 text-xs uppercase tracking-wider">Unread Emails</div>
              <div className="w-8 h-8 rounded-lg bg-cyan-400/10 flex items-center justify-center">
                <span className="text-cyan-400 text-sm">✉</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{unreadEmailCount}</div>
            <Link href="/emails" className="text-cyan-400/60 text-xs hover:text-cyan-400 transition-colors">
              View emails →
            </Link>
          </div>

          {/* Client-side dynamic components */}
          <DashboardClient
            initialData={dashData}
            userId={user!.id}
          />

          {/* Calendar + Live Data Row */}
          <div className="col-span-full grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1">
              <CalendarWidget />
            </div>
          </div>

          {/* Live Data Row */}
          <div className="col-span-full grid grid-cols-1 md:grid-cols-3 gap-4">
            <WeatherWidget />
            <NewsWidget />
            <CryptoWidget />
          </div>
        </div>
      </div>
    </div>
  )
}
