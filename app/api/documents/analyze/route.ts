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

  const rl = rateLimit(`doc-analyze:${user.id}`, 10, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const { text, filename, instruction } = await req.json()
  if (!text || typeof text !== 'string') return NextResponse.json({ error: 'Missing text' }, { status: 400 })

  const truncated = text.length > 50_000 ? text.slice(0, 50_000) + '\n\n[Document truncated at 50,000 characters]' : text

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: `You are NEXUS Document Intelligence. Analyze documents and provide structured, actionable insights. Format your response with clear sections using markdown headers.`,
    messages: [{
      role: 'user',
      content: `Document: **${filename || 'Untitled'}**\n\n${truncated}\n\n---\n\n${instruction || 'Analyze this document. Provide:\n1. **Summary** (2-3 sentences)\n2. **Key Points** (bullet list)\n3. **Action Items** (if any are implied or explicit)\n4. **Important Data** (key numbers, dates, names mentioned)'}`,
    }],
  })

  const analysis = response.content.find(b => b.type === 'text')?.text ?? 'Analysis unavailable.'

  return NextResponse.json({ analysis, filename, model: 'claude-sonnet-4-6' })
}
