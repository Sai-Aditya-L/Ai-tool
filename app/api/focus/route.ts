import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function getAuthUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null
  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  return user
}

async function maybeAwardAchievement(
  userId: string,
  type: string,
  name: string,
  desc: string,
  icon: string
) {
  await prisma.achievement.upsert({
    where: { userId_type: { userId, type } },
    create: { userId, type, name, desc, icon },
    update: {},
  })
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const stats = searchParams.get('stats')

  if (stats === '1') {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const [todaySessionsRaw, allCompleted] = await Promise.all([
      prisma.focusSession.findMany({
        where: { userId: user.id, createdAt: { gte: today, lt: tomorrow } },
      }),
      prisma.focusSession.findMany({
        where: { userId: user.id, completed: true },
        orderBy: { completedAt: 'desc' },
      }),
    ])

    const todaySessions = todaySessionsRaw.length
    const completedToday = todaySessionsRaw.filter((s) => s.completed).length
    const totalMinutes = todaySessionsRaw.reduce((sum, s) => sum + (s.actualMins ?? 0), 0)

    // Current streak: consecutive days with at least 1 completed session
    let currentStreak = 0
    if (allCompleted.length > 0) {
      const daySet = new Set<string>()
      for (const s of allCompleted) {
        if (s.completedAt) {
          const d = new Date(s.completedAt)
          daySet.add(d.toISOString().slice(0, 10))
        }
      }
      const checkDay = new Date()
      checkDay.setHours(0, 0, 0, 0)
      while (true) {
        const key = checkDay.toISOString().slice(0, 10)
        if (daySet.has(key)) {
          currentStreak++
          checkDay.setDate(checkDay.getDate() - 1)
        } else {
          break
        }
      }
    }

    // Weekly data: last 7 days count of completed sessions per day
    const weeklyData: number[] = []
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date()
      dayStart.setHours(0, 0, 0, 0)
      dayStart.setDate(dayStart.getDate() - i)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)
      const count = await prisma.focusSession.count({
        where: {
          userId: user.id,
          completed: true,
          completedAt: { gte: dayStart, lt: dayEnd },
        },
      })
      weeklyData.push(count)
    }

    return NextResponse.json({ todaySessions, totalMinutes, completedToday, currentStreak, weeklyData })
  }

  // Default: last 20 focus sessions
  const sessions = await prisma.focusSession.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return NextResponse.json({ sessions })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { taskId, taskTitle, type = 'pomodoro', plannedMins = 25 } = body

  const session = await prisma.focusSession.create({
    data: {
      userId: user.id,
      taskId: taskId || null,
      taskTitle: taskTitle || null,
      type,
      plannedMins: Number(plannedMins),
    },
  })

  return NextResponse.json({ session }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, completed, actualMins, notes } = body

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const existing = await prisma.focusSession.findFirst({ where: { id, userId: user.id } })
  if (!existing) return NextResponse.json({ error: 'Focus session not found' }, { status: 404 })

  const session = await prisma.focusSession.update({
    where: { id },
    data: {
      ...(completed !== undefined && { completed: Boolean(completed) }),
      ...(actualMins !== undefined && { actualMins: Number(actualMins) }),
      ...(notes !== undefined && { notes }),
      ...(completed === true && { completedAt: new Date() }),
    },
  })

  // Check achievements on completion
  if (completed) {
    const totalCompleted = await prisma.focusSession.count({
      where: { userId: user.id, completed: true },
    })

    if (totalCompleted >= 1) {
      await maybeAwardAchievement(user.id, 'first_focus', 'First Focus', 'Completed your first focus session', '🎯')
    }
    if (totalCompleted >= 10) {
      await maybeAwardAchievement(user.id, 'focus_10', 'Deep Thinker', '10 focus sessions completed', '🧠')
    }
    if (totalCompleted >= 50) {
      await maybeAwardAchievement(user.id, 'focus_50', 'Flow Master', '50 focus sessions completed', '⚡')
    }
  }

  return NextResponse.json({ session })
}
