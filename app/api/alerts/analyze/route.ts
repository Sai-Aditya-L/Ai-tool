import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { anthropic } from '@/lib/anthropic'

export const dynamic = 'force-dynamic'

// Only run analysis once per 30 minutes per user
const lastAnalysis = new Map<string, number>()

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Rate limit: max once per 30 min
  const last = lastAnalysis.get(user.id) || 0
  if (Date.now() - last < 30 * 60 * 1000) {
    return NextResponse.json({ skipped: true, message: 'Analysis ran recently, next check in 30 min' })
  }
  lastAnalysis.set(user.id, Date.now())

  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const [overdueTasks, urgentTasks, upcomingReminders, overdueReminders, unreadNotifications, recentActivity] = await Promise.all([
    prisma.task.findMany({
      where: { userId: user.id, status: { in: ['pending', 'in_progress'] }, dueDate: { lt: now } },
      orderBy: { dueDate: 'asc' }, take: 10,
    }),
    prisma.task.findMany({
      where: { userId: user.id, priority: 'urgent', status: { not: 'completed' } },
      take: 5,
    }),
    prisma.reminder.findMany({
      where: { userId: user.id, status: 'pending', dueAt: { gte: now, lte: in24h } },
      orderBy: { dueAt: 'asc' }, take: 10,
    }),
    prisma.reminder.findMany({
      where: { userId: user.id, status: 'pending', dueAt: { lt: now } },
      orderBy: { dueAt: 'asc' }, take: 5,
    }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
    prisma.activityLog.findMany({
      where: { userId: user.id, createdAt: { gte: yesterday } },
      orderBy: { createdAt: 'desc' }, take: 20,
    }),
  ])

  const contextData = {
    currentTime: now.toISOString(),
    overdueTasks: overdueTasks.map(t => ({ title: t.title, dueDate: t.dueDate, priority: t.priority })),
    urgentTasks: urgentTasks.map(t => ({ title: t.title, priority: t.priority })),
    upcomingReminders: upcomingReminders.map(r => ({ title: r.title, dueAt: r.dueAt })),
    overdueReminders: overdueReminders.map(r => ({ title: r.title, dueAt: r.dueAt })),
    unreadNotifications,
    recentActivityCount: recentActivity.length,
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `You are NEXUS, analyzing a user's current situation to generate proactive alerts. Review this data and identify the most important things the user should be aware of RIGHT NOW.

Current situation:
${JSON.stringify(contextData, null, 2)}

Generate 1-4 proactive alerts in this exact JSON format (no markdown, just JSON):
{
  "alerts": [
    {
      "title": "Short alert title",
      "message": "Specific, actionable message (max 120 chars)",
      "priority": "critical|high|medium|low",
      "category": "task|reminder|calendar|general"
    }
  ]
}

Only generate alerts for genuinely important things. If everything looks fine, return {"alerts": []}.
Focus on: overdue items, upcoming deadlines in <2 hours, critical urgent tasks.`,
    }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
  let parsed: { alerts: Array<{ title: string; message: string; priority: string; category: string }> }
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { alerts: [] }
  } catch {
    parsed = { alerts: [] }
  }

  // Save alerts to notifications
  const created = []
  for (const alert of (parsed.alerts || []).slice(0, 4)) {
    const notification = await prisma.notification.create({
      data: {
        userId: user.id,
        title: alert.title,
        body: `[${alert.priority.toUpperCase()}] ${alert.message}`,
        type: 'proactive_alert',
      },
    })
    created.push(notification)
  }

  return NextResponse.json({ alerts: created, analyzed: true })
}

// GET: return current proactive alerts for the user
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const alerts = await prisma.notification.findMany({
    where: { userId: user.id, type: 'proactive_alert', read: false },
    orderBy: [{ createdAt: 'desc' }],
    take: 20,
  })

  return NextResponse.json({ alerts })
}
