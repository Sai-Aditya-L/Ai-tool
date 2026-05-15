import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deleteCalendarEvent, getCalendarClient } from '@/lib/google'

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  try {
    await deleteCalendarEvent(user.id, params.id)
    await prisma.activityLog.create({
      data: { userId: user.id, action: 'CALENDAR_EVENT_DELETED', details: `Deleted calendar event` },
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const calendar = await getCalendarClient(user.id)
  if (!calendar) return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 400 })

  const body = await req.json()
  try {
    const event = await calendar.events.patch({
      calendarId: 'primary',
      eventId: params.id,
      requestBody: {
        summary: body.title,
        description: body.description,
        location: body.location,
        ...(body.startTime && { start: { dateTime: body.startTime, timeZone: 'UTC' } }),
        ...(body.endTime && { end: { dateTime: body.endTime, timeZone: 'UTC' } }),
      },
    })
    return NextResponse.json({ event: event.data })
  } catch {
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 })
  }
}
