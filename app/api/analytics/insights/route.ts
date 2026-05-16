import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { anthropic } from '@/lib/anthropic'

export const dynamic = 'force-dynamic'

const cache = new Map<string, { insights: object; generatedAt: string; expiresAt: number }>()

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cached = cache.get(user.id)
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ ...cached, cached: true })
  }

  const now = new Date()
  const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  // Gather 4 weeks of data for pattern analysis
  const [
    focusSessions28d,
    tasksCompleted28d,
    habitEntries28d,
    overdueTasks,
    priorityDistribution,
  ] = await Promise.all([
    prisma.focusSession.findMany({
      where: { userId: user.id, completed: true, createdAt: { gte: fourWeeksAgo } },
      select: { createdAt: true, actualMins: true, type: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.task.findMany({
      where: { userId: user.id, status: 'completed', completedAt: { gte: fourWeeksAgo } },
      select: { completedAt: true, priority: true, createdAt: true },
      orderBy: { completedAt: 'asc' },
    }),
    prisma.habitEntry.findMany({
      where: { userId: user.id, createdAt: { gte: fourWeeksAgo } },
      select: { createdAt: true, habitId: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.task.count({
      where: { userId: user.id, status: { not: 'completed' }, dueDate: { lt: now } },
    }),
    prisma.task.groupBy({
      by: ['priority'],
      where: { userId: user.id, status: 'completed', completedAt: { gte: oneWeekAgo } },
      _count: true,
    }),
  ])

  // Compute day-of-week patterns for focus sessions
  const focusByDay: number[] = Array(7).fill(0)
  const tasksByDay: number[] = Array(7).fill(0)
  const focusByHour: number[] = Array(24).fill(0)

  for (const s of focusSessions28d) {
    focusByDay[s.createdAt.getDay()] += s.actualMins ?? 0
    focusByHour[s.createdAt.getHours()]++
  }
  for (const t of tasksCompleted28d) {
    if (t.completedAt) tasksByDay[t.completedAt.getDay()]++
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const bestFocusDay = dayNames[focusByDay.indexOf(Math.max(...focusByDay))]
  const bestTaskDay = dayNames[tasksByDay.indexOf(Math.max(...tasksByDay))]
  const bestHour = focusByHour.indexOf(Math.max(...focusByHour))
  const bestHourStr = bestHour >= 12 ? `${bestHour === 12 ? 12 : bestHour - 12}PM` : `${bestHour === 0 ? 12 : bestHour}AM`

  // Week-over-week trend
  const week1Tasks = tasksCompleted28d.filter(t => t.completedAt && t.completedAt >= twoWeeksAgo && t.completedAt < oneWeekAgo).length
  const week2Tasks = tasksCompleted28d.filter(t => t.completedAt && t.completedAt >= oneWeekAgo).length
  const taskTrend = week1Tasks > 0 ? Math.round(((week2Tasks - week1Tasks) / week1Tasks) * 100) : 0

  const week1Focus = focusSessions28d.filter(s => s.createdAt >= twoWeeksAgo && s.createdAt < oneWeekAgo).reduce((sum, s) => sum + (s.actualMins ?? 0), 0)
  const week2Focus = focusSessions28d.filter(s => s.createdAt >= oneWeekAgo).reduce((sum, s) => sum + (s.actualMins ?? 0), 0)
  const focusTrend = week1Focus > 0 ? Math.round(((week2Focus - week1Focus) / week1Focus) * 100) : 0

  // Habit consistency
  const habitDays = new Set(habitEntries28d.map(e => e.createdAt.toISOString().split('T')[0]))
  const habitConsistency = Math.round((habitDays.size / 28) * 100)

  const rawStats = {
    bestFocusDay,
    bestTaskDay,
    bestHour: bestHourStr,
    taskTrend,
    focusTrend,
    overdueTasks,
    habitConsistency,
    totalFocusMins28d: focusSessions28d.reduce((s, f) => s + (f.actualMins ?? 0), 0),
    totalTasksDone28d: tasksCompleted28d.length,
    priorityDistribution: Object.fromEntries(priorityDistribution.map(p => [p.priority, p._count])),
  }

  // Generate AI insights
  const contextStr = `User's 4-week productivity data:
- Best focus day: ${bestFocusDay}
- Best task completion day: ${bestTaskDay}
- Peak focus hour: ${bestHourStr}
- Task completion trend (week over week): ${taskTrend > 0 ? '+' : ''}${taskTrend}%
- Focus time trend (week over week): ${focusTrend > 0 ? '+' : ''}${focusTrend}%
- Habit consistency (last 28 days): ${habitConsistency}%
- Overdue tasks: ${overdueTasks}
- Total focus time (28 days): ${Math.round(rawStats.totalFocusMins28d / 60 * 10) / 10} hours
- Total tasks completed (28 days): ${rawStats.totalTasksDone28d}`

  const aiResponse = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system: 'You are NEXUS analyzing productivity patterns. Return a JSON object with exactly these keys: {"patterns": ["2-3 specific behavioral patterns you\'ve detected, referencing actual data"], "recommendations": ["2-3 specific, actionable recommendations based on the patterns"], "riskFlag": "one critical risk to flag or null if none", "momentum": "positive|neutral|negative"} — no other text.',
    messages: [{ role: 'user', content: contextStr }],
  })

  const raw = aiResponse.content.find(b => b.type === 'text')?.text ?? '{}'
  let aiInsights: { patterns: string[]; recommendations: string[]; riskFlag: string | null; momentum: string }
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    aiInsights = match ? JSON.parse(match[0]) : { patterns: [], recommendations: [], riskFlag: null, momentum: 'neutral' }
  } catch {
    aiInsights = { patterns: [], recommendations: [], riskFlag: null, momentum: 'neutral' }
  }

  const insights = { ...rawStats, ...aiInsights }
  const generatedAt = now.toISOString()

  cache.set(user.id, { insights, generatedAt, expiresAt: Date.now() + 4 * 60 * 60 * 1000 })

  return NextResponse.json({ insights, generatedAt, cached: false })
}
