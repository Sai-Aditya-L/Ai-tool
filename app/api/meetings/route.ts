import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
    const { title, date, duration, attendees, notes, status } = body

    if (!title || !date) {
      return NextResponse.json({ error: 'title and date are required' }, { status: 400 })
    }

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
