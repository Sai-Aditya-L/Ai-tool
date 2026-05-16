import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { anthropic } from '@/lib/anthropic'

export const dynamic = 'force-dynamic'

const cache = new Map<string, { suggestions: string[]; expiresAt: number }>()

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cached = cache.get(user.id)
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ suggestions: cached.suggestions })
  }

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
  const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000)

  const [overdueTasks, todayTasks, urgentTasks, soonReminders, todayEvents, activeHabits, habitEntriesToday] = await Promise.all([
    prisma.task.count({ where: { userId: user.id, status: { in: ['pending', 'in_progress'] }, dueDate: { lt: todayStart } } }),
    prisma.task.findMany({ where: { userId: user.id, status: { in: ['pending', 'in_progress'] }, dueDate: { gte: todayStart, lte: todayEnd } }, take: 3, select: { title: true, priority: true } }),
    prisma.task.count({ where: { userId: user.id, status: { not: 'completed' }, priority: 'urgent' } }),
    prisma.reminder.findMany({ where: { userId: user.id, status: 'pending', dueAt: { gte: now, lte: in2h } }, take: 2, select: { title: true, dueAt: true } }),
    prisma.calendarEvent.count({ where: { userId: user.id, startTime: { gte: todayStart, lte: todayEnd } } }),
    prisma.habit.count({ where: { userId: user.id, status: 'active' } }),
    prisma.habitEntry.count({ where: { userId: user.id, createdAt: { gte: todayStart } } }),
  ])

  const contextParts: string[] = [
    `Time: ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} on ${now.toLocaleDateString('en-US', { weekday: 'long' })}`,
    overdueTasks > 0 ? `${overdueTasks} overdue task${overdueTasks > 1 ? 's' : ''}` : null,
    urgentTasks > 0 ? `${urgentTasks} urgent task${urgentTasks > 1 ? 's' : ''}` : null,
    todayTasks.length > 0 ? `${todayTasks.length} task${todayTasks.length > 1 ? 's' : ''} due today: ${todayTasks.map(t => `"${t.title}"`).join(', ')}` : null,
    soonReminders.length > 0 ? `Reminder in <2h: "${soonReminders[0].title}"` : null,
    todayEvents > 0 ? `${todayEvents} calendar event${todayEvents > 1 ? 's' : ''} today` : null,
    activeHabits > 0 ? `${habitEntriesToday}/${activeHabits} habits logged today` : null,
  ].filter(Boolean) as string[]

  const context = contextParts.join('. ')

  const aiResponse = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: 'Return JSON only: {"suggestions": ["...", "...", "..."]}. Generate exactly 3 short, specific, actionable suggestions for NEXUS to say/do right now based on the user\'s current state. Each suggestion should be 5-12 words, starting with an action verb. Examples: "Review the 2 overdue tasks from yesterday", "Log your morning habit check-in now", "Your standup meeting starts in 45 minutes". Be direct and specific.',
    messages: [{ role: 'user', content: context || 'No active tasks or reminders.' }],
  })

  const raw = aiResponse.content.find(b => b.type === 'text')?.text ?? '{}'
  let suggestions: string[]
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    suggestions = match ? JSON.parse(match[0]).suggestions : []
  } catch {
    suggestions = []
  }

  if (!suggestions || suggestions.length === 0) {
    suggestions = ['Ask NEXUS what\'s on your schedule today', 'Start a focus session to boost your score', 'Review your active goals and update progress']
  }

  cache.set(user.id, { suggestions, expiresAt: Date.now() + 30 * 60 * 1000 })

  return NextResponse.json({ suggestions })
}
