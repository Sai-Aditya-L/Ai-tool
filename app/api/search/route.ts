import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { format } from 'date-fns'

export type SearchResultType = 'task' | 'note' | 'goal' | 'habit' | 'reminder' | 'memory' | 'meeting' | 'snippet'

export interface SearchResult {
  id: string
  type: SearchResultType
  title: string
  subtitle?: string
  href: string
  icon: string
  updatedAt?: string
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const identifier = user.id
  const rl = rateLimit(`search:${identifier}`, 30, 60_000)
  if (!rl.success) return rateLimitResponse()

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const typesParam = searchParams.get('types')
  const activeTypes: SearchResultType[] = typesParam
    ? (typesParam.split(',') as SearchResultType[])
    : ['task', 'note', 'goal', 'habit', 'reminder', 'memory', 'meeting', 'snippet']

  if (q.length < 2) {
    return NextResponse.json({ results: [], total: 0, query: q })
  }

  const [tasks, notes, goals, habits, reminders, memories, meetings, snippets] = await Promise.all([
    activeTypes.includes('task') ? prisma.task.findMany({
      where: {
        userId: user.id,
        OR: [
          { title: { contains: q } },
          { description: { contains: q } },
        ],
      },
      take: 5,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, status: true, priority: true, updatedAt: true },
    }) : [],

    activeTypes.includes('note') ? prisma.note.findMany({
      where: {
        userId: user.id,
        OR: [
          { title: { contains: q } },
          { content: { contains: q } },
        ],
      },
      take: 5,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, content: true, updatedAt: true },
    }) : [],

    activeTypes.includes('goal') ? prisma.goal.findMany({
      where: {
        userId: user.id,
        OR: [
          { title: { contains: q } },
          { description: { contains: q } },
        ],
      },
      take: 5,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, description: true, status: true, updatedAt: true },
    }) : [],

    activeTypes.includes('habit') ? prisma.habit.findMany({
      where: {
        userId: user.id,
        OR: [
          { title: { contains: q } },
          { description: { contains: q } },
        ],
      },
      take: 5,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, description: true, status: true, updatedAt: true },
    }) : [],

    activeTypes.includes('reminder') ? prisma.reminder.findMany({
      where: {
        userId: user.id,
        title: { contains: q },
      },
      take: 5,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, status: true, dueAt: true, updatedAt: true },
    }) : [],

    activeTypes.includes('memory') ? prisma.memory.findMany({
      where: {
        userId: user.id,
        OR: [
          { key: { contains: q } },
          { value: { contains: q } },
        ],
      },
      take: 5,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, key: true, value: true, category: true, updatedAt: true },
    }) : [],

    activeTypes.includes('meeting') ? prisma.meeting.findMany({
      where: {
        userId: user.id,
        OR: [
          { title: { contains: q } },
          { notes: { contains: q } },
        ],
      },
      take: 5,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, notes: true, date: true, updatedAt: true },
    }) : [],

    // Snippet model may not exist yet — wrap in try/catch
    activeTypes.includes('snippet') ? (async () => {
      try {
        return await prisma.snippet.findMany({
          where: {
            userId: user.id,
            OR: [
              { title: { contains: q } },
              { code: { contains: q } },
              { tags: { contains: q } },
            ],
          },
          take: 5,
          orderBy: { updatedAt: 'desc' },
          select: { id: true, title: true, language: true, updatedAt: true },
        })
      } catch {
        return []
      }
    })() : Promise.resolve([]),
  ])

  const results: SearchResult[] = [
    ...(tasks as Array<{ id: string; title: string; status: string; priority: string; updatedAt: Date }>).map(t => ({
      id: t.id,
      type: 'task' as const,
      title: t.title,
      subtitle: t.status,
      href: '/tasks',
      icon: 'CheckSquare',
      updatedAt: t.updatedAt.toISOString(),
    })),

    ...(notes as Array<{ id: string; title: string; content: string | null; updatedAt: Date }>).map(n => ({
      id: n.id,
      type: 'note' as const,
      title: n.title,
      subtitle: n.content?.slice(0, 100),
      href: '/notes',
      icon: 'StickyNote',
      updatedAt: n.updatedAt.toISOString(),
    })),

    ...(goals as Array<{ id: string; title: string; description: string | null; status: string; updatedAt: Date }>).map(g => ({
      id: g.id,
      type: 'goal' as const,
      title: g.title,
      subtitle: g.description?.slice(0, 100),
      href: '/goals',
      icon: 'Target',
      updatedAt: g.updatedAt.toISOString(),
    })),

    ...(habits as Array<{ id: string; title: string; description: string | null; status: string; updatedAt: Date }>).map(h => ({
      id: h.id,
      type: 'habit' as const,
      title: h.title,
      subtitle: h.description?.slice(0, 100),
      href: '/habits',
      icon: 'Flame',
      updatedAt: h.updatedAt.toISOString(),
    })),

    ...(reminders as Array<{ id: string; title: string; status: string; dueAt: Date; updatedAt: Date }>).map(r => ({
      id: r.id,
      type: 'reminder' as const,
      title: r.title,
      subtitle: r.status,
      href: '/reminders',
      icon: 'Bell',
      updatedAt: r.updatedAt.toISOString(),
    })),

    ...(memories as Array<{ id: string; key: string; value: string; category: string; updatedAt: Date }>).map(m => ({
      id: m.id,
      type: 'memory' as const,
      title: m.key,
      subtitle: m.value?.slice(0, 100),
      href: '/memory',
      icon: 'Brain',
      updatedAt: m.updatedAt.toISOString(),
    })),

    ...(meetings as Array<{ id: string; title: string; notes: string | null; date: Date; updatedAt: Date }>).map(m => ({
      id: m.id,
      type: 'meeting' as const,
      title: m.title,
      subtitle: format(m.date, 'MMM d, yyyy h:mm a'),
      href: '/meetings',
      icon: 'Calendar',
      updatedAt: m.updatedAt.toISOString(),
    })),

    ...(snippets as Array<{ id: string; title: string; language: string; updatedAt: Date }>).map(s => ({
      id: s.id,
      type: 'snippet' as const,
      title: s.title,
      subtitle: s.language,
      href: '/dev',
      icon: 'Code2',
      updatedAt: s.updatedAt.toISOString(),
    })),
  ]

  return NextResponse.json({ results, total: results.length, query: q })
}
