import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { anthropic } from '@/lib/anthropic'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = await rateLimit(`smart-schedule:${session.user.email}`, 20, 60000)
  if (!limited.allowed) return rateLimitResponse()

  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { title, description } = body as { title?: string; description?: string }
  if (!title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })

  // Fetch today's calendar and existing reminders for context
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekEnd = new Date(todayStart.getTime() + 7 * 86400000)

  const [calendarEvents, pendingReminders, memories] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: { userId: user.id, startTime: { gte: now, lte: weekEnd } },
      select: { title: true, startTime: true, endTime: true },
      orderBy: { startTime: 'asc' },
      take: 10,
    }),
    prisma.reminder.findMany({
      where: { userId: user.id, status: 'pending', dueAt: { gte: now } },
      select: { title: true, dueAt: true },
      orderBy: { dueAt: 'asc' },
      take: 5,
    }),
    prisma.memory.findMany({
      where: { userId: user.id, category: { in: ['preference', 'routines', 'work'] } },
      select: { key: true, value: true },
      take: 5,
    }),
  ])

  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' })
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  const prompt = `You are a smart scheduling assistant. Suggest the BEST time to set a reminder, considering context.

Current time: ${dayOfWeek} ${timeStr} (ISO: ${now.toISOString()})
Reminder: "${title}"${description ? `\nDescription: "${description}"` : ''}

Upcoming calendar events (next 7 days):
${calendarEvents.length ? calendarEvents.map(e => `- ${e.title}: ${new Date(e.startTime).toLocaleString()}`).join('\n') : 'None'}

Existing pending reminders:
${pendingReminders.length ? pendingReminders.map(r => `- ${r.title}: ${new Date(r.dueAt).toLocaleString()}`).join('\n') : 'None'}

User context: ${memories.map(m => m.value).join('; ') || 'none'}

Rules:
- Avoid scheduling during existing calendar events
- For work tasks: suggest weekday business hours (9am-6pm)
- For health/exercise: suggest morning (7-9am) or evening (6-8pm)
- For end-of-day reviews: suggest 5-6pm
- For "tomorrow morning" intent: next day 9am
- For time-sensitive tasks: within 1-2 hours
- Never suggest a time in the past

Return JSON only: {"suggestedAt": "ISO8601 datetime", "reason": "brief explanation (1 sentence)", "confidence": "high|medium"}`

  const aiRes = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = aiRes.content.find(b => b.type === 'text')?.text ?? '{}'
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    const parsed = match ? JSON.parse(match[0]) : null
    if (!parsed?.suggestedAt) throw new Error('no date')
    // Validate the date is in the future
    const suggested = new Date(parsed.suggestedAt)
    if (isNaN(suggested.getTime()) || suggested <= now) throw new Error('invalid date')
    return NextResponse.json({ suggestedAt: parsed.suggestedAt, reason: parsed.reason ?? '', confidence: parsed.confidence ?? 'medium' })
  } catch {
    // Fallback: 1 hour from now
    const fallback = new Date(now.getTime() + 60 * 60 * 1000)
    return NextResponse.json({ suggestedAt: fallback.toISOString(), reason: 'Defaulting to 1 hour from now', confidence: 'low' })
  }
}
