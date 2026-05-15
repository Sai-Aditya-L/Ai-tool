import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { preferences: true },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)
  const startOfWeek = new Date(startOfDay.getTime() - startOfDay.getDay() * 24 * 60 * 60 * 1000)

  const [
    pendingTasks,
    completedTasksToday,
    urgentTasks,
    overdueReminders,
    todayReminders,
    upcomingReminders,
    activeAutomations,
    connectedIntegrations,
    recentActivity,
    memoriesCount,
    notesCount,
    weeklyTasksCompleted,
    trackers,
  ] = await Promise.all([
    prisma.task.count({ where: { userId: user.id, status: { in: ['pending', 'in_progress'] } } }),
    prisma.task.count({ where: { userId: user.id, status: 'completed', completedAt: { gte: startOfDay, lte: endOfDay } } }),
    prisma.task.findMany({
      where: { userId: user.id, priority: 'urgent', status: { not: 'completed' } },
      orderBy: { dueDate: 'asc' },
      take: 3,
    }),
    prisma.reminder.count({ where: { userId: user.id, status: 'pending', dueAt: { lt: now } } }),
    prisma.reminder.findMany({
      where: { userId: user.id, status: 'pending', dueAt: { gte: startOfDay, lte: endOfDay } },
      orderBy: { dueAt: 'asc' },
    }),
    prisma.reminder.findMany({
      where: { userId: user.id, status: 'pending', dueAt: { gte: now } },
      orderBy: { dueAt: 'asc' },
      take: 5,
    }),
    prisma.automation.count({ where: { userId: user.id, status: 'active' } }),
    prisma.integration.count({ where: { userId: user.id, status: 'connected' } }),
    prisma.activityLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    prisma.memory.count({ where: { userId: user.id } }),
    prisma.note.count({ where: { userId: user.id } }),
    prisma.task.count({
      where: { userId: user.id, status: 'completed', completedAt: { gte: startOfWeek } },
    }),
    prisma.tracker.findMany({
      where: { userId: user.id, status: 'active' },
      orderBy: [{ dueDate: 'asc' }],
      take: 5,
    }),
  ])

  const recentTasks = await prisma.task.findMany({
    where: { userId: user.id, status: { in: ['pending', 'in_progress'] } },
    orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    take: 5,
    include: { subtasks: { take: 3 } },
  })

  return NextResponse.json({
    user: { name: user.name, email: user.email, image: user.image },
    preferences: user.preferences,
    stats: {
      pendingTasks,
      completedTasksToday,
      urgentTasks: urgentTasks.length,
      overdueReminders,
      todayRemindersCount: todayReminders.length,
      activeAutomations,
      connectedIntegrations,
      memoriesCount,
      notesCount,
      weeklyTasksCompleted,
    },
    data: {
      urgentTasks,
      todayReminders,
      upcomingReminders,
      recentActivity,
      recentTasks,
      trackers,
    },
  })
}
