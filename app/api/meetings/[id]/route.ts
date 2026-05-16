import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { anthropic } from '@/lib/anthropic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const meeting = await prisma.meeting.findFirst({
    where: { id: params.id, userId: user.id },
  })

  if (!meeting) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })

  return NextResponse.json({ meeting })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const meeting = await prisma.meeting.findFirst({ where: { id: params.id, userId: user.id } })
  if (!meeting) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })

  try {
    const body = await req.json()
    const { title, date, duration, attendees, notes, status, transcript } = body

    const updated = await prisma.meeting.update({
      where: { id: params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(date !== undefined && { date: new Date(date) }),
        ...(duration !== undefined && { duration: duration ? Number(duration) : null }),
        ...(attendees !== undefined && { attendees: JSON.stringify(attendees) }),
        ...(notes !== undefined && { notes }),
        ...(status !== undefined && { status }),
        ...(transcript !== undefined && { transcript }),
      },
    })

    return NextResponse.json({ meeting: updated })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const meeting = await prisma.meeting.findFirst({ where: { id: params.id, userId: user.id } })
  if (!meeting) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })

  await prisma.meeting.delete({ where: { id: params.id } })

  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: 'delete_meeting',
      entityType: 'meeting',
      entityId: params.id,
      metadata: JSON.stringify({ title: meeting.title }),
    },
  })

  return NextResponse.json({ success: true })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const meeting = await prisma.meeting.findFirst({ where: { id: params.id, userId: user.id } })
  if (!meeting) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  if (action === 'extract') {
    try {
      const content = [
        meeting.title ? `Meeting: ${meeting.title}` : '',
        meeting.notes ? `Notes:\n${meeting.notes}` : '',
        meeting.transcript ? `Transcript:\n${meeting.transcript}` : '',
      ]
        .filter(Boolean)
        .join('\n\n')

      if (!content.trim()) {
        return NextResponse.json({ error: 'No notes or transcript to extract from' }, { status: 400 })
      }

      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `Extract action items and generate a concise summary from the following meeting content.
Return your response as JSON with two fields:
- "summary": a 2-4 sentence summary of what was discussed and decided
- "actionItems": an array of strings, each being a specific action item

Meeting content:
${content}

Respond with only valid JSON, no markdown.`,
          },
        ],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      let parsed: { summary: string; actionItems: string[] }

      try {
        parsed = JSON.parse(text)
      } catch {
        // Try to extract JSON from the response
        const match = text.match(/\{[\s\S]*\}/)
        if (match) {
          parsed = JSON.parse(match[0])
        } else {
          return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
        }
      }

      const updated = await prisma.meeting.update({
        where: { id: params.id },
        data: {
          summary: parsed.summary || '',
          actionItems: JSON.stringify(parsed.actionItems || []),
        },
      })

      return NextResponse.json({ meeting: updated })
    } catch {
      return NextResponse.json({ error: 'Failed to extract insights' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
