import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { anthropic } from '@/lib/anthropic'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const summaries = await prisma.dailySummary.findMany({
    where: { userId: user.id },
    orderBy: { date: 'desc' },
    take: 30,
  })

  return NextResponse.json({ summaries })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const type: 'daily' | 'weekly' = body.type === 'weekly' ? 'weekly' : 'daily'

  // 1. Get today's date YYYY-MM-DD
  const today = new Date()
  const date = today.toISOString().split('T')[0]

  // 2. Check if summary already exists for today
  const existing = await prisma.dailySummary.findUnique({
    where: { userId_date: { userId: user.id, date } },
  })

  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

  // 3. Fetch data
  const [pendingTasks, todayReminders, upcomingReminders, recentActivity, unreadCount] = await Promise.all([
    prisma.task.findMany({
      where: { userId: user.id, status: { in: ['pending', 'in_progress'] } },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      take: 10,
    }),
    prisma.reminder.findMany({
      where: { userId: user.id, status: 'pending', dueAt: { gte: startOfDay, lte: endOfDay } },
      orderBy: { dueAt: 'asc' },
    }),
    prisma.reminder.findMany({
      where: { userId: user.id, status: 'pending', dueAt: { gte: now } },
      orderBy: { dueAt: 'asc' },
      take: 5,
    }),
    prisma.activityLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
  ])

  // 4. Build prompt
  const tasksList = pendingTasks.length > 0
    ? pendingTasks.map((t, i) => `  ${i + 1}. [${t.priority.toUpperCase()}] ${t.title}${t.dueDate ? ` (due: ${new Date(t.dueDate).toLocaleDateString()})` : ''}`).join('\n')
    : '  No pending tasks.'

  const todayRemindersList = todayReminders.length > 0
    ? todayReminders.map(r => `  - ${r.title} at ${new Date(r.dueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`).join('\n')
    : '  No reminders today.'

  const upcomingRemindersList = upcomingReminders.length > 0
    ? upcomingReminders.map(r => `  - ${r.title} (${new Date(r.dueAt).toLocaleDateString()})`).join('\n')
    : '  No upcoming reminders.'

  const activityList = recentActivity.length > 0
    ? recentActivity.map(a => `  - ${a.action.replace(/_/g, ' ')}: ${a.details || ''}`).join('\n')
    : '  No recent activity.'

  const prompt = `Generate a ${type} briefing for ${today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

USER DATA:

Pending Tasks (top ${pendingTasks.length}):
${tasksList}

Today's Reminders:
${todayRemindersList}

Upcoming Reminders:
${upcomingRemindersList}

Recent Activity:
${activityList}

Quick Stats:
  - Unread notifications: ${unreadCount}
  - Tasks pending: ${pendingTasks.length}
  - Today's reminders: ${todayReminders.length}

Please generate a comprehensive ${type} briefing incorporating all this data.`

  // 5. Call Anthropic
  const aiResult = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: 'You are NEXUS. Generate a comprehensive daily briefing. Use markdown with ## headers. Be concise but insightful. Include: greeting, tasks overview, reminders, quick stats, and motivational closing.',
    messages: [{ role: 'user', content: prompt }],
  })

  const content = (aiResult.content.find(b => b.type === 'text') as { type: 'text'; text: string } | undefined)?.text || 'Briefing generated.'

  // 6. Upsert the DailySummary
  const summary = await prisma.dailySummary.upsert({
    where: { userId_date: { userId: user.id, date } },
    create: { userId: user.id, date, content, type },
    update: { content, type },
  })

  return NextResponse.json({ summary })
}
