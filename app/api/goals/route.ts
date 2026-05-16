import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

const goalSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z
    .enum(['personal', 'career', 'fitness', 'financial', 'learning', 'travel', 'project', 'habit'])
    .default('personal'),
  status: z.enum(['active', 'completed', 'paused', 'archived']).default('active'),
  targetDate: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  tags: z.string().optional(),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const status = searchParams.get('status')

  const goals = await prisma.goal.findMany({
    where: {
      userId: user.id,
      ...(category && category !== 'all' && { category }),
      ...(status && { status }),
    },
    include: {
      milestones: {
        orderBy: { order: 'asc' },
      },
    },
    orderBy: [{ priority: 'desc' }, { targetDate: 'asc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json({ goals })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const rl = rateLimit(`goals:${user.id}`, 20, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  try {
    const body = await req.json()
    const data = goalSchema.parse(body)

    const goal = await prisma.goal.create({
      data: {
        userId: user.id,
        title: data.title,
        description: data.description,
        category: data.category,
        status: data.status,
        targetDate: data.targetDate ? new Date(data.targetDate) : null,
        priority: data.priority,
        tags: data.tags,
        notes: data.notes,
      },
      include: {
        milestones: true,
      },
    })

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'GOAL_CREATED',
        entityType: 'goal',
        entityId: goal.id,
        details: `Created goal: ${goal.title}`,
      },
    })

    return NextResponse.json({ goal }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
