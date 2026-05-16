import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { anthropic } from '@/lib/anthropic'

export const dynamic = 'force-dynamic'

async function getWorldState(userId: string) {
  const now = new Date()
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  const [
    upcomingEvents,
    overdueTasks,
    dueTodayTasks,
    pendingReminders,
    activeAgents,
    activeAutomations,
    goalProgress,
    memoryCount,
  ] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: { userId, startTime: { gte: now, lte: in7Days } },
      orderBy: { startTime: 'asc' },
      select: { title: true, startTime: true, endTime: true, location: true, allDay: true },
      take: 20,
    }),
    prisma.task.findMany({
      where: { userId, status: { not: 'completed' }, dueDate: { lt: now } },
      orderBy: { dueDate: 'asc' },
      select: { title: true, dueDate: true, priority: true, status: true },
      take: 20,
    }),
    prisma.task.findMany({
      where: { userId, status: { not: 'completed' }, dueDate: { gte: startOfToday, lte: endOfToday } },
      orderBy: { priority: 'asc' },
      select: { title: true, dueDate: true, priority: true, status: true },
      take: 20,
    }),
    prisma.reminder.findMany({
      where: { userId, status: 'pending', dueAt: { gte: now, lte: in24h } },
      orderBy: { dueAt: 'asc' },
      select: { title: true, dueAt: true, priority: true },
      take: 10,
    }),
    prisma.agentRun.count({ where: { userId, status: { in: ['running', 'pending'] } } }),
    prisma.automation.count({ where: { userId, status: 'active' } }),
    prisma.goal.findMany({
      where: { userId, status: 'active' },
      select: { title: true, progress: true, targetDate: true, category: true, priority: true },
      take: 10,
    }),
    prisma.memory.count({ where: { userId } }),
  ])

  return {
    currentTime: now.toISOString(),
    upcomingEvents,
    overdueTasks,
    dueTodayTasks,
    pendingReminders,
    activeAgentsCount: activeAgents,
    activeAutomationsCount: activeAutomations,
    goalProgress,
    memoryCount,
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  let query: string
  try {
    const body = await req.json()
    query = body.query?.trim()
    if (!query) return NextResponse.json({ error: 'query is required' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Fetch world state directly from DB
  const worldState = await getWorldState(user.id)

  // Build context summary
  const contextStr = `
WORLD STATE SUMMARY (as of ${worldState.currentTime}):
- Overdue tasks: ${worldState.overdueTasks.length} ${worldState.overdueTasks.length > 0 ? `(${worldState.overdueTasks.map(t => `"${t.title}" [${t.priority}]`).join(', ')})` : ''}
- Tasks due today: ${worldState.dueTodayTasks.length} ${worldState.dueTodayTasks.length > 0 ? `(${worldState.dueTodayTasks.map(t => `"${t.title}"`).join(', ')})` : ''}
- Upcoming events (next 7 days): ${worldState.upcomingEvents.length} ${worldState.upcomingEvents.length > 0 ? `(${worldState.upcomingEvents.slice(0, 5).map(e => `"${e.title}" at ${new Date(e.startTime).toLocaleString()}`).join(', ')})` : ''}
- Pending reminders (next 24h): ${worldState.pendingReminders.length} ${worldState.pendingReminders.length > 0 ? `(${worldState.pendingReminders.map(r => `"${r.title}" at ${new Date(r.dueAt).toLocaleString()}`).join(', ')})` : ''}
- Active AI agents: ${worldState.activeAgentsCount}
- Active automations: ${worldState.activeAutomationsCount}
- Memory entries: ${worldState.memoryCount}
- Active goals: ${worldState.goalProgress.length} ${worldState.goalProgress.length > 0 ? `(${worldState.goalProgress.map(g => `"${g.title}" ${g.progress}% complete`).join(', ')})` : ''}
`.trim()

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: `You are NEXUS Simulation Engine. You analyze the user's current world state and answer predictive/planning questions.
Given the world state context provided and the user's query, produce a simulation result.
Respond with JSON only:
{
  "type": "schedule|workload|deadline|travel|budget|comparison",
  "result": "clear explanation of the simulation result",
  "assumptions": ["assumption 1", "assumption 2"],
  "confidence": "high|medium|low",
  "recommendation": "specific actionable recommendation"
}`,
    messages: [
      {
        role: 'user',
        content: `${contextStr}\n\nUSER QUERY: ${query}`,
      },
    ],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'

  let parsed: {
    type: string
    result: string
    assumptions: string[]
    confidence: 'high' | 'medium' | 'low'
    recommendation: string
  }

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null
    if (!parsed || !parsed.result) throw new Error('Invalid response')
  } catch {
    parsed = {
      type: 'general',
      result: raw,
      assumptions: ['Simulation based on current world state data'],
      confidence: 'medium',
      recommendation: 'Review your current tasks and calendar for accurate planning.',
    }
  }

  return NextResponse.json({
    result: parsed.result,
    assumptions: parsed.assumptions || [],
    confidence: parsed.confidence || 'medium',
    type: parsed.type || 'general',
    recommendation: parsed.recommendation || '',
  })
}
