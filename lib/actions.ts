'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { prisma } from './prisma'
import { revalidatePath } from 'next/cache'

export async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { preferences: true },
  })
  return user
}

export async function logActivity(
  userId: string,
  action: string,
  entityType?: string,
  entityId?: string,
  details?: string
) {
  await prisma.activityLog.create({
    data: {
      userId,
      action,
      entityType,
      entityId,
      details,
    },
  })
}

export async function getDashboardData(userId: string) {
  const [pendingTasks, todayReminders, activeAutomations, connectedIntegrations, recentActivity] = await Promise.all([
    prisma.task.count({ where: { userId, status: { in: ['pending', 'in_progress'] } } }),
    prisma.reminder.count({
      where: {
        userId,
        status: 'pending',
        dueAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lte: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      },
    }),
    prisma.automation.count({ where: { userId, status: 'active' } }),
    prisma.integration.count({ where: { userId, status: 'connected' } }),
    prisma.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ])

  return {
    pendingTasks,
    todayReminders,
    activeAutomations,
    connectedIntegrations,
    recentActivity,
  }
}
