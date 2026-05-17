import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return new Response('Unauthorized', { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
  if (!user) return new Response('Unauthorized', { status: 401 })

  const userId = user.id
  const enc = new TextEncoder()
  const sse = (data: object) => enc.encode(`data: ${JSON.stringify(data)}\n\n`)
  const comment = enc.encode(`: heartbeat\n\n`)

  let lastNotifId: string | null = null
  let lastAgentRunId: string | null = null
  let closed = false

  const stream = new ReadableStream({
    async start(controller) {
      // Seed IDs so first poll doesn't re-emit existing records
      const [seedNotif, seedRun] = await Promise.all([
        prisma.notification.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { id: true } }),
        prisma.agentRun.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { id: true } }),
      ])
      lastNotifId = seedNotif?.id ?? null
      lastAgentRunId = seedRun?.id ?? null

      // Send initial state
      const [unreadCount, activeRun, activeFocus] = await Promise.all([
        prisma.notification.count({ where: { userId, read: false } }),
        prisma.agentRun.findFirst({
          where: { userId, status: { in: ['running', 'waiting'] } },
          orderBy: { createdAt: 'desc' },
          select: { id: true, status: true, task: true },
        }),
        prisma.focusSession.findFirst({
          where: { userId, completed: false, createdAt: { gte: new Date(Date.now() - 3 * 60 * 60 * 1000) } },
          orderBy: { createdAt: 'desc' },
          select: { id: true, taskTitle: true, plannedMins: true, createdAt: true, type: true },
        }),
      ])
      controller.enqueue(sse({ type: 'init', unreadCount, activeRun, activeFocus }))

      const poll = setInterval(async () => {
        if (closed) { clearInterval(poll); return }
        try {
          // New notifications
          const latestNotif = await prisma.notification.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            select: { id: true, title: true, body: true, type: true, read: true, link: true, createdAt: true },
          })
          if (latestNotif && latestNotif.id !== lastNotifId) {
            lastNotifId = latestNotif.id
            const unreadCount = await prisma.notification.count({ where: { userId, read: false } })
            controller.enqueue(sse({ type: 'notification', notification: latestNotif, unreadCount }))
          }

          // Agent run status changes
          const latestRun = await prisma.agentRun.findFirst({
            where: { userId },
            orderBy: { updatedAt: 'desc' },
            select: { id: true, status: true, task: true, output: true, updatedAt: true },
          })
          if (latestRun && latestRun.id !== lastAgentRunId) {
            lastAgentRunId = latestRun.id
            controller.enqueue(sse({ type: 'agent_run', run: latestRun }))
          } else if (latestRun && (latestRun.status === 'running' || latestRun.status === 'waiting')) {
            // Keep sending active run status so UI stays updated
            controller.enqueue(sse({ type: 'agent_status', run: latestRun }))
          }

          // Heartbeat
          controller.enqueue(comment)
        } catch {
          clearInterval(poll)
          try { controller.close() } catch {}
        }
      }, 4000)

      req.signal.addEventListener('abort', () => {
        closed = true
        clearInterval(poll)
        try { controller.close() } catch {}
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
