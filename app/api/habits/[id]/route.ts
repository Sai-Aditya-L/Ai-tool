import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
  status: z.enum(['active', 'archived', 'paused']).optional(),
})

const toggleSchema = z.object({
  action: z.literal('toggle'),
  date: z.string().optional(),
})

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const habit = await prisma.habit.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      entries: {
        orderBy: { date: 'desc' },
        take: 90,
      },
    },
  })

  if (!habit) return NextResponse.json({ error: 'Habit not found' }, { status: 404 })

  return NextResponse.json({ habit })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const habit = await prisma.habit.findFirst({ where: { id: params.id, userId: user.id } })
  if (!habit) return NextResponse.json({ error: 'Habit not found' }, { status: 404 })

  try {
    const body = await req.json()
    const data = updateSchema.parse(body)

    const updated = await prisma.habit.update({
      where: { id: params.id },
      data,
    })

    return NextResponse.json({ habit: updated })
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

  const habit = await prisma.habit.findFirst({ where: { id: params.id, userId: user.id } })
  if (!habit) return NextResponse.json({ error: 'Habit not found' }, { status: 404 })

  await prisma.habit.delete({ where: { id: params.id } })

  return NextResponse.json({ success: true })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const habit = await prisma.habit.findFirst({ where: { id: params.id, userId: user.id } })
  if (!habit) return NextResponse.json({ error: 'Habit not found' }, { status: 404 })

  try {
    const body = await req.json()
    const { date } = toggleSchema.parse(body)

    const targetDate = date ?? new Date().toISOString().split('T')[0]

    const existing = await prisma.habitEntry.findUnique({
      where: { habitId_date: { habitId: params.id, date: targetDate } },
    })

    if (existing && existing.completed) {
      // Untoggle: delete the entry
      await prisma.habitEntry.delete({
        where: { habitId_date: { habitId: params.id, date: targetDate } },
      })
      return NextResponse.json({ completed: false, date: targetDate })
    } else if (existing) {
      // Entry exists but not completed: update to completed
      const updated = await prisma.habitEntry.update({
        where: { habitId_date: { habitId: params.id, date: targetDate } },
        data: { completed: true },
      })
      return NextResponse.json({ completed: true, date: targetDate, entry: updated })
    } else {
      // Create new entry
      const entry = await prisma.habitEntry.create({
        data: {
          habitId: params.id,
          userId: user.id,
          date: targetDate,
          completed: true,
        },
      })
      return NextResponse.json({ completed: true, date: targetDate, entry })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
