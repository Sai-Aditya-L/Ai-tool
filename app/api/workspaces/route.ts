import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const owned = await prisma.sharedWorkspace.findMany({
    where: { ownerId: user.id },
    include: { members: true, _count: { select: { items: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const memberOf = await prisma.workspaceMember.findMany({
    where: { userId: user.id, status: 'active' },
    include: {
      workspace: {
        include: { members: true, _count: { select: { items: true } } },
      },
    },
  })

  const ownedWithFlag = owned.map((w) => ({ ...w, isOwner: true }))
  const memberWithFlag = memberOf
    .filter((m) => m.workspace.ownerId !== user.id)
    .map((m) => ({ ...m.workspace, isOwner: false, memberRole: m.role }))

  return NextResponse.json({ workspaces: [...ownedWithFlag, ...memberWithFlag] })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json()
  const { name, description, type, color, emoji } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const workspace = await prisma.sharedWorkspace.create({
    data: {
      ownerId: user.id,
      name: name.trim(),
      description: description?.trim() || null,
      type: type || 'personal',
      color: color || '#00d4ff',
      emoji: emoji || '🏠',
    },
  })

  // Auto-create owner member record
  await prisma.workspaceMember.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      email: user.email,
      role: 'owner',
      status: 'active',
      joinedAt: new Date(),
    },
  })

  const full = await prisma.sharedWorkspace.findUnique({
    where: { id: workspace.id },
    include: { members: true, _count: { select: { items: true } } },
  })

  return NextResponse.json({ workspace: { ...full, isOwner: true } }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 })

  const workspace = await prisma.sharedWorkspace.findUnique({ where: { id } })
  if (!workspace) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (workspace.ownerId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.sharedWorkspace.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 })

  const workspace = await prisma.sharedWorkspace.findUnique({ where: { id } })
  if (!workspace) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (workspace.ownerId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { name, description, color, emoji, type } = body

  const updated = await prisma.sharedWorkspace.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(color !== undefined && { color }),
      ...(emoji !== undefined && { emoji }),
      ...(type !== undefined && { type }),
    },
    include: { members: true, _count: { select: { items: true } } },
  })

  return NextResponse.json({ workspace: { ...updated, isOwner: true } })
}
