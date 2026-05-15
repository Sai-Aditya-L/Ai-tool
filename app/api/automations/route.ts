import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1).max(200),
  trigger: z.string().min(1),
  action: z.string().min(1),
  description: z.string().optional(),
  schedule: z.enum(['daily', 'weekly', 'on_event', 'manual']).optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const automations = await prisma.automation.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ automations })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  try {
    const body = await req.json()
    const data = createSchema.parse(body)

    const automation = await prisma.automation.create({
      data: {
        userId: user.id,
        name: data.name,
        trigger: data.trigger,
        actions: data.action,
        description: data.description,
        conditions: data.schedule ?? null,
        status: 'active',
      },
    })

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'AUTOMATION_CREATED',
        entityType: 'automation',
        entityId: automation.id,
        details: `Created automation: ${automation.name}`,
      },
    })

    return NextResponse.json({ automation }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
