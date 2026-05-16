import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch {
    return fallback
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) {
    return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 })
  }

  const userId = user.id

  const [
    tasks,
    notes,
    reminders,
    memories,
    calendarEvents,
    files,
    goals,
    habits,
    automations,
    agents,
    activityLog,
    trackers,
    notifications,
  ] = await Promise.all([
    safeQuery(() => prisma.task.findMany({ where: { userId } }), []),
    safeQuery(() => prisma.note.findMany({ where: { userId } }), []),
    safeQuery(() => prisma.reminder.findMany({ where: { userId } }), []),
    safeQuery(() => prisma.memory.findMany({ where: { userId } }), []),
    safeQuery(() => prisma.calendarEvent.findMany({ where: { userId } }), []),
    safeQuery(() => prisma.userFile.findMany({ where: { userId } }), []),
    safeQuery(
      () => prisma.goal.findMany({ where: { userId }, include: { milestones: true } }),
      []
    ),
    safeQuery(
      () => prisma.habit.findMany({ where: { userId }, include: { entries: true } }),
      []
    ),
    safeQuery(() => prisma.automation.findMany({ where: { userId } }), []),
    safeQuery(() => prisma.agent.findMany({ where: { userId } }), []),
    safeQuery(
      () =>
        prisma.activityLog.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 1000,
        }),
      []
    ),
    safeQuery(() => prisma.tracker.findMany({ where: { userId } }), []),
    safeQuery(
      () =>
        prisma.notification.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 500,
        }),
      []
    ),
  ])

  const exportData = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    userId,
    data: {
      tasks,
      notes,
      reminders,
      memories,
      calendarEvents,
      files,
      goals,
      habits,
      automations,
      agents,
      activityLog,
      trackers,
      notifications,
    },
  }

  const dateStr = new Date().toISOString().split('T')[0]

  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="nexus-export-${dateStr}.json"`,
    },
  })
}
