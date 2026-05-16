import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'

async function getWorkspaceAccess(workspaceId: string, userId: string) {
  const workspace = await prisma.sharedWorkspace.findUnique({
    where: { id: workspaceId },
    include: { members: true },
  })
  if (!workspace) return { workspace: null, isOwner: false, isMember: false }
  const isOwner = workspace.ownerId === userId
  const isMember = workspace.members.some((m) => m.userId === userId && m.status === 'active')
  return { workspace, isOwner, isMember }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { workspace, isOwner, isMember } = await getWorkspaceAccess(params.id, user.id)
  if (!workspace) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!isOwner && !isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: params.id },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({ members })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { workspace, isOwner } = await getWorkspaceAccess(params.id, user.id)
  if (!workspace) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { email, role } = body

  if (!email?.trim()) return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  const validRoles = ['editor', 'viewer', 'guest']
  if (!validRoles.includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })

  // Check if already a member
  const existing = await prisma.workspaceMember.findUnique({
    where: { workspaceId_email: { workspaceId: params.id, email: email.toLowerCase().trim() } },
  })
  if (existing) return NextResponse.json({ error: 'Already a member' }, { status: 409 })

  // Find user by email if they exist
  const invitedUser = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })

  const inviteToken = randomBytes(32).toString('hex')
  const member = await prisma.workspaceMember.create({
    data: {
      workspaceId: params.id,
      userId: invitedUser?.id || null,
      email: email.toLowerCase().trim(),
      role,
      status: 'pending',
      inviteToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })

  // Log activity
  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: 'workspace_invite_sent',
      entityType: 'workspace',
      entityId: params.id,
      details: `Invited ${email} as ${role} to workspace "${workspace.name}"`,
    },
  })

  const inviteUrl = `${process.env.NEXTAUTH_URL}/api/workspaces/invite/${member.inviteToken}`

  return NextResponse.json({ member, inviteUrl }, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { workspace, isOwner } = await getWorkspaceAccess(params.id, user.id)
  if (!workspace) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const memberId = searchParams.get('memberId')
  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })

  const body = await req.json()
  const { role } = body

  const validRoles = ['editor', 'viewer', 'guest']
  if (!validRoles.includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })

  const updated = await prisma.workspaceMember.update({
    where: { id: memberId, workspaceId: params.id },
    data: { role },
  })

  return NextResponse.json({ member: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { workspace, isOwner } = await getWorkspaceAccess(params.id, user.id)
  if (!workspace) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const memberId = searchParams.get('memberId')
  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })

  const member = await prisma.workspaceMember.findUnique({ where: { id: memberId } })
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  // Owner can remove anyone except themselves; member can remove themselves
  const isSelf = member.userId === user.id
  if (!isOwner && !isSelf) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (member.role === 'owner' && !isSelf) return NextResponse.json({ error: 'Cannot remove owner' }, { status: 400 })

  await prisma.workspaceMember.delete({ where: { id: memberId, workspaceId: params.id } })
  return NextResponse.json({ success: true })
}
