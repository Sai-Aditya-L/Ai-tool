import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Stop all running/pending agent runs
  const stoppedAgents = await prisma.agentRun.updateMany({
    where: { userId: user.id, status: { in: ['pending', 'running', 'needs_approval'] } },
    data: { status: 'cancelled', completedAt: new Date(), error: 'Emergency stop triggered by user' },
  })

  // Pause all active automations
  const pausedAutomations = await prisma.automation.updateMany({
    where: { userId: user.id, status: 'active' },
    data: { status: 'paused' },
  })

  // Log the event
  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: 'EMERGENCY_STOP',
      entityType: 'system',
      details: `Stopped ${stoppedAgents.count} agent runs, paused ${pausedAutomations.count} automations`,
    },
  })

  return NextResponse.json({
    success: true,
    stopped: { agentRuns: stoppedAgents.count, automations: pausedAutomations.count },
    message: 'Emergency stop executed. All agents stopped, all automations paused.',
  })
}
