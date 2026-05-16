import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

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

  const rl = rateLimit(`reminders:${user.id}`, 20, 60_000)
  if (!rl.success) return rateLimitResponse()

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

    // Schedule push notification for reminder
    try {
      const dueAt = reminder.dueAt
      if (dueAt && new Date(dueAt) > new Date()) {
        // Log to ActivityLog so the job queue can pick it up
        await prisma.activityLog.create({
          data: {
            userId: user.id,
            action: 'reminder_scheduled',
            entityType: 'reminder',
            entityId: reminder.id,
            metadata: JSON.stringify({
              title: reminder.title,
              dueAt: new Date(dueAt).toISOString(),
              scheduledPush: true,
            }),
          },
        })
        // Also enqueue a job if the Job model exists
        await prisma.job.create({
          data: {
            userId: user.id,
            type: 'digest_send',
            payload: JSON.stringify({ reminderId: reminder.id, userId: user.id, title: reminder.title }),
            nextRunAt: new Date(dueAt),
          },
        }).catch(() => {}) // Silently fail if Job model not yet migrated
      }
    } catch {
      // Never let notification scheduling break reminder creation
    }

    return NextResponse.json({ reminder }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
