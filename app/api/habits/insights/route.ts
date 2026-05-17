import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { anthropic } from '@/lib/anthropic'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const cache = new Map<string, { data: unknown; ts: number }>()
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = await rateLimit(`habit-insights:${session.user.email}`, 10, 60000)
  if (!limited.allowed) return rateLimitResponse()

  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cached = cache.get(user.id)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data)
  }

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const habits = await prisma.habit.findMany({
    where: { userId: user.id, status: 'active' },
    include: {
      entries: {
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { date: true, completed: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      },
    },
    take: 15,
  })

  if (habits.length === 0) {
    return NextResponse.json({ insights: [], summary: 'No active habits to analyze.' })
  }

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const habitStats = habits.map(h => {
    const completed = h.entries.filter(e => e.completed)
    const byDay: Record<string, number> = {}
    completed.forEach(e => {
      const d = DAYS[new Date(e.createdAt).getDay()]
      byDay[d] = (byDay[d] || 0) + 1
    })
    const bestDay = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A'
    const streak = computeStreak(completed.map(e => e.date))
    const consistency = Math.round((completed.length / 30) * 100)
    return { title: h.title, consistency, streak, bestDay, frequency: h.frequency, completedCount: completed.length }
  })

  const context = habitStats.map(h =>
    `"${h.title}" (${h.frequency}): ${h.consistency}% consistency, ${h.completedCount}/30 days, ${h.streak}-day streak, best day: ${h.bestDay}`
  ).join('\n')

  const aiRes = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    system: 'Analyze these habit tracking stats and return JSON only: {"summary":"2 sentence overview","insights":[{"habit":"...","pattern":"specific pattern observed","tip":"actionable improvement tip","streak":number,"consistency":number}],"topHabit":"best performing habit title","atRisk":"most at-risk habit title or null"}',
    messages: [{ role: 'user', content: `Habit data (last 30 days):\n${context}` }],
  })

  const raw = aiRes.content.find(b => b.type === 'text')?.text ?? '{}'
  let result: unknown
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    result = match ? JSON.parse(match[0]) : { insights: [], summary: '' }
  } catch {
    result = { insights: [], summary: 'Could not analyze habits.' }
  }

  cache.set(user.id, { data: result, ts: Date.now() })
  return NextResponse.json(result)
}

function computeStreak(dates: string[]): number {
  if (!dates.length) return 0
  const sorted = Array.from(new Set(dates)).sort().reverse()
  let streak = 0
  let prev = new Date().toISOString().split('T')[0]
  for (const d of sorted) {
    const diff = Math.round((new Date(prev).getTime() - new Date(d).getTime()) / 86400000)
    if (diff <= 1) { streak++; prev = d }
    else break
  }
  return streak
}
