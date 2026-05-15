import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pendingActions } from '../../route'

// ─── GET — Get pending action details ────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { actionId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { actionId } = params
  const pending = pendingActions.get(actionId)

  if (!pending) {
    return NextResponse.json({ error: 'Pending action not found' }, { status: 404 })
  }

  if (pending.userId !== user.id) {
    return NextResponse.json({ error: 'Unauthorized — action belongs to another user' }, { status: 403 })
  }

  return NextResponse.json({
    actionId,
    action: pending.action,
    params: pending.params,
    description: pending.description,
    createdAt: pending.createdAt,
  })
}

// ─── POST — Approve and execute a pending action ──────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { actionId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { actionId } = params

  let body: { approve: boolean } = { approve: true }
  try {
    body = await req.json()
  } catch {
    // default to approve=true if no body
  }

  const pending = pendingActions.get(actionId)

  if (!pending) {
    return NextResponse.json({ error: 'Pending action not found or already processed' }, { status: 404 })
  }

  if (pending.userId !== user.id) {
    return NextResponse.json({ error: 'Unauthorized — action belongs to another user' }, { status: 403 })
  }

  // Remove from pending map
  pendingActions.delete(actionId)

  // Rejected
  if (!body.approve) {
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'COMPUTER_CONTROL',
        entityType: 'rejected',
        details: JSON.stringify({
          actionId,
          action: pending.action,
          description: pending.description,
          rejectedAt: new Date().toISOString(),
        }),
      },
    })
    return NextResponse.json({
      result: `Action "${pending.action}" was rejected by the user.`,
      approved: false,
      actionId,
    })
  }

  // Approved — execute the action
  const actionParams = pending.params as Record<string, unknown>

  // Import execution functions inline to avoid circular dependency issues
  const { executeApprovedAction } = await import('./executor')

  const result = await executeApprovedAction(pending.action, actionParams)

  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: 'COMPUTER_CONTROL',
      entityType: 'approved_executed',
      details: JSON.stringify({
        actionId,
        action: pending.action,
        description: pending.description,
        result,
        approvedAt: new Date().toISOString(),
      }),
    },
  })

  return NextResponse.json({
    result: JSON.stringify(result),
    approved: true,
    actionId,
    action: pending.action,
    description: pending.description,
  })
}

// ─── DELETE — Reject a pending action ────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: { actionId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { actionId } = params
  const pending = pendingActions.get(actionId)

  if (!pending) {
    return NextResponse.json({ error: 'Pending action not found' }, { status: 404 })
  }

  if (pending.userId !== user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  pendingActions.delete(actionId)

  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: 'COMPUTER_CONTROL',
      entityType: 'rejected',
      details: JSON.stringify({
        actionId,
        action: pending.action,
        description: pending.description,
        rejectedAt: new Date().toISOString(),
      }),
    },
  })

  return NextResponse.json({ rejected: true, actionId })
}
