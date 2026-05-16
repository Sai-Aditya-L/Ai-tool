import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const now = new Date()
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  const [
    upcomingEvents,
    overdueTasks,
    dueTodayTasks,
    pendingReminders,
    activeAgents,
    pendingApprovals,
    activeAutomations,
    recentActivity,
    goalProgress,
    memoryCount,
    unreadNotifications,
  ] = await Promise.all([
    // Upcoming events: next 7 days
    prisma.calendarEvent.findMany({
      where: { userId: user.id, startTime: { gte: now, lte: in7Days } },
      orderBy: { startTime: 'asc' },
      select: { id: true, title: true, startTime: true, endTime: true, location: true, allDay: true, status: true },
      take: 20,
    }),
    // Overdue tasks: past dueDate, not completed
    prisma.task.findMany({
      where: { userId: user.id, status: { not: 'completed' }, dueDate: { lt: now } },
      orderBy: { dueDate: 'asc' },
      select: { id: true, title: true, dueDate: true, priority: true, status: true },
      take: 20,
    }),
    // Due today tasks
    prisma.task.findMany({
      where: { userId: user.id, status: { not: 'completed' }, dueDate: { gte: startOfToday, lte: endOfToday } },
      orderBy: { priority: 'asc' },
      select: { id: true, title: true, dueDate: true, priority: true, status: true },
      take: 20,
    }),
    // Pending reminders: due in next 24h
    prisma.reminder.findMany({
      where: { userId: user.id, status: 'pending', dueAt: { gte: now, lte: in24h } },
      orderBy: { dueAt: 'asc' },
      select: { id: true, title: true, dueAt: true, priority: true },
      take: 20,
    }),
    // Active agent runs
    prisma.agentRun.findMany({
      where: { userId: user.id, status: { in: ['running', 'pending'] } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, task: true, status: true, createdAt: true, agentId: true },
      take: 10,
    }),
    // Pending approvals
    prisma.agentRun.findMany({
      where: { userId: user.id, status: 'needs_approval' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, task: true, status: true, createdAt: true, agentId: true },
      take: 10,
    }),
    // Active automations
    prisma.automation.findMany({
      where: { userId: user.id, status: 'active' },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, status: true, trigger: true, lastRun: true, runCount: true },
      take: 10,
    }),
    // Recent activity: last 10
    prisma.activityLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, action: true, entityType: true, details: true, createdAt: true },
      take: 10,
    }),
    // Active goals with progress
    prisma.goal.findMany({
      where: { userId: user.id, status: 'active' },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, progress: true, targetDate: true, category: true, priority: true },
      take: 10,
    }),
    // Memory count
    prisma.memory.count({ where: { userId: user.id } }),
    // Unread notifications: last 10
    prisma.notification.findMany({
      where: { userId: user.id, read: false },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, body: true, type: true, createdAt: true },
      take: 10,
    }),
  ])

  return NextResponse.json(
    {
      timestamp: Date.now(),
      upcomingEvents,
      overdueTasks,
      dueTodayTasks,
      pendingReminders,
      activeAgents,
      pendingApprovals,
      activeAutomations,
      recentActivity,
      goalProgress,
      memoryCount,
      unreadNotifications,
    },
    {
      headers: { 'Cache-Control': 'no-cache' },
    }
  )
}
