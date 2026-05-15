import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; runId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Verify the agent belongs to this user
  const agent = await prisma.agent.findFirst({ where: { id: params.id, userId: user.id } })
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

  const run = await prisma.agentRun.findFirst({
    where: { id: params.runId, agentId: params.id, userId: user.id },
  })

  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })

  if (run.status !== 'needs_approval') {
    return NextResponse.json(
      { error: `Run is not awaiting approval (current status: ${run.status})` },
      { status: 409 }
    )
  }

  const body = await req.json()
  const { approved, note } = body

  if (typeof approved !== 'boolean') {
    return NextResponse.json({ error: 'approved (boolean) is required' }, { status: 400 })
  }

  if (approved) {
    // Mark back to running, add approval log, then finalize as completed
    // (Full loop resumption would require persisting conversation state;
    //  for now we mark completed with a note so the user can re-run if needed.)
    await prisma.agentLog.create({
      data: {
        runId: run.id,
        type: 'info',
        content: `Action approved by user${note ? `: ${note}` : ''}. To execute the approved action, please re-run the agent task.`,
      },
    })

    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        output:
          (run.output ? run.output + '\n\n' : '') +
          `[User approved the pending action${note ? ` with note: "${note}"` : ''}. ` +
          `Re-run this task to execute the approved action.]`,
      },
    })

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'AGENT_ACTION_APPROVED',
        entityType: 'agentRun',
        entityId: run.id,
        details: `User approved pending action for agent run ${run.id}${note ? `: ${note}` : ''}`,
      },
    })
  } else {
    // Rejected — cancel the run
    await prisma.agentLog.create({
      data: {
        runId: run.id,
        type: 'info',
        content: `Action rejected by user${note ? `: ${note}` : ''}. Run cancelled.`,
      },
    })

    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: 'cancelled',
        completedAt: new Date(),
        error: `Cancelled by user${note ? `: ${note}` : ''}`,
      },
    })

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'AGENT_ACTION_REJECTED',
        entityType: 'agentRun',
        entityId: run.id,
        details: `User rejected pending action for agent run ${run.id}${note ? `: ${note}` : ''}`,
      },
    })
  }

  const updatedRun = await prisma.agentRun.findUnique({
    where: { id: run.id },
    include: { logs: { orderBy: { createdAt: 'asc' } } },
  })

  return NextResponse.json({ run: updatedRun })
}
