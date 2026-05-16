import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - 6)

  const [
    tasksCompletedToday,
    tasksCreatedTotal,
    focusSessionsToday,
    totalFocusMinutesToday,
    habits,
    habitEntriesToday,
    notesToday,
    tasksCompletedWeek,
    focusSessionsWeek,
    streakData,
  ] = await Promise.all([
    prisma.task.count({ where: { userId: user.id, status: 'completed', completedAt: { gte: todayStart } } }),
    prisma.task.count({ where: { userId: user.id, status: { not: 'cancelled' } } }),
    prisma.focusSession.count({ where: { userId: user.id, completed: true, createdAt: { gte: todayStart } } }),
    prisma.focusSession.aggregate({ where: { userId: user.id, completed: true, createdAt: { gte: todayStart } }, _sum: { actualMins: true } }),
    prisma.habit.findMany({ where: { userId: user.id, status: 'active' } }),
    prisma.habitEntry.count({ where: { userId: user.id, createdAt: { gte: todayStart } } }),
    prisma.note.count({ where: { userId: user.id, createdAt: { gte: todayStart } } }),
    prisma.task.count({ where: { userId: user.id, status: 'completed', completedAt: { gte: weekStart } } }),
    prisma.focusSession.count({ where: { userId: user.id, completed: true, createdAt: { gte: weekStart } } }),
    prisma.focusSession.findMany({
      where: { userId: user.id, completed: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { createdAt: true },
    }),
  ])

  const habitScore = habits.length > 0 ? Math.round((habitEntriesToday / habits.length) * 25) : 0
  const taskScore = Math.min(40, tasksCompletedToday * 10)
  const focusScore = Math.min(25, focusSessionsToday * 8)
  const noteScore = Math.min(10, notesToday * 3)
  const score = Math.min(100, taskScore + focusScore + habitScore + noteScore)

  // Calculate streak (consecutive days with focus sessions)
  let streak = 0
  const seenDays = new Set<string>()
  for (const s of streakData) {
    seenDays.add(s.createdAt.toISOString().split('T')[0])
  }
  const checkDate = new Date(todayStart)
  while (seenDays.has(checkDate.toISOString().split('T')[0])) {
    streak++
    checkDate.setDate(checkDate.getDate() - 1)
  }

  // Daily scores for the last 7 days
  const dailyScores = []
  for (let i = 6; i >= 0; i--) {
    const day = new Date(todayStart)
    day.setDate(day.getDate() - i)
    const nextDay = new Date(day)
    nextDay.setDate(nextDay.getDate() + 1)
    const [tc, fs] = await Promise.all([
      prisma.task.count({ where: { userId: user.id, status: 'completed', completedAt: { gte: day, lt: nextDay } } }),
      prisma.focusSession.count({ where: { userId: user.id, completed: true, createdAt: { gte: day, lt: nextDay } } }),
    ])
    dailyScores.push({
      date: day.toISOString().split('T')[0],
      label: day.toLocaleDateString('en-US', { weekday: 'short' }),
      tasks: tc,
      focus: fs,
      score: Math.min(100, tc * 10 + fs * 8),
    })
  }

  return NextResponse.json({
    score,
    breakdown: { tasks: taskScore, focus: focusScore, habits: habitScore, notes: noteScore },
    today: {
      tasksCompleted: tasksCompletedToday,
      focusSessions: focusSessionsToday,
      focusMinutes: totalFocusMinutesToday._sum.actualMins ?? 0,
      habitsCompleted: habitEntriesToday,
      habitsTotal: habits.length,
      notes: notesToday,
    },
    week: { tasksCompleted: tasksCompletedWeek, focusSessions: focusSessionsWeek },
    streak,
    dailyScores,
  })
}
