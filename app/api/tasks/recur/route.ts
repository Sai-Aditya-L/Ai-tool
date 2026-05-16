import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/tasks/recur
 * Body: { parentTaskId: string }
 * Creates the next recurrence of a recurring task based on its recurringSchedule.
 * Called by the job queue.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const body = await req.json()
  const { parentTaskId } = body

  if (!parentTaskId) {
    return NextResponse.json({ error: 'parentTaskId is required' }, { status: 400 })
  }

  const parent = await prisma.task.findFirst({
    where: { id: parentTaskId, userId: user.id },
  })

  if (!parent) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  if (!parent.isRecurring || !parent.recurringSchedule) {
    return NextResponse.json({ error: 'Task is not recurring' }, { status: 400 })
  }

  // Calculate next due date based on recurringSchedule
  const baseDate = parent.dueDate ?? new Date()
  const nextDueDate = calculateNextDueDate(baseDate, parent.recurringSchedule)

  if (!nextDueDate) {
    return NextResponse.json({ error: 'Could not calculate next due date' }, { status: 400 })
  }

  const newTask = await prisma.task.create({
    data: {
      userId: user.id,
      title: parent.title,
      description: parent.description ?? undefined,
      priority: parent.priority,
      tags: parent.tags ?? undefined,
      dueDate: nextDueDate,
      isRecurring: true,
      recurringSchedule: parent.recurringSchedule,
      recurringParentId: parent.id,
    },
    include: { subtasks: true },
  })

  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: 'TASK_RECURRENCE_CREATED',
      entityType: 'task',
      entityId: newTask.id,
      details: `Auto-created recurrence of task: ${parent.title}`,
    },
  }).catch(() => {})

  return NextResponse.json({ task: newTask }, { status: 201 })
}

/**
 * Calculate the next due date based on the recurring schedule.
 * - daily: +1 day
 * - weekly: +7 days
 * - monthly: +1 month
 * - weekdays: +1 day, skipping Saturday and Sunday (advances to Monday if needed)
 */
function calculateNextDueDate(from: Date, schedule: string): Date | null {
  const next = new Date(from)

  switch (schedule) {
    case 'daily':
      next.setDate(next.getDate() + 1)
      break

    case 'weekly':
      next.setDate(next.getDate() + 7)
      break

    case 'monthly':
      next.setMonth(next.getMonth() + 1)
      break

    case 'weekdays': {
      // Advance by at least 1 day, then skip weekend
      next.setDate(next.getDate() + 1)
      const day = next.getDay()
      if (day === 6) {
        // Saturday → Monday (+2)
        next.setDate(next.getDate() + 2)
      } else if (day === 0) {
        // Sunday → Monday (+1)
        next.setDate(next.getDate() + 1)
      }
      break
    }

    default:
      return null
  }

  return next
}
