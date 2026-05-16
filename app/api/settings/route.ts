import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  assistantName: z.string().min(1).max(100).optional(),
  aiModel: z.enum(['claude-sonnet-4-6', 'claude-opus-4-7', 'claude-haiku-4-5-20251001']).optional(),
  aiProvider: z.enum(['anthropic', 'openai']).optional(),
  openaiModel: z.enum(['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']).optional(),
  memoryEnabled: z.boolean().optional(),
  voiceEnabled: z.boolean().optional(),
  notificationsOn: z.boolean().optional(),
  timezone: z.string().max(100).optional(),
  language: z.string().max(10).optional(),
  theme: z.string().max(50).optional(),
  personalityMode: z.string().max(50).optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { preferences: true },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Create preferences if they don't exist yet
  let preferences = user.preferences
  if (!preferences) {
    preferences = await prisma.userPreferences.create({
      data: { userId: user.id, assistantName: 'NEXUS' },
    })
  }

  return NextResponse.json({
    name: user.name,
    email: user.email,
    preferences,
  })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { preferences: true },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  try {
    const body = await req.json()
    const data = patchSchema.parse(body)

    const { name, ...prefFields } = data

    // Update user name if provided
    if (name !== undefined) {
      await prisma.user.update({
        where: { id: user.id },
        data: { name },
      })
    }

    // Update or create preferences if any preference fields provided
    let preferences = user.preferences
    if (Object.keys(prefFields).length > 0) {
      if (preferences) {
        preferences = await prisma.userPreferences.update({
          where: { userId: user.id },
          data: prefFields,
        })
      } else {
        preferences = await prisma.userPreferences.create({
          data: { userId: user.id, assistantName: 'NEXUS', ...prefFields },
        })
      }
    }

    return NextResponse.json({
      name: name ?? user.name,
      email: user.email,
      preferences,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
