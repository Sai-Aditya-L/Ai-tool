import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { anthropic } from '@/lib/anthropic'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

interface DigestItem {
  priority: 'critical' | 'high' | 'medium'
  text: string
  action: string
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const rl = rateLimit(`digest:${user.id}`, 5, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const now = new Date()
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  // Fetch all data in parallel
  const [
    overdueTasks,
    todayReminders,
    recentNotifications,
    calendarEvents,
    activeAgentRuns,
    recentActivity,
  ] = await Promise.all([
    // Overdue tasks
    prisma.task.findMany({
      where: { userId: user.id, dueDate: { lt: now }, status: 'pending' },
      orderBy: { dueDate: 'asc' },
      take: 10,
    }).catch(() => []),

    // Today's reminders
    prisma.reminder.findMany({
      where: { userId: user.id, dueAt: { gte: now, lte: endOfDay }, status: 'pending' },
      orderBy: { dueAt: 'asc' },
      take: 10,
    }).catch(() => []),

    // Recent notifications (unread, last 20)
    prisma.notification.findMany({
      where: { userId: user.id, read: false },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }).catch(() => []),

    // Upcoming calendar events in next 24h
    prisma.calendarEvent.findMany({
      where: { userId: user.id, startTime: { gte: now, lte: next24h } },
      orderBy: { startTime: 'asc' },
      take: 10,
    }).catch(() => []),

    // Active agent runs
    prisma.agentRun.findMany({
      where: { userId: user.id, status: 'running' },
      include: { agent: { select: { name: true } } },
      take: 5,
    }).catch(() => []),

    // Fallback: recent activity log if no notifications
    prisma.activityLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }).catch(() => []),
  ])

  // Build context string for Claude
  const contextParts: string[] = []

  if (overdueTasks.length > 0) {
    contextParts.push(
      `OVERDUE TASKS (${overdueTasks.length}):\n` +
      overdueTasks.map(t => `- [${t.priority}] "${t.title}" was due ${t.dueDate?.toISOString()}`).join('\n')
    )
  }

  if (todayReminders.length > 0) {
    contextParts.push(
      `TODAY'S REMINDERS (${todayReminders.length}):\n` +
      todayReminders.map(r => `- [${r.priority}] "${r.title}" at ${r.dueAt.toISOString()}`).join('\n')
    )
  }

  const notifSource = recentNotifications.length > 0 ? recentNotifications : []
  if (notifSource.length > 0) {
    contextParts.push(
      `UNREAD NOTIFICATIONS (${notifSource.length}):\n` +
      notifSource.map(n => `- [${n.type}] ${n.title}: ${n.body}`).join('\n')
    )
  } else if (recentActivity.length > 0) {
    contextParts.push(
      `RECENT ACTIVITY (${recentActivity.length}):\n` +
      recentActivity.slice(0, 10).map(a => `- ${a.action}: ${a.details}`).join('\n')
    )
  }

  if (calendarEvents.length > 0) {
    contextParts.push(
      `UPCOMING EVENTS (next 24h, ${calendarEvents.length}):\n` +
      calendarEvents.map(e => `- "${e.title}" at ${e.startTime.toISOString()}`).join('\n')
    )
  }

  if (activeAgentRuns.length > 0) {
    contextParts.push(
      `ACTIVE AGENT RUNS (${activeAgentRuns.length}):\n` +
      activeAgentRuns.map(r => `- Agent "${(r as any).agent?.name || r.agentId}" running task: "${r.task}"`).join('\n')
    )
  }

  if (contextParts.length === 0) {
    return NextResponse.json({
      digest: [],
      summary: 'Everything is on track. No urgent items require your attention right now.',
      generatedAt: now.toISOString(),
    })
  }

  const context = `Current time: ${now.toISOString()}\nUser: ${user.name || user.email}\n\n${contextParts.join('\n\n')}`

  // Try AI-powered digest first
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: 'You are NEXUS Digest Engine. Given the user\'s current state, produce a ranked smart digest: 3-5 bullet points of what needs attention RIGHT NOW, ordered by urgency. Format as JSON: { "items": [{ "priority": "critical"|"high"|"medium", "text": string, "action": string }], "summary": string }',
      messages: [{ role: 'user', content: context }],
    })

    const rawText = response.content.find(b => b.type === 'text')?.text || ''

    // Extract JSON from the response (handle markdown code blocks)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return NextResponse.json({
        digest: parsed.items as DigestItem[],
        summary: parsed.summary as string,
        generatedAt: now.toISOString(),
      })
    }
  } catch {
    // Fall through to simple digest
  }

  // Fallback: simple non-AI digest
  const fallbackItems: DigestItem[] = []

  overdueTasks.slice(0, 2).forEach(t => {
    fallbackItems.push({
      priority: t.priority === 'urgent' ? 'critical' : t.priority === 'high' ? 'high' : 'medium',
      text: `Overdue task: "${t.title}"`,
      action: 'Review and complete or reschedule this task',
    })
  })

  todayReminders.slice(0, 2).forEach(r => {
    fallbackItems.push({
      priority: r.priority === 'urgent' ? 'critical' : r.priority === 'high' ? 'high' : 'medium',
      text: `Reminder due today: "${r.title}"`,
      action: `Complete by ${r.dueAt.toLocaleTimeString()}`,
    })
  })

  calendarEvents.slice(0, 1).forEach(e => {
    fallbackItems.push({
      priority: 'high',
      text: `Upcoming event: "${e.title}"`,
      action: `Prepare for event starting at ${e.startTime.toLocaleTimeString()}`,
    })
  })

  return NextResponse.json({
    digest: fallbackItems,
    summary: `You have ${overdueTasks.length} overdue task(s), ${todayReminders.length} reminder(s) due today, and ${calendarEvents.length} upcoming event(s) in the next 24 hours.`,
    generatedAt: now.toISOString(),
  })
}
