import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const onboardingSchema = z.object({
  preferredName: z.string().min(1).max(100),
  workRole: z.string().max(200).optional(),
  timezone: z.string().max(100).default('UTC'),
  currentMode: z.string().max(50).default('personal'),
  notificationsOn: z.boolean().default(true),
  voiceEnabled: z.boolean().default(true),
  memoryEnabled: z.boolean().default(true),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  try {
    const body = await req.json()
    const data = onboardingSchema.parse(body)

    // Upsert user preferences
    await prisma.userPreferences.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        preferredName: data.preferredName,
        workRole: data.workRole,
        timezone: data.timezone,
        currentMode: data.currentMode,
        notificationsOn: data.notificationsOn,
        voiceEnabled: data.voiceEnabled,
        memoryEnabled: data.memoryEnabled,
        onboardingDone: true,
      },
      update: {
        preferredName: data.preferredName,
        workRole: data.workRole,
        timezone: data.timezone,
        currentMode: data.currentMode,
        notificationsOn: data.notificationsOn,
        voiceEnabled: data.voiceEnabled,
        memoryEnabled: data.memoryEnabled,
        onboardingDone: true,
      },
    })

    // Create initial memory entries
    const memoriesToUpsert: { category: string; key: string; value: string }[] = [
      { category: 'profile', key: 'preferred_name', value: data.preferredName },
    ]

    if (data.workRole) {
      memoriesToUpsert.push({ category: 'profile', key: 'work_role', value: data.workRole })
    }

    for (const mem of memoriesToUpsert) {
      await prisma.memory.upsert({
        where: { userId_key: { userId: user.id, key: mem.key } },
        create: {
          userId: user.id,
          category: mem.category,
          key: mem.key,
          value: mem.value,
          source: 'onboarding',
        },
        update: {
          value: mem.value,
          source: 'onboarding',
        },
      })
    }

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'ONBOARDING_COMPLETED',
        entityType: 'user',
        entityId: user.id,
        details: `Onboarding completed for ${data.preferredName}`,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
