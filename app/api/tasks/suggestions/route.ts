import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { anthropic } from '@/lib/anthropic'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const cache = new Map<string, { data: unknown; ts: number }>()
const CACHE_TTL = 20 * 60 * 1000

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = await rateLimit(`task-suggestions:${session.user.email}`, 10, 60000)
  if (!limited.allowed) return rateLimitResponse()

  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cached = cache.get(user.id)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data)
  }

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(todayStart.getTime() + 86400000)
  const weekAgo = new Date(now.getTime() - 7 * 86400000)

  const [pendingTasks, goals, habits, recentCompleted, todayEvents, memories] = await Promise.all([
    prisma.task.findMany({
      where: { userId: user.id, status: { in: ['pending', 'in_progress'] } },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      select: { title: true, priority: true, dueDate: true, tags: true },
      take: 20,
    }),
    prisma.goal.findMany({
      where: { userId: user.id, status: 'active' },
      select: { title: true, category: true, progress: true, targetDate: true },
      take: 5,
    }),
    prisma.habit.findMany({
      where: { userId: user.id, status: 'active' },
      select: { title: true, frequency: true },
      take: 8,
    }),
    prisma.task.findMany({
      where: { userId: user.id, status: 'completed', completedAt: { gte: weekAgo } },
      select: { title: true, completedAt: true },
      take: 10,
    }),
    prisma.calendarEvent.findMany({
      where: { userId: user.id, startTime: { gte: todayStart, lte: todayEnd } },
      select: { title: true, startTime: true },
      take: 5,
    }),
    prisma.memory.findMany({
      where: { userId: user.id, category: { in: ['preference', 'work', 'personal'] } },
      select: { key: true, value: true },
      take: 10,
    }),
  ])

  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' })
  const hour = now.getHours()
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'

  const context = `Today is ${dayOfWeek}, ${timeOfDay}. Suggest 3-5 tasks the user should focus on today.

Pending tasks (${pendingTasks.length}):
${pendingTasks.slice(0, 10).map(t => `- "${t.title}" [${t.priority}]${t.dueDate ? ` due ${new Date(t.dueDate).toLocaleDateString()}` : ''}`).join('\n')}

Active goals: ${goals.map(g => `${g.title} (${g.progress}%)`).join(', ') || 'none'}
Daily habits: ${habits.map(h => h.title).join(', ') || 'none'}
Today's meetings: ${todayEvents.map(e => e.title).join(', ') || 'none'}
Completed recently: ${recentCompleted.length} tasks this week
User context: ${memories.slice(0, 5).map(m => m.value).join('; ') || 'none'}

Return JSON only: {"suggestions": [{"title": "specific task title", "reason": "why now", "priority": "urgent|high|medium", "category": "task|habit|goal"}]}`

  const aiRes = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    messages: [{ role: 'user', content: context }],
  })

  const raw = aiRes.content.find(b => b.type === 'text')?.text ?? '{}'
  let result: { suggestions: Array<{ title: string; reason: string; priority: string; category: string }> }
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    result = match ? JSON.parse(match[0]) : { suggestions: [] }
  } catch {
    result = { suggestions: [] }
  }

  cache.set(user.id, { data: result, ts: Date.now() })
  return NextResponse.json(result)
}
