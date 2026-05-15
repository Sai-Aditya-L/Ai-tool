import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const patchSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  dueAt: z.string().datetime().optional(),
  status: z.enum(['pending', 'active', 'completed', 'snoozed']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  recurring: z.boolean().optional(),
  recurrenceRule: z.string().max(50).optional(),
  snoozedUntil: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const reminder = await prisma.reminder.findFirst({ where: { id: params.id, userId: user.id } })
  if (!reminder) return NextResponse.json({ error: 'Reminder not found' }, { status: 404 })

  try {
    const body = await req.json()
    const data = patchSchema.parse(body)
    const updated = await prisma.reminder.update({
      where: { id: params.id },
      data: {
        ...data,
        dueAt: data.dueAt ? new Date(data.dueAt) : undefined,
        snoozedUntil: data.snoozedUntil ? new Date(data.snoozedUntil) : undefined,
        completedAt: data.status === 'completed' ? new Date() : undefined,
      },
    })
    return NextResponse.json({ reminder: updated })
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

  const reminder = await prisma.reminder.findFirst({ where: { id: params.id, userId: user.id } })
  if (!reminder) return NextResponse.json({ error: 'Reminder not found' }, { status: 404 })

  await prisma.reminder.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
