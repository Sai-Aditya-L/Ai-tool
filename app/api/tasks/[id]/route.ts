import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  dueDate: z.string().nullable().optional(),
  tags: z.string().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const task = await prisma.task.findFirst({ where: { id: params.id, userId: user.id } })
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  try {
    const body = await req.json()
    const data = updateSchema.parse(body)

    const updated = await prisma.task.update({
      where: { id: params.id },
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : data.dueDate === null ? null : undefined,
        completedAt: data.status === 'completed' ? new Date() : undefined,
      },
      include: { subtasks: true },
    })

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'TASK_UPDATED',
        entityType: 'task',
        entityId: task.id,
        details: `Updated task: ${updated.title}${data.status ? ` → ${data.status}` : ''}`,
      },
    })

    return NextResponse.json({ task: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const task = await prisma.task.findFirst({ where: { id: params.id, userId: user.id } })
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  await prisma.task.delete({ where: { id: params.id } })

  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: 'TASK_DELETED',
      entityType: 'task',
      entityId: params.id,
      details: `Deleted task: ${task.title}`,
    },
  })

  return NextResponse.json({ success: true })
}
