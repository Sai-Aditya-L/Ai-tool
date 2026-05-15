import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const trackerSchema = z.object({
  type: z.enum(['bill', 'subscription', 'expense', 'package', 'habit', 'goal', 'job_application', 'custom']),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.string().default('active'),
  dueDate: z.string().optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  tags: z.string().optional(),
  data: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')

  const trackers = await prisma.tracker.findMany({
    where: { userId: user.id, ...(type && { type }) },
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json({ trackers })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  try {
    const body = await req.json()
    const data = trackerSchema.parse(body)

    const tracker = await prisma.tracker.create({
      data: {
        userId: user.id,
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
      },
    })

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'TRACKER_CREATED',
        entityType: 'tracker',
        entityId: tracker.id,
        details: `Created tracker: ${tracker.title}`,
      },
    })

    return NextResponse.json({ tracker }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
