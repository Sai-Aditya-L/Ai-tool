import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const reminderSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  dueAt: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  recurring: z.boolean().default(false),
  recurrenceRule: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || 'pending'

  const reminders = await prisma.reminder.findMany({
    where: {
      userId: user.id,
      status,
    },
    orderBy: { dueAt: 'asc' },
    take: 50,
  })

  return NextResponse.json({ reminders })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  try {
    const body = await req.json()
    const data = reminderSchema.parse(body)

    const reminder = await prisma.reminder.create({
      data: {
        userId: user.id,
        title: data.title,
        description: data.description,
        dueAt: new Date(data.dueAt),
        priority: data.priority,
        recurring: data.recurring,
        recurrenceRule: data.recurrenceRule,
      },
    })

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'REMINDER_CREATED',
        entityType: 'reminder',
        entityId: reminder.id,
        details: `Created reminder: ${reminder.title}`,
      },
    })

    return NextResponse.json({ reminder }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
