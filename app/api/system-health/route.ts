import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const userId = user.id
  const now = new Date()
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const [
    recentAgentFailures,
    activeAgents,
    integrations,
    recentErrors,
    pendingTasks,
    overdueTasks,
    memoryCount,
    unreadNotifCount,
  ] = await Promise.all([
    // AgentRun failures in last 24h
    prisma.agentRun.count({
      where: { userId, status: 'failed', createdAt: { gte: last24h } },
    }),
    // Active agents (running or pending)
    prisma.agentRun.count({
      where: { userId, status: { in: ['running', 'pending'] } },
    }),
    // Integration records with status
    prisma.integration.findMany({
      where: { userId },
      select: { provider: true, status: true, createdAt: true },
    }),
    // Recent errors from ActivityLog
    prisma.activityLog.findMany({
      where: {
        userId,
        OR: [
          { action: { contains: 'ERROR' } },
          { details: { contains: 'error' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { action: true, details: true, createdAt: true },
    }),
    // Pending tasks count
    prisma.task.count({
      where: { userId, status: 'pending' },
    }),
    // Overdue tasks (past dueDate, not completed)
    prisma.task.count({
      where: { userId, status: { not: 'completed' }, dueDate: { lt: now } },
    }),
    // Memory count
    prisma.memory.count({ where: { userId } }),
    // Unread notifications count
    prisma.notification.count({ where: { userId, read: false } }),
  ])

  // Automation failures — try/catch in case the status field behaves differently
  let automationFailures24h = 0
  try {
    automationFailures24h = await prisma.automationRun.count({
      where: { userId, status: 'failed', createdAt: { gte: last24h } },
    })
  } catch {
    automationFailures24h = 0
  }

  // Determine overall health
  let health: 'healthy' | 'degraded' | 'critical' = 'healthy'
  if (recentAgentFailures > 5) {
    health = 'critical'
  } else if (recentAgentFailures > 0) {
    health = 'degraded'
  }

  return NextResponse.json({
    health,
    agentFailures24h: recentAgentFailures,
    automationFailures24h,
    activeAgentsCount: activeAgents,
    integrations: integrations.map(i => ({
      provider: i.provider,
      status: i.status,
      connectedAt: i.createdAt.toISOString(),
    })),
    recentErrors: recentErrors.map(e => ({
      action: e.action,
      details: e.details ?? '',
      createdAt: e.createdAt.toISOString(),
    })),
    taskStats: {
      pending: pendingTasks,
      overdue: overdueTasks,
    },
    memoryCount,
    unreadNotifications: unreadNotifCount,
    timestamp: Date.now(),
  })
}
