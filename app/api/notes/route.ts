import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const noteSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string(),
  tags: z.string().optional(),
  pinned: z.boolean().default(false),
  color: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')

  const notes = await prisma.note.findMany({
    where: {
      userId: user.id,
      ...(query && {
        OR: [
          { title: { contains: query } },
          { content: { contains: query } },
          { tags: { contains: query } },
        ],
      }),
    },
    orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
    take: 50,
  })

  return NextResponse.json({ notes })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  try {
    const body = await req.json()
    const data = noteSchema.parse(body)
    const note = await prisma.note.create({ data: { userId: user.id, ...data } })

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'NOTE_CREATED',
        entityType: 'note',
        entityId: note.id,
        details: `Created note: ${note.title}`,
      },
    })

    return NextResponse.json({ note }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
