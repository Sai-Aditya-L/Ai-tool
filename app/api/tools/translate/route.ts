import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { anthropic } from '@/lib/anthropic'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { text, targetLanguage } = await req.json()
  if (!text?.trim() || !targetLanguage) {
    return NextResponse.json({ error: 'text and targetLanguage are required' }, { status: 400 })
  }

  const resp = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `Translate the following text to ${targetLanguage}. Output ONLY the translation, no explanation or preamble:\n\n${text}`,
    }],
  })

  const translated = resp.content[0].type === 'text' ? resp.content[0].text.trim() : ''
  return NextResponse.json({ translated, targetLanguage })
}
