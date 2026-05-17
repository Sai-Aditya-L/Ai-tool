import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { startTime, endTime, excludeId } = body

  if (!startTime || !endTime) {
    return NextResponse.json({ error: 'startTime and endTime required' }, { status: 400 })
  }

  const start = new Date(startTime)
  const end = new Date(endTime)
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    return NextResponse.json({ error: 'Invalid time range' }, { status: 400 })
  }

  const conflicts = await prisma.calendarEvent.findMany({
    where: {
      userId: user.id,
      allDay: false,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      AND: [
        { startTime: { lt: end } },
        { endTime: { gt: start } },
      ],
    },
    select: { id: true, title: true, startTime: true, endTime: true, location: true },
    take: 10,
  })

  const bufferConflicts = await prisma.calendarEvent.findMany({
    where: {
      userId: user.id,
      allDay: false,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      AND: [
        { startTime: { lt: new Date(end.getTime() + 15 * 60 * 1000) } },
        { endTime: { gt: new Date(start.getTime() - 15 * 60 * 1000) } },
        { id: { notIn: conflicts.map(c => c.id) } },
      ],
    },
    select: { id: true, title: true, startTime: true, endTime: true },
    take: 5,
  })

  return NextResponse.json({
    hasConflict: conflicts.length > 0,
    conflicts: conflicts.map(c => ({
      ...c,
      startTime: c.startTime.toISOString(),
      endTime: c.endTime.toISOString(),
    })),
    bufferWarnings: bufferConflicts.map(c => ({
      ...c,
      startTime: c.startTime.toISOString(),
      endTime: c.endTime.toISOString(),
    })),
  })
}
