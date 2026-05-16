import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { anthropic } from '@/lib/anthropic'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

const SYSTEM_PROMPTS: Record<string, string> = {
  explain:
    'You are NEXUS Visual Intelligence. Describe this image in detail. Explain what you see, identify key elements, and provide useful context.',
  ocr:
    'You are NEXUS Visual Intelligence with OCR capability. Extract ALL text from this image exactly as it appears. Preserve formatting, line breaks, and structure.',
  security:
    'You are Sentinel, a security analyst. Analyze this architecture diagram or screenshot for security vulnerabilities, misconfigurations, exposed credentials, insecure patterns, and risks. Structure: ## Critical Risks, ## Security Issues, ## Recommendations',
  debug:
    'You are Forge, a debugging expert. Analyze this error screenshot or UI screenshot. Identify: ## What\'s Wrong, ## Root Cause, ## How to Fix, ## Prevention',
  extract_tasks:
    'You are NEXUS. Extract all action items, tasks, and to-dos visible in this image. Format as a numbered list. For each task include: description, priority (if determinable), and any deadline mentioned.',
  diagram:
    'You are NEXUS Architecture Analyst. Analyze this technical diagram. Explain: ## Purpose, ## Components, ## Data Flow, ## Strengths, ## Potential Issues',
  summarize:
    'You are NEXUS Visual Intelligence. Provide a concise, intelligent summary of this image. Focus on the key information and what it means for the user.',
}

const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const rl = rateLimit(`visual:${user.id}`, 10, 60_000) // 10 per minute
  if (!rl.allowed) return rateLimitResponse()

  try {
    const formData = await req.formData()
    const image = formData.get('image') as File | null
    const type = (formData.get('type') as string) || 'explain'
    const context = (formData.get('context') as string) || ''

    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    if (!ALLOWED_MEDIA_TYPES.includes(image.type)) {
      return NextResponse.json(
        { error: 'Unsupported image type. Use JPEG, PNG, GIF, or WEBP.' },
        { status: 400 }
      )
    }

    if (image.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image too large (max 5MB)' }, { status: 400 })
    }

    const systemPrompt = SYSTEM_PROMPTS[type] || SYSTEM_PROMPTS.explain

    const bytes = await image.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: image.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: base64,
              },
            },
            {
              type: 'text',
              text: context || 'Analyze this image.',
            },
          ],
        },
      ],
    })

    const resultText =
      response.content.find((b) => b.type === 'text')?.text ?? 'No result returned.'

    // Log to ActivityLog
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'VISUAL_ANALYSIS',
        details: `type: ${type}`,
      },
    })

    return NextResponse.json({
      result: resultText,
      type,
      imageSize: image.size,
    })
  } catch (error) {
    console.error('Visual analysis error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
