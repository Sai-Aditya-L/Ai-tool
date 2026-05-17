import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { anthropic } from '@/lib/anthropic'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

type Action = 'summarize' | 'actions' | 'expand' | 'rewrite' | 'tags'

const PROMPTS: Record<Action, string> = {
  summarize: 'Summarize the following note in 2-4 concise sentences. Focus on the key points and insights. Return just the summary text, no labels.',
  actions: 'Extract all action items and todos from the following note. Return them as a numbered list with each item on its own line. If none found, say "No action items found." Return just the list.',
  expand: 'Expand the following note with additional context, details, and insights that would make it more useful. Keep the original structure and add to it. Return the expanded version.',
  rewrite: 'Rewrite the following note to be clearer, more organized, and more professional. Improve the structure and clarity while preserving all the original information. Return the rewritten version.',
  tags: 'Generate 3-7 relevant tags for the following note. Return JSON only: {"tags": ["tag1", "tag2", ...]}. Tags should be lowercase, single words or short phrases.',
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = await rateLimit(`notes-ai:${session.user.email}`, 20, 60000)
  if (!limited.allowed) return rateLimitResponse()

  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const note = await prisma.note.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true, title: true, content: true },
  })
  if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const action = (body.action ?? 'summarize') as Action
  if (!PROMPTS[action]) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  const noteText = `Title: ${note.title}\n\n${note.content}`
  const aiRes = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [
      { role: 'user', content: `${PROMPTS[action]}\n\n---\n${noteText}` },
    ],
  })

  const result = aiRes.content.find(b => b.type === 'text')?.text ?? ''

  if (action === 'tags') {
    try {
      const match = result.match(/\{[\s\S]*\}/)
      const parsed = match ? JSON.parse(match[0]) : { tags: [] }
      return NextResponse.json({ action, result: parsed.tags?.join(', ') ?? '', tags: parsed.tags ?? [] })
    } catch {
      return NextResponse.json({ action, result: '', tags: [] })
    }
  }

  return NextResponse.json({ action, result })
}
