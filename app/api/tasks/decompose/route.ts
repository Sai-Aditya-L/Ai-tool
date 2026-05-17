import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { anthropic } from '@/lib/anthropic'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = await rateLimit(`decompose:${session.user.email}`, 20, 60000)
  if (!limited.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => ({}))
  const { title, description, priority } = body

  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const prompt = `Break down this task into 3-6 concrete, actionable subtasks. Task: "${title}"${description ? `\nDetails: ${description}` : ''}${priority ? `\nPriority: ${priority}` : ''}

Return JSON only: {"subtasks": ["subtask 1", "subtask 2", ...]}
Each subtask should be specific and completable in 30-120 minutes. No numbering, just the action.`

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = response.content.find(b => b.type === 'text')?.text ?? '{}'
  let subtasks: string[] = []
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      subtasks = Array.isArray(parsed.subtasks) ? parsed.subtasks.filter((s: unknown) => typeof s === 'string').slice(0, 8) : []
    }
  } catch {}

  return NextResponse.json({ subtasks })
}
