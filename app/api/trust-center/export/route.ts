import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { preferences: true },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  // Fetch all user data in parallel
  const [
    tasks,
    reminders,
    notes,
    memories,
    conversations,
    calendarEvents,
    files,
    trackers,
    automations,
    activityLogs,
    goals,
  ] = await Promise.all([
    prisma.task.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.reminder.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.note.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.memory.findMany({
      where: { userId: user.id },
      orderBy: [{ category: 'asc' }, { updatedAt: 'desc' }],
    }),
    prisma.conversation.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: { role: true, content: true, createdAt: true },
        },
      },
    }),
    prisma.calendarEvent.findMany({
      where: { userId: user.id },
      orderBy: { startTime: 'desc' },
    }),
    prisma.userFile.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        originalName: true,
        mimeType: true,
        size: true,
        summary: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
        // Exclude actual file path/url for security
      },
    }),
    prisma.tracker.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.automation.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.activityLog.findMany({
      where: { userId: user.id, createdAt: { gte: thirtyDaysAgo } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.goal.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const exportData = {
    exportedAt: new Date().toISOString(),
    exportVersion: '1.0',
    user: {
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      preferences: user.preferences
        ? {
            assistantName: user.preferences.assistantName,
            aiModel: user.preferences.aiModel,
            aiProvider: user.preferences.aiProvider,
            memoryEnabled: user.preferences.memoryEnabled,
            voiceEnabled: user.preferences.voiceEnabled,
            notificationsOn: user.preferences.notificationsOn,
            timezone: user.preferences.timezone,
            language: user.preferences.language,
            theme: user.preferences.theme,
          }
        : null,
    },
    data: {
      tasks,
      reminders,
      notes,
      memories,
      conversations,
      calendarEvents,
      files,
      trackers,
      automations,
      activityLogs,
      goals,
    },
    counts: {
      tasks: tasks.length,
      reminders: reminders.length,
      notes: notes.length,
      memories: memories.length,
      conversations: conversations.length,
      calendarEvents: calendarEvents.length,
      files: files.length,
      trackers: trackers.length,
      automations: automations.length,
      activityLogs: activityLogs.length,
      goals: goals.length,
    },
  }

  const json = JSON.stringify(exportData, null, 2)
  const filename = `nexus-export-${new Date().toISOString().split('T')[0]}.json`

  // Log the export event
  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: 'DATA_EXPORT',
      entityType: 'system',
      details: `User exported all data (${Object.values(exportData.counts).reduce((a, b) => a + b, 0)} records)`,
    },
  })

  return new NextResponse(json, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
