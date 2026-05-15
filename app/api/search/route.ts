import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const identifier = user?.id || req.headers.get('x-forwarded-for') || 'anonymous'
  const rl = rateLimit(`search:${identifier}`, 30, 60_000)
  if (!rl.success) return rateLimitResponse()

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''

  if (!q) {
    return NextResponse.json({ tasks: [], reminders: [], notes: [], memories: [], files: [], conversations: [] })
  }

  const [tasks, reminders, notes, memories, files, conversations] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId: user.id,
        OR: [
          { title: { contains: q } },
          { description: { contains: q } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, title: true, description: true, status: true, priority: true, tags: true },
    }),

    prisma.reminder.findMany({
      where: {
        userId: user.id,
        title: { contains: q },
      },
      orderBy: { dueAt: 'asc' },
      take: 5,
      select: { id: true, title: true, status: true, priority: true, dueAt: true },
    }),

    prisma.note.findMany({
      where: {
        userId: user.id,
        OR: [
          { title: { contains: q } },
          { content: { contains: q } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: { id: true, title: true, content: true, tags: true, pinned: true },
    }),

    prisma.memory.findMany({
      where: {
        userId: user.id,
        OR: [
          { key: { contains: q } },
          { value: { contains: q } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: { id: true, key: true, value: true, category: true },
    }),

    prisma.userFile.findMany({
      where: {
        userId: user.id,
        name: { contains: q },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, name: true, originalName: true, mimeType: true, size: true, tags: true },
    }),

    prisma.conversation.findMany({
      where: {
        userId: user.id,
        title: { contains: q },
      },
      orderBy: { updatedAt: 'desc' },
      take: 3,
      select: { id: true, title: true, updatedAt: true },
    }),
  ])

  return NextResponse.json({ tasks, reminders, notes, memories, files, conversations })
}
