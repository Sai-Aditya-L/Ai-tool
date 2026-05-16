import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { checkAndAwardAchievements } from '@/lib/achievements'

const taskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  dueDate: z.string().optional(),
  tags: z.string().optional(),
  parentId: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const priority = searchParams.get('priority')
  const limit = parseInt(searchParams.get('limit') || '50')

  const tasks = await prisma.task.findMany({
    where: {
      userId: user.id,
      parentId: null,
      ...(status && { status }),
      ...(priority && { priority }),
    },
    include: { subtasks: true },
    orderBy: [
      { priority: 'desc' },
      { dueDate: 'asc' },
      { createdAt: 'desc' },
    ],
    take: limit,
  })

  return NextResponse.json({ tasks })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const rl = rateLimit(`tasks:${user.id}`, 20, 60_000)
  if (!rl.success) return rateLimitResponse()

  try {
    const body = await req.json()
    const data = taskSchema.parse(body)

    const task = await prisma.task.create({
      data: {
        userId: user.id,
        title: data.title,
        description: data.description,
        priority: data.priority,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        tags: data.tags,
        parentId: data.parentId,
        isRecurring: body.isRecurring ?? false,
        recurringSchedule: body.recurringSchedule ?? null,
      },
      include: { subtasks: true },
    })

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'TASK_CREATED',
        entityType: 'task',
        entityId: task.id,
        details: `Created task: ${task.title}`,
      },
    })

    checkAndAwardAchievements(user.id).catch(() => {})

    return NextResponse.json({ task }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
