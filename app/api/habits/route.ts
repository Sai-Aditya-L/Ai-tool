import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

const habitSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  color: z.string().optional(),
  frequency: z.string().optional(),
})

function calcStreak(entries: { date: string; completed: boolean }[]) {
  const completed = entries.filter(e => e.completed).map(e => e.date).sort().reverse()
  let current = 0
  let longest = 0
  let streak = 0
  const today = new Date()
  for (let i = 0; i < 90; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    if (completed.includes(dateStr)) {
      streak++
      if (i === 0 || i === 1) current = streak // allow today or yesterday
    } else {
      if (i <= 1) current = streak
      longest = Math.max(longest, streak)
      streak = 0
    }
  }
  longest = Math.max(longest, streak, current)
  return { current, longest }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const habits = await prisma.habit.findMany({
    where: { userId: user.id, status: 'active' },
    include: {
      entries: {
        orderBy: { date: 'desc' },
        take: 90,
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  const today = new Date().toISOString().split('T')[0]
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

  const habitsWithStats = habits.map(habit => {
    const { current, longest } = calcStreak(habit.entries)
    const last30 = habit.entries.filter(e => e.date >= thirtyDaysAgoStr && e.completed)
    const completionRate = last30.length / 30
    const completedToday = habit.entries.length > 0 && habit.entries[0].date === today && habit.entries[0].completed

    return {
      id: habit.id,
      title: habit.title,
      description: habit.description,
      color: habit.color,
      frequency: habit.frequency,
      status: habit.status,
      createdAt: habit.createdAt,
      currentStreak: current,
      longestStreak: longest,
      completionRate,
      completedToday,
      entries: habit.entries,
    }
  })

  return NextResponse.json({ habits: habitsWithStats })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const rl = rateLimit(`habits:${user.id}`, 20, 60_000)
  if (!rl.success) return rateLimitResponse()

  try {
    const body = await req.json()
    const data = habitSchema.parse(body)

    const habit = await prisma.habit.create({
      data: {
        userId: user.id,
        title: data.title,
        description: data.description,
        color: data.color ?? '#00e5ff',
        frequency: data.frequency ?? 'daily',
      },
    })

    return NextResponse.json({ habit }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
