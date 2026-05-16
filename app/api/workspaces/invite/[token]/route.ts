import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const member = await prisma.workspaceMember.findUnique({
    where: { inviteToken: params.token },
    include: {
      workspace: {
        include: { owner: { select: { name: true, email: true } } },
      },
    },
  })

  if (!member) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  if (member.status === 'revoked') return NextResponse.json({ error: 'Invite has been revoked' }, { status: 410 })

  if (member.expiresAt && new Date() > member.expiresAt) {
    return NextResponse.json({ error: 'Invite has expired' }, { status: 410 })
  }

  return NextResponse.json({
    workspace: member.workspace.name,
    workspaceEmoji: member.workspace.emoji,
    workspaceColor: member.workspace.color,
    workspaceType: member.workspace.type,
    invitedBy: member.workspace.owner.name || member.workspace.owner.email,
    role: member.role,
    status: member.status,
    email: member.email,
  })
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const member = await prisma.workspaceMember.findUnique({
    where: { inviteToken: params.token },
    include: { workspace: true },
  })

  if (!member) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  if (member.status === 'revoked') return NextResponse.json({ error: 'Invite has been revoked' }, { status: 410 })
  if (member.status === 'active') return NextResponse.json({ error: 'Invite already accepted' }, { status: 409 })

  if (member.expiresAt && new Date() > member.expiresAt) {
    return NextResponse.json({ error: 'Invite has expired' }, { status: 410 })
  }

  const updated = await prisma.workspaceMember.update({
    where: { inviteToken: params.token },
    data: {
      status: 'active',
      userId: user.id,
      joinedAt: new Date(),
    },
  })

  return NextResponse.json({ success: true, member: updated, workspaceId: member.workspaceId })
}
