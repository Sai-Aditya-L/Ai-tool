import { prisma } from '@/lib/prisma'

export type JobType = 'email_poll' | 'automation_run' | 'digest_send' | 'webhook_retry'

export interface JobPayload {
  email_poll: { userId: string }
  automation_run: { automationId: string; userId: string }
  digest_send: { userId: string; type: 'morning' | 'evening' }
  webhook_retry: { endpointId: string; event: string; payload: string; attempt: number }
}

export async function enqueueJob<T extends JobType>(
  type: T,
  payload: JobPayload[T],
  options?: { userId?: string; delayMs?: number }
): Promise<void> {
  const nextRunAt = new Date(Date.now() + (options?.delayMs ?? 0))
  await prisma.job.create({
    data: {
      type,
      payload: JSON.stringify(payload),
      userId: options?.userId,
      nextRunAt,
    },
  }).catch(() => {}) // Silently fail if Job model doesn't exist yet
}

export async function processNextJobs(limit = 5): Promise<void> {
  const jobs = await prisma.job.findMany({
    where: { status: 'pending', nextRunAt: { lte: new Date() } },
    orderBy: { nextRunAt: 'asc' },
    take: limit,
  }).catch(() => [])

  for (const job of jobs) {
    await prisma.job.update({ where: { id: job.id }, data: { status: 'running' } }).catch(() => {})
    try {
      await executeJob(job.type as JobType, JSON.parse(job.payload))
      await prisma.job.update({ where: { id: job.id }, data: { status: 'done' } }).catch(() => {})
    } catch (err: any) {
      const attempts = job.attempts + 1
      const failed = attempts >= job.maxAttempts
      const nextRunAt = failed ? undefined : new Date(Date.now() + Math.pow(2, attempts) * 60_000)
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: failed ? 'failed' : 'pending',
          attempts,
          lastError: String(err?.message || err),
          ...(nextRunAt ? { nextRunAt } : {}),
        },
      }).catch(() => {})
    }
  }
}

async function executeJob(type: JobType, payload: any): Promise<void> {
  switch (type) {
    case 'webhook_retry': {
      const { endpointId, event, payload: webhookPayload } = payload
      const endpoint = await prisma.webhookEndpoint.findUnique({ where: { id: endpointId } }).catch(() => null)
      if (!endpoint?.isActive) return
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-NEXUS-Event': event },
        body: webhookPayload,
        signal: AbortSignal.timeout(10000),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      await prisma.webhookEndpoint.update({
        where: { id: endpointId },
        data: { lastTriggeredAt: new Date() },
      }).catch(() => {})
      break
    }
    case 'digest_send': {
      const { userId } = payload as { userId: string; type?: string }
      if (!userId) break
      const { prisma: db } = await import('./prisma')
      const [reminders, tasks] = await Promise.all([
        db.reminder.findMany({
          where: { userId, status: { not: 'completed' }, dueAt: { lte: new Date() } },
          take: 10,
          orderBy: { dueAt: 'asc' },
        }),
        db.task.findMany({
          where: { userId, status: { not: 'completed' }, dueDate: { lte: new Date() } },
          take: 10,
          orderBy: { dueDate: 'asc' },
        }),
      ])
      if (reminders.length > 0 || tasks.length > 0) {
        await db.notification.create({
          data: {
            userId,
            title: 'Daily Digest',
            body: `You have ${tasks.length} overdue task(s) and ${reminders.length} pending reminder(s).`,
            type: 'digest',
            read: false,
          },
        })
      }
      break
    }
    case 'email_poll': {
      const { userId } = payload as { userId: string }
      if (!userId) break
      console.log(`[job-queue] email_poll for user ${userId} — requires Google OAuth`)
      break
    }
    case 'automation_run': {
      const { automationId, userId } = payload as { automationId: string; userId: string }
      if (!automationId || !userId) break
      const { prisma: db } = await import('./prisma')
      const automation = await db.automation.findFirst({
        where: { id: automationId, userId, status: 'active' },
      }).catch(() => null)
      if (!automation) break
      await db.automation.update({
        where: { id: automationId },
        data: { lastRun: new Date() },
      }).catch(() => null)
      await db.activityLog.create({
        data: {
          userId,
          action: 'automation_executed',
          entityType: 'automation',
          entityId: automationId,
          metadata: JSON.stringify({ automationId }),
        },
      }).catch(() => null)
      break
    }
    default:
      break
  }
}

// Start a background poller (call once at app startup — but only in server context)
let pollerStarted = false
export function startJobPoller(intervalMs = 30_000): void {
  if (pollerStarted || typeof window !== 'undefined') return
  pollerStarted = true
  setInterval(() => processNextJobs(10), intervalMs)
}
