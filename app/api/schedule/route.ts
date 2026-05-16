import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { anthropic } from '@/lib/anthropic'

export const dynamic = 'force-dynamic'

// Smart scheduling: analyze calendar + task load and suggest optimal time slots
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { taskName, durationMinutes = 60, daysAhead = 5 } = body

  if (!taskName) return NextResponse.json({ error: 'taskName required' }, { status: 400 })

  const now = new Date()
  const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000)

  // Fetch upcoming calendar events
  const events = await prisma.calendarEvent.findMany({
    where: { userId: user.id, startTime: { gte: now, lte: futureDate } },
    orderBy: { startTime: 'asc' },
    select: { title: true, startTime: true, endTime: true, allDay: true },
    take: 30,
  })

  // Fetch focus session patterns (what times they tend to work)
  const recentFocusSessions = await prisma.focusSession.findMany({
    where: { userId: user.id, completed: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { createdAt: true, actualMins: true },
  })

  // Compute focus hour distribution
  const hourCounts: Record<number, number> = {}
  for (const s of recentFocusSessions) {
    const h = s.createdAt.getHours()
    hourCounts[h] = (hourCounts[h] || 0) + 1
  }
  const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0]

  const eventsStr = events.length > 0
    ? events.map(e => `"${e.title}" from ${new Date(e.startTime).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} to ${new Date(e.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`).join('\n')
    : 'No calendar events in the next ' + daysAhead + ' days'

  const context = `Task to schedule: "${taskName}" (${durationMinutes} minutes)
Current time: ${now.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
Scheduling window: Next ${daysAhead} days

Calendar events:
${eventsStr}

User's peak focus hour: ${peakHour ? `${parseInt(peakHour) >= 12 ? parseInt(peakHour) - 12 || 12 : parseInt(peakHour) || 12}${parseInt(peakHour) >= 12 ? 'PM' : 'AM'}` : 'Not determined'}`

  const aiResponse = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system: 'Return JSON only: {"slots": [{"day": "Tuesday, May 20", "time": "10:00 AM - 11:00 AM", "reason": "...", "score": 9}], "recommendation": "one sentence summary"}. Suggest 3 optimal time slots that avoid calendar conflicts and align with the user\'s focus patterns. Score 1-10 (10=best). Prefer morning slots during weekdays unless patterns suggest otherwise.',
    messages: [{ role: 'user', content: context }],
  })

  const raw = aiResponse.content.find(b => b.type === 'text')?.text ?? '{}'
  let result: { slots: Array<{ day: string; time: string; reason: string; score: number }>; recommendation: string }
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    result = match ? JSON.parse(match[0]) : { slots: [], recommendation: 'No slots found' }
  } catch {
    result = { slots: [], recommendation: 'Could not analyze schedule' }
  }

  return NextResponse.json({ taskName, durationMinutes, ...result })
}
