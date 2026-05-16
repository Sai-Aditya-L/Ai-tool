import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { listCalendarEvents, createCalendarEvent, isGoogleConnected } from '@/lib/google'
import { z } from 'zod'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

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
  const refresh = searchParams.get('refresh') === 'true'

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

  // --- Cache-first path ---
  if (!refresh) {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const cached = await prisma.calendarEvent.findMany({
      where: {
        userId: user.id,
        startTime: { gte: startOfToday },
      },
      orderBy: { startTime: 'asc' },
      take: 100,
    })

    if (cached.length > 0) {
      const events = cached.map(e => ({
        id: e.googleEventId || e.id,
        title: e.title,
        description: e.description || '',
        location: e.location || '',
        startTime: e.startTime.toISOString(),
        endTime: e.endTime.toISOString(),
        allDay: e.allDay,
        attendees: e.attendees || '',
        meetLink: e.meetLink || '',
        status: e.status,
        source: e.source,
      }))

      return NextResponse.json({ connected: true, events, source: 'google', cacheHit: true })
    }
  }

  // --- Live fetch path ---
  try {
    const timeMin = new Date()
    const timeMax = new Date(timeMin.getTime() + days * 24 * 60 * 60 * 1000)
    const events = await listCalendarEvents(user.id, { maxResults, timeMin, timeMax })

    // Upsert fetched events into cache
    if (events && events.length > 0) {
      await Promise.allSettled(
        events.map(e =>
          e.id
            ? prisma.calendarEvent.upsert({
                where: { userId_googleEventId: { userId: user.id, googleEventId: e.id } },
                update: {
                  title: e.title,
                  description: e.description || null,
                  location: e.location || null,
                  startTime: new Date(e.startTime),
                  endTime: new Date(e.endTime),
                  allDay: e.allDay,
                  attendees: e.attendees || null,
                  meetLink: e.meetLink || null,
                  status: e.status || 'confirmed',
                  source: 'google',
                },
                create: {
                  userId: user.id,
                  googleEventId: e.id,
                  title: e.title,
                  description: e.description || null,
                  location: e.location || null,
                  startTime: new Date(e.startTime),
                  endTime: new Date(e.endTime),
                  allDay: e.allDay,
                  attendees: e.attendees || null,
                  meetLink: e.meetLink || null,
                  status: e.status || 'confirmed',
                  source: 'google',
                },
              })
            : Promise.resolve()
        )
      )
    }

    return NextResponse.json({ connected: true, events, source: 'google', cacheHit: false })
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

  const rl = rateLimit(`calendar-events:${user.id}`, 20, 60_000)
  if (!rl.allowed) return rateLimitResponse()

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
