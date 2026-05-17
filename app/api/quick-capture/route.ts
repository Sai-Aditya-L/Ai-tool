import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { anthropic } from '@/lib/anthropic'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// Parse natural language into a structured item and save it
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = await rateLimit(`quick-capture:${session.user.email}`, 30, 60000)
  if (!limited.allowed) return rateLimitResponse()

  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { text } = body
  if (!text?.trim()) return NextResponse.json({ error: 'text required' }, { status: 400 })

  const now = new Date()

  const aiRes = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: `Today is ${now.toISOString()}. Parse the user's natural language input and return JSON only:
{"type":"task"|"reminder"|"note"|"memory","title":"...","content":"...","priority":"urgent"|"high"|"medium"|"low","dueAt":"ISO8601 or null","tags":"comma,separated or null"}
- type=task: for to-do items, things to do
- type=reminder: for time-sensitive items with due dates
- type=note: for information to save, ideas, observations
- type=memory: for personal facts, preferences, context about the user
- If the user mentions a time/date, compute absolute ISO8601 datetime
- title should be concise (< 80 chars)
- Only JSON in response`,
    messages: [{ role: 'user', content: text }],
  })

  const raw = aiRes.content.find(b => b.type === 'text')?.text ?? '{}'
  let parsed: {
    type: 'task' | 'reminder' | 'note' | 'memory'
    title: string
    content?: string
    priority?: string
    dueAt?: string | null
    tags?: string | null
  }

  try {
    const match = raw.match(/\{[\s\S]*\}/)
    parsed = match ? JSON.parse(match[0]) : { type: 'note', title: text }
  } catch {
    parsed = { type: 'note', title: text }
  }

  const { type, title, content, priority, dueAt, tags } = parsed
  if (!title) return NextResponse.json({ error: 'Could not parse input' }, { status: 400 })

  try {
    if (type === 'task') {
      const task = await prisma.task.create({
        data: {
          userId: user.id,
          title: title.slice(0, 255),
          description: content || undefined,
          priority: ['urgent', 'high', 'medium', 'low'].includes(priority ?? '') ? (priority as string) : 'medium',
          status: 'pending',
          dueDate: dueAt ? new Date(dueAt) : undefined,
          tags: tags || undefined,
        },
      })
      return NextResponse.json({ type: 'task', item: task, message: `Task created: "${title}"` })
    }

    if (type === 'reminder') {
      const reminder = await prisma.reminder.create({
        data: {
          userId: user.id,
          title: title.slice(0, 255),
          description: content || undefined,
          dueAt: dueAt ? new Date(dueAt) : new Date(Date.now() + 3600000),
          priority: ['urgent', 'high', 'medium', 'low'].includes(priority ?? '') ? (priority as string) : 'medium',
        },
      })
      return NextResponse.json({ type: 'reminder', item: reminder, message: `Reminder set: "${title}"` })
    }

    if (type === 'memory') {
      const memoryKey = title.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 64) + '_' + Date.now()
      const memory = await prisma.memory.create({
        data: {
          userId: user.id,
          category: 'user_fact',
          key: memoryKey,
          value: content ? `${title}: ${content}` : title,
          source: 'quick_capture',
        },
      })
      return NextResponse.json({ type: 'memory', item: memory, message: `Saved to memory: "${title}"` })
    }

    // Default: note
    const note = await prisma.note.create({
      data: {
        userId: user.id,
        title: title.slice(0, 255),
        content: content || title,
        tags: tags || undefined,
      },
    })
    return NextResponse.json({ type: 'note', item: note, message: `Note saved: "${title}"` })
  } catch {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}
