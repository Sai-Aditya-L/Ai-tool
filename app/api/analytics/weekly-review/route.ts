import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { anthropic } from '@/lib/anthropic'

const cache = new Map<string, { review: string; stats: object; generatedAt: string; expiresAt: number }>()

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
  const weekStart = new Date(now)
  weekStart.setDate(weekStart.getDate() - 7)
  weekStart.setHours(0, 0, 0, 0)

  const [
    tasksCompleted,
    tasksCreated,
    focusSessions,
    focusTime,
    notesCreated,
    habitsLogged,
    achievementsEarned,
    goalsActive,
    goalsCompleted,
  ] = await Promise.all([
    prisma.task.count({ where: { userId: user.id, status: 'completed', completedAt: { gte: weekStart } } }),
    prisma.task.count({ where: { userId: user.id, createdAt: { gte: weekStart } } }),
    prisma.focusSession.count({ where: { userId: user.id, completed: true, createdAt: { gte: weekStart } } }),
    prisma.focusSession.aggregate({ where: { userId: user.id, completed: true, createdAt: { gte: weekStart } }, _sum: { actualMins: true } }),
    prisma.note.count({ where: { userId: user.id, createdAt: { gte: weekStart } } }),
    prisma.habitEntry.count({ where: { userId: user.id, createdAt: { gte: weekStart } } }),
    prisma.achievement.count({ where: { userId: user.id, earnedAt: { gte: weekStart } } }),
    prisma.goal.count({ where: { userId: user.id, status: 'active' } }),
    prisma.goal.count({ where: { userId: user.id, status: 'completed', updatedAt: { gte: weekStart } } }),
  ])

  const focusMinutes = focusTime._sum.actualMins ?? 0
  const stats = {
    tasksCompleted, tasksCreated, focusSessions,
    focusHours: Math.round(focusMinutes / 60 * 10) / 10,
    notesCreated, habitsLogged, achievementsEarned,
    goalsActive, goalsCompleted,
    completionRate: tasksCreated > 0 ? Math.round((tasksCompleted / tasksCreated) * 100) : 0,
  }

  const context = `Weekly stats (last 7 days):
- Tasks completed: ${tasksCompleted} (of ${tasksCreated} created, ${stats.completionRate}% completion rate)
- Focus sessions: ${focusSessions} sessions totaling ${stats.focusHours} hours
- Notes created: ${notesCreated}
- Habits logged: ${habitsLogged} times
- Achievements earned: ${achievementsEarned}
- Active goals: ${goalsActive} (${goalsCompleted} completed this week)`

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: `You are NEXUS, an advanced AI personal operating system. Generate a concise, insightful, and motivating weekly review. Be specific about the data. Write 3-4 sentences: one celebrating wins, one identifying a pattern or insight, one giving a focused recommendation for next week. Be direct and encouraging, not generic.`,
    messages: [{ role: 'user', content: context }],
  })

  const review = response.content.find(b => b.type === 'text')?.text ?? 'Great work this week. Keep building momentum.'
  const generatedAt = now.toISOString()

  cache.set(user.id, { review, stats, generatedAt, expiresAt: Date.now() + 6 * 60 * 60 * 1000 })

  return NextResponse.json({ review, stats, generatedAt, cached: false })
}
