import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createMeetingSchema = z.object({
  title: z.string().min(1).max(200),
  date: z.string().datetime().or(z.string().min(1)), // ISO date string
  duration: z.number().int().min(1).max(1440).optional(), // max 24 hours
  attendees: z.array(z.string().max(100)).max(100).optional(),
  notes: z.string().max(50000).optional(),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const search = searchParams.get('search')

  const meetings = await prisma.meeting.findMany({
    where: {
      userId: user.id,
      ...(status && { status }),
      ...(search && {
        OR: [
          { title: { contains: search } },
          { notes: { contains: search } },
        ],
      }),
    },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json({ meetings })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  try {
    const body = await req.json()
    const parseResult = createMeetingSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid request data', details: parseResult.error.flatten() }, { status: 400 })
    }
    const { title, date, duration, attendees, notes, status } = parseResult.data

    const meeting = await prisma.meeting.create({
      data: {
        userId: user.id,
        title,
        date: new Date(date),
        duration: duration ? Number(duration) : null,
        attendees: attendees ? JSON.stringify(attendees) : '[]',
        notes: notes || null,
        status: status || 'scheduled',
      },
    })

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'create_meeting',
        entityType: 'meeting',
        entityId: meeting.id,
        metadata: JSON.stringify({ title: meeting.title, date: meeting.date }),
      },
    })

    return NextResponse.json({ meeting }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
