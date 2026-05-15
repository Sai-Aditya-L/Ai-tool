import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  category: z
    .enum(['personal', 'career', 'fitness', 'financial', 'learning', 'travel', 'project', 'habit'])
    .optional(),
  status: z.enum(['active', 'completed', 'paused', 'archived']).optional(),
  targetDate: z.string().nullable().optional(),
  progress: z.number().min(0).max(100).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  tags: z.string().optional(),
  notes: z.string().optional(),
})

const milestoneSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  order: z.number().default(0),
})

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const goal = await prisma.goal.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      milestones: {
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

  return NextResponse.json({ goal })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const goal = await prisma.goal.findFirst({ where: { id: params.id, userId: user.id } })
  if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

  try {
    const body = await req.json()
    const data = updateSchema.parse(body)

    const updated = await prisma.goal.update({
      where: { id: params.id },
      data: {
        ...data,
        targetDate:
          data.targetDate !== undefined
            ? data.targetDate
              ? new Date(data.targetDate)
              : null
            : undefined,
      },
      include: {
        milestones: {
          orderBy: { order: 'asc' },
        },
      },
    })

    return NextResponse.json({ goal: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const goal = await prisma.goal.findFirst({ where: { id: params.id, userId: user.id } })
  if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

  // milestones are cascade-deleted by Prisma schema
  await prisma.goal.delete({ where: { id: params.id } })

  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: 'GOAL_DELETED',
      entityType: 'goal',
      entityId: params.id,
      details: `Deleted goal: ${goal.title}`,
    },
  })

  return NextResponse.json({ success: true })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const goal = await prisma.goal.findFirst({
    where: { id: params.id, userId: user.id },
    include: { milestones: true },
  })
  if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

  try {
    const body = await req.json()
    const { action } = body

    if (action === 'add_milestone') {
      const data = milestoneSchema.parse(body)

      const milestone = await prisma.milestone.create({
        data: {
          goalId: params.id,
          userId: user.id,
          title: data.title,
          description: data.description,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          order: data.order,
        },
      })

      return NextResponse.json({ milestone }, { status: 201 })
    }

    if (action === 'toggle_milestone') {
      const { milestoneId } = body
      if (!milestoneId) return NextResponse.json({ error: 'milestoneId required' }, { status: 400 })

      const milestone = await prisma.milestone.findFirst({
        where: { id: milestoneId, userId: user.id },
      })
      if (!milestone) return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })

      const updated = await prisma.milestone.update({
        where: { id: milestoneId },
        data: {
          completed: !milestone.completed,
          completedAt: !milestone.completed ? new Date() : null,
        },
      })

      // Recalculate goal progress
      const allMilestones = await prisma.milestone.findMany({
        where: { goalId: params.id },
      })
      const completedCount = allMilestones.filter(m =>
        m.id === milestoneId ? !milestone.completed : m.completed
      ).length
      const progress =
        allMilestones.length > 0
          ? Math.round((completedCount / allMilestones.length) * 100)
          : goal.progress

      await prisma.goal.update({
        where: { id: params.id },
        data: { progress },
      })

      return NextResponse.json({ milestone: updated, progress })
    }

    if (action === 'delete_milestone') {
      const { milestoneId } = body
      if (!milestoneId) return NextResponse.json({ error: 'milestoneId required' }, { status: 400 })

      const milestone = await prisma.milestone.findFirst({
        where: { id: milestoneId, userId: user.id },
      })
      if (!milestone) return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })

      await prisma.milestone.delete({ where: { id: milestoneId } })

      // Recalculate progress after deletion
      const remaining = await prisma.milestone.findMany({ where: { goalId: params.id } })
      const completedCount = remaining.filter(m => m.completed).length
      const progress =
        remaining.length > 0 ? Math.round((completedCount / remaining.length) * 100) : 0

      await prisma.goal.update({
        where: { id: params.id },
        data: { progress },
      })

      return NextResponse.json({ success: true, progress })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
