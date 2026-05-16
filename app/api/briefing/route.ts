import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { anthropic } from '@/lib/anthropic'

// In-memory cache: userId -> { briefing, data, generatedAt }
interface BriefingCache {
  briefing: string
  data: {
    taskCount: number
    eventCount: number
    habitsDue: number
    goalsActive: number
  }
  generatedAt: string
}
const cache = new Map<string, BriefingCache>()
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const rl = rateLimit(`briefing:${user.id}`, 10, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  // Check cache
  const cached = cache.get(user.id)
  if (cached) {
    const age = Date.now() - new Date(cached.generatedAt).getTime()
    if (age < CACHE_TTL_MS) {
      return NextResponse.json({ ...cached, cached: true })
    }
  }

  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now)
  todayEnd.setHours(23, 59, 59, 999)
  const todayStr = now.toISOString().split('T')[0]

  // Fetch all briefing data in parallel
  const [
    pendingTasks,
    todayReminders,
    habits,
    activeGoals,
    focusSessions,
  ] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId: user.id,
        status: { in: ['pending', 'in_progress'] },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      take: 20,
    }),
    prisma.reminder.findMany({
      where: {
        userId: user.id,
        status: 'pending',
        dueAt: { gte: todayStart, lte: todayEnd },
      },
      orderBy: { dueAt: 'asc' },
      take: 10,
    }),
    prisma.habit.findMany({
      where: { userId: user.id, status: 'active' },
      include: {
        entries: {
          where: { date: todayStr },
          take: 1,
        },
      },
    }),
    prisma.goal.findMany({
      where: { userId: user.id, status: 'active' },
      select: { id: true, title: true, progress: true, priority: true },
      take: 10,
    }),
    prisma.focusSession.count({
      where: {
        userId: user.id,
        completed: true,
        completedAt: { gte: todayStart, lte: todayEnd },
      },
    }),
  ])

  const habitsDue = habits.filter(h => !h.entries.some(e => e.completed)).length
  const taskCount = pendingTasks.length
  const eventCount = todayReminders.length
  const goalsActive = activeGoals.length

  const urgentTasks = pendingTasks.filter(t => t.priority === 'urgent' || t.priority === 'high')
  const todayDueTasks = pendingTasks.filter(
    t => t.dueDate && new Date(t.dueDate) <= todayEnd
  )

  // Build context string for Claude
  const hour = now.getHours()
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' })

  const contextLines = [
    `Time: ${timeOfDay}, ${dayName}, ${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
    `Pending tasks: ${taskCount} total (${urgentTasks.length} high/urgent priority, ${todayDueTasks.length} due today)`,
    urgentTasks.length > 0
      ? `Top urgent tasks: ${urgentTasks.slice(0, 3).map(t => t.title).join(', ')}`
      : null,
    `Calendar events today: ${eventCount}`,
    eventCount > 0
      ? `Events: ${todayReminders.slice(0, 3).map(r => `${r.title} at ${new Date(r.dueAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`).join(', ')}`
      : null,
    `Habits remaining today: ${habitsDue} of ${habits.length}`,
    `Active goals: ${goalsActive}`,
    goalsActive > 0
      ? `Goals: ${activeGoals.slice(0, 3).map(g => `${g.title} (${g.progress}%)`).join(', ')}`
      : null,
    `Focus sessions completed today: ${focusSessions}`,
  ].filter(Boolean).join('\n')

  // Generate briefing with Claude Haiku
  let briefingText = ''
  try {
    const aiRes = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: `Generate a concise, motivating morning briefing for this person based on their data. Write 2-3 sentences covering key priorities and encouragement. Be direct and actionable. Avoid markdown.\n\nUser data:\n${contextLines}`,
        },
      ],
    })
    briefingText = aiRes.content.find(b => b.type === 'text')?.text || ''
  } catch (err) {
    console.error('[briefing] Claude error:', err)
    briefingText = `Good ${timeOfDay}! You have ${taskCount} tasks pending${urgentTasks.length > 0 ? ` with ${urgentTasks.length} requiring immediate attention` : ''}. ${habitsDue > 0 ? `Don't forget your ${habitsDue} remaining habit${habitsDue > 1 ? 's' : ''} for today.` : 'Your habits are on track!'}`
  }

  const result: BriefingCache = {
    briefing: briefingText,
    data: { taskCount, eventCount, habitsDue, goalsActive },
    generatedAt: new Date().toISOString(),
  }

  cache.set(user.id, result)

  return NextResponse.json(result)
}
