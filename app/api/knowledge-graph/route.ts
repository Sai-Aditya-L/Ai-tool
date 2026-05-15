import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Simple similarity: check if 2+ significant words overlap (ignore common words)
const STOP_WORDS = new Set(['the','a','an','is','in','on','at','to','for','of','and','or','with','my','i','by','be','was'])

function similarWords(a: string, b: string): boolean {
  const wordsA = a.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !STOP_WORDS.has(w))
  const wordsB = new Set(b.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !STOP_WORDS.has(w)))
  return wordsA.filter(w => wordsB.has(w)).length >= 2
}

interface GraphNode {
  id: string
  type: string
  label: string
  entityId: string
  count?: number
}

interface GraphEdge {
  from: string
  to: string
  type: string
  label: string
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  try {
    // Fetch all data in parallel
    const [tasks, notes, memories, calendarEvents, reminders, files, goals] = await Promise.all([
      prisma.task.findMany({
        where: { userId: user.id, status: { not: 'cancelled' } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, title: true, tags: true, status: true },
      }),
      prisma.note.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: { id: true, title: true, tags: true },
      }),
      prisma.memory.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: 'desc' },
        take: 15,
        select: { id: true, key: true, value: true, category: true },
      }),
      prisma.calendarEvent.findMany({
        where: { userId: user.id, startTime: { gte: new Date() } },
        orderBy: { startTime: 'asc' },
        take: 10,
        select: { id: true, title: true, startTime: true },
      }),
      prisma.reminder.findMany({
        where: { userId: user.id, status: 'pending' },
        orderBy: { dueAt: 'asc' },
        take: 10,
        select: { id: true, title: true },
      }),
      prisma.userFile.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, name: true, mimeType: true },
      }),
      prisma.goal.findMany({
        where: { userId: user.id, status: 'active' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, tags: true, category: true },
      }),
    ])

    const nodes: GraphNode[] = []
    const edges: GraphEdge[] = []
    const edgeSet = new Set<string>()

    const addEdge = (from: string, to: string, type: string, label: string) => {
      const key = `${from}:${to}:${type}`
      if (!edgeSet.has(key)) {
        edgeSet.add(key)
        edges.push({ from, to, type, label })
      }
    }

    // Build task nodes
    tasks.forEach(task => {
      nodes.push({ id: `task:${task.id}`, type: 'tasks', label: task.title, entityId: task.id })
    })

    // Build note nodes
    notes.forEach(note => {
      nodes.push({ id: `note:${note.id}`, type: 'notes', label: note.title, entityId: note.id })
    })

    // Group memories by category
    const memoryCategories: Record<string, typeof memories> = {}
    memories.forEach(m => {
      if (!memoryCategories[m.category]) memoryCategories[m.category] = []
      memoryCategories[m.category].push(m)
    })
    memories.forEach(mem => {
      nodes.push({ id: `memory:${mem.id}`, type: 'memories', label: `${mem.key}: ${mem.value.slice(0, 40)}`, entityId: mem.id })
    })

    // Build calendar event nodes
    calendarEvents.forEach(evt => {
      nodes.push({ id: `cal:${evt.id}`, type: 'calendarEvents', label: evt.title, entityId: evt.id })
    })

    // Build reminder nodes
    reminders.forEach(rem => {
      nodes.push({ id: `reminder:${rem.id}`, type: 'reminders', label: rem.title, entityId: rem.id })
    })

    // Build file nodes
    files.forEach(f => {
      nodes.push({ id: `file:${f.id}`, type: 'files', label: f.name, entityId: f.id })
    })

    // Build goal nodes
    goals.forEach(goal => {
      nodes.push({ id: `goal:${goal.id}`, type: 'goals', label: goal.title, entityId: goal.id })
    })

    // Auto-generate edges

    // task + reminder with similar title: related_to
    tasks.forEach(task => {
      reminders.forEach(rem => {
        if (similarWords(task.title, rem.title)) {
          addEdge(`task:${task.id}`, `reminder:${rem.id}`, 'related_to', 'related to')
        }
      })
    })

    // note + task with similar tags: related_to
    notes.forEach(note => {
      tasks.forEach(task => {
        const noteTags = note.tags || ''
        const taskTags = task.tags || ''
        if (noteTags && taskTags && similarWords(noteTags, taskTags)) {
          addEdge(`note:${note.id}`, `task:${task.id}`, 'related_to', 'tagged with')
        } else if (similarWords(note.title, task.title)) {
          addEdge(`note:${note.id}`, `task:${task.id}`, 'related_to', 'related to')
        }
      })
    })

    // calendar event + task with similar title words: related_to
    calendarEvents.forEach(evt => {
      tasks.forEach(task => {
        if (similarWords(evt.title, task.title)) {
          addEdge(`cal:${evt.id}`, `task:${task.id}`, 'related_to', 'scheduled for')
        }
      })
    })

    // goal + tasks: belongs_to (if task tags match goal title)
    goals.forEach(goal => {
      tasks.forEach(task => {
        const taskTags = task.tags || ''
        const matchesTags = taskTags && goal.title.toLowerCase().split(/\W+/).filter(w => w.length > 3).some(w => taskTags.toLowerCase().includes(w))
        const matchesTitle = similarWords(goal.title, task.title)
        if (matchesTags || matchesTitle) {
          addEdge(`task:${task.id}`, `goal:${goal.id}`, 'belongs_to', 'toward goal')
        }
      })
    })

    // note + goal with similar title
    goals.forEach(goal => {
      notes.forEach(note => {
        if (similarWords(goal.title, note.title)) {
          addEdge(`note:${note.id}`, `goal:${goal.id}`, 'related_to', 'supports goal')
        }
      })
    })

    return NextResponse.json({ nodes, edges })
  } catch (error) {
    console.error('Knowledge graph error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
