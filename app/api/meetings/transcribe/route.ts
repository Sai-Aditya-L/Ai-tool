import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { anthropic } from '@/lib/anthropic'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit(`meeting-transcribe:${user.id}`, 10, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const { transcript, title, duration } = await req.json()
  if (!transcript || typeof transcript !== 'string') {
    return NextResponse.json({ error: 'Missing transcript' }, { status: 400 })
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: `You are NEXUS Meeting Intelligence. Analyze meeting transcripts and extract structured information. Be concise and actionable.`,
    messages: [{
      role: 'user',
      content: `Meeting transcript${title ? ` — "${title}"` : ''}${duration ? ` (${duration} min)` : ''}:\n\n${transcript}\n\nProvide a structured analysis with these exact sections:\n\n## Summary\n2-3 sentence overview of what was discussed.\n\n## Key Decisions\nBulleted list of decisions made.\n\n## Action Items\nBulleted list with format: - [Person/Owner] Task description\n\n## Follow-ups\nItems that need follow-up or were left unresolved.\n\n## Key Topics\nComma-separated list of main topics discussed.`,
    }],
  })

  const notes = response.content.find(b => b.type === 'text')?.text ?? ''

  // Save as a meeting record
  let meetingId: string | null = null
  try {
    const meeting = await prisma.meeting.create({
      data: {
        userId: user.id,
        title: title || `Meeting — ${new Date().toLocaleDateString()}`,
        date: new Date(),
        duration: duration || null,
        notes,
        status: 'completed',
      },
    })
    meetingId = meeting.id
  } catch {}

  return NextResponse.json({ notes, meetingId })
}
