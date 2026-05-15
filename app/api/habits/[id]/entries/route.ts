import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const habit = await prisma.habit.findFirst({ where: { id: params.id, userId: user.id } })
  if (!habit) return NextResponse.json({ error: 'Habit not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const days = parseInt(searchParams.get('days') || '30')
  const clampedDays = Math.min(Math.max(days, 1), 365)

  // Build the full date range
  const dates: string[] = []
  const today = new Date()
  for (let i = 0; i < clampedDays; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    dates.push(d.toISOString().split('T')[0])
  }

  const startDate = dates[dates.length - 1]

  const dbEntries = await prisma.habitEntry.findMany({
    where: {
      habitId: params.id,
      userId: user.id,
      date: { gte: startDate },
    },
    select: { date: true, completed: true },
  })

  const entryMap = new Map(dbEntries.map(e => [e.date, e.completed]))

  // Return array of { date, completed } for each of the last N days (oldest first)
  const entries = dates
    .reverse()
    .map(date => ({
      date,
      completed: entryMap.get(date) ?? false,
    }))

  return NextResponse.json({ entries })
}
