import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { anthropic } from '@/lib/anthropic'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const cache = new Map<string, { data: unknown; ts: number }>()
const CACHE_TTL = 30 * 60 * 1000

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = await rateLimit(`goals-coach:${session.user.email}`, 10, 60000)
  if (!limited.allowed) return rateLimitResponse()

  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cached = cache.get(user.id)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data)
  }

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [goals, recentTasks, recentFocus, habits] = await Promise.all([
    prisma.goal.findMany({
      where: { userId: user.id, status: { not: 'cancelled' } },
      include: { milestones: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.task.findMany({
      where: { userId: user.id, createdAt: { gte: thirtyDaysAgo } },
      select: { title: true, status: true, priority: true, dueDate: true },
      take: 50,
    }),
    prisma.focusSession.findMany({
      where: { userId: user.id, completed: true, createdAt: { gte: thirtyDaysAgo } },
      select: { actualMins: true, taskTitle: true, createdAt: true },
      take: 30,
    }),
    prisma.habit.findMany({
      where: { userId: user.id, status: 'active' },
      include: {
        entries: {
          where: { completed: true, createdAt: { gte: thirtyDaysAgo } },
          select: { date: true },
        },
      },
      take: 10,
    }),
  ])

  if (goals.length === 0) {
    return NextResponse.json({ advice: [], summary: 'No goals set yet. Create your first goal to get personalized coaching!', momentum: 'neutral' })
  }

  const totalFocusMins = recentFocus.reduce((s, f) => s + (f.actualMins ?? 0), 0)
  const completedTasks = recentTasks.filter(t => t.status === 'completed').length
  const pendingTasks = recentTasks.filter(t => t.status === 'pending').length
  const overdueTasks = recentTasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed').length

  const habitConsistency = habits.map(h => {
    const daysActive = new Set(h.entries.map(e => e.date)).size
    const pct = Math.round((daysActive / 30) * 100)
    return `${h.title}: ${pct}% consistency`
  }).join(', ')

  const goalsStr = goals.map(g => {
    const milestonesTotal = g.milestones.length
    const milestonesCompleted = g.milestones.filter(m => m.completed).length
    const daysLeft = g.targetDate ? Math.ceil((new Date(g.targetDate).getTime() - now.getTime()) / 86400000) : null
    return `Goal: "${g.title}" [${g.category}] — Progress: ${g.progress}%, Milestones: ${milestonesCompleted}/${milestonesTotal}, Status: ${g.status}${daysLeft !== null ? `, Days left: ${daysLeft}` : ''}`
  }).join('\n')

  const context = `Analyze this person's goal progress and provide coaching:

GOALS (last 30 days):
${goalsStr}

PRODUCTIVITY DATA (last 30 days):
- Focus sessions: ${recentFocus.length} sessions, ${totalFocusMins} total minutes
- Tasks completed: ${completedTasks}, Pending: ${pendingTasks}, Overdue: ${overdueTasks}
- Habit consistency: ${habitConsistency || 'No active habits'}

Provide personalized coaching. Return JSON:
{
  "summary": "2-3 sentence overall assessment",
  "momentum": "rising"|"steady"|"falling",
  "advice": [
    {"goalTitle": "...", "insight": "specific observation", "action": "concrete next step", "urgency": "high"|"medium"|"low"}
  ],
  "topPriority": "the single most important thing to focus on right now"
}
Max 4 advice items. Be specific and actionable, not generic.`

  const aiRes = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{ role: 'user', content: context }],
  })

  const raw = aiRes.content.find(b => b.type === 'text')?.text ?? '{}'
  let result: { summary: string; momentum: string; advice: unknown[]; topPriority?: string }
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    result = match ? JSON.parse(match[0]) : { summary: '', momentum: 'steady', advice: [] }
  } catch {
    result = { summary: 'Could not analyze goals right now.', momentum: 'steady', advice: [] }
  }

  cache.set(user.id, { data: result, ts: Date.now() })
  return NextResponse.json(result)
}
