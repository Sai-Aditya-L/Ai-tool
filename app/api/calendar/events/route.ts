import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { listCalendarEvents, createCalendarEvent, isGoogleConnected } from '@/lib/google'
import { z } from 'zod'

const createEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  location: z.string().optional(),
  startTime: z.string(),
  endTime: z.string(),
  attendees: z.array(z.string()).optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const connected = await isGoogleConnected(user.id)

  const { searchParams } = new URL(req.url)
  const days = parseInt(searchParams.get('days') || '30')
  const maxResults = parseInt(searchParams.get('maxResults') || '20')

  if (!connected) {
    // Return NEXUS reminders as calendar items when Google not connected
    const reminders = await prisma.reminder.findMany({
      where: {
        userId: user.id,
        status: 'pending',
        dueAt: { gte: new Date() },
      },
      orderBy: { dueAt: 'asc' },
      take: maxResults,
    })

    const events = reminders.map(r => ({
      id: r.id,
      title: r.title,
      description: r.description || '',
      startTime: r.dueAt.toISOString(),
      endTime: new Date(r.dueAt.getTime() + 30 * 60 * 1000).toISOString(),
      allDay: false,
      source: 'nexus',
      type: 'reminder',
    }))

    return NextResponse.json({ connected: false, events, source: 'nexus' })
  }

  try {
    const timeMin = new Date()
    const timeMax = new Date(timeMin.getTime() + days * 24 * 60 * 60 * 1000)
    const events = await listCalendarEvents(user.id, { maxResults, timeMin, timeMax })
    return NextResponse.json({ connected: true, events, source: 'google' })
  } catch (error: any) {
    if (error.message?.includes('invalid_grant')) {
      return NextResponse.json({ error: 'Google token expired. Please reconnect.', reconnect: true }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to fetch calendar events' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const connected = await isGoogleConnected(user.id)

  try {
    const body = await req.json()
    const data = createEventSchema.parse(body)

    if (!connected) {
      // Fall back to creating a reminder when Google Calendar not connected
      const reminder = await prisma.reminder.create({
        data: {
          userId: user.id,
          title: data.title,
          description: data.description,
          dueAt: new Date(data.startTime),
          priority: 'medium',
        },
      })
      return NextResponse.json({ event: { id: reminder.id, ...data }, source: 'nexus', message: 'Saved as NEXUS reminder (Google Calendar not connected)' }, { status: 201 })
    }

    const event = await createCalendarEvent(user.id, {
      ...data,
      attendees: data.attendees || [],
    })

    await prisma.activityLog.create({
      data: { userId: user.id, action: 'CALENDAR_EVENT_CREATED', details: `Created event: ${data.title}` },
    })

    return NextResponse.json({ event, source: 'google' }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
  }
}
