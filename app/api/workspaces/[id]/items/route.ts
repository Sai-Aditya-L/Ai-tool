import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function getWorkspaceAccess(workspaceId: string, userId: string) {
  const workspace = await prisma.sharedWorkspace.findUnique({
    where: { id: workspaceId },
    include: { members: true },
  })
  if (!workspace) return { workspace: null, isOwner: false, isMember: false, memberRole: null }
  const isOwner = workspace.ownerId === userId
  const memberRecord = workspace.members.find((m) => m.userId === userId && m.status === 'active')
  const isMember = isOwner || !!memberRecord
  return { workspace, isOwner, isMember, memberRole: memberRecord?.role || (isOwner ? 'owner' : null) }
}

async function fetchEntityDetails(entityType: string, entityId: string, userId: string) {
  try {
    switch (entityType) {
      case 'task':
        return prisma.task.findFirst({ where: { id: entityId, userId }, select: { id: true, title: true, status: true, priority: true } })
      case 'note':
        return prisma.note.findFirst({ where: { id: entityId, userId }, select: { id: true, title: true, content: true } })
      case 'goal':
        return prisma.goal.findFirst({ where: { id: entityId, userId }, select: { id: true, title: true, status: true, progress: true } })
      case 'reminder':
        return prisma.reminder.findFirst({ where: { id: entityId, userId }, select: { id: true, title: true, status: true, dueAt: true } })
      case 'calendarEvent':
        return prisma.calendarEvent.findFirst({ where: { id: entityId, userId }, select: { id: true, title: true, startTime: true, endTime: true } })
      default:
        return null
    }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { workspace, isMember } = await getWorkspaceAccess(params.id, user.id)
  if (!workspace) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const items = await prisma.workspaceItem.findMany({
    where: { workspaceId: params.id },
    include: { addedBy: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const itemsWithDetails = await Promise.all(
    items.map(async (item) => {
      const entityDetails = await fetchEntityDetails(item.entityType, item.entityId, user.id)
      return { ...item, entityDetails }
    })
  )

  return NextResponse.json({ items: itemsWithDetails })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { workspace, isMember } = await getWorkspaceAccess(params.id, user.id)
  if (!workspace) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { entityType, entityId, note } = body

  if (!entityType || !entityId) {
    return NextResponse.json({ error: 'entityType and entityId are required' }, { status: 400 })
  }

  // Verify entity exists and belongs to this user
  const entity = await fetchEntityDetails(entityType, entityId, user.id)
  if (!entity) return NextResponse.json({ error: 'Entity not found' }, { status: 404 })

  const item = await prisma.workspaceItem.create({
    data: {
      workspaceId: params.id,
      entityType,
      entityId,
      addedById: user.id,
      note: note?.trim() || null,
    },
    include: { addedBy: { select: { name: true, email: true } } },
  })

  return NextResponse.json({ item: { ...item, entityDetails: entity } }, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { workspace, isOwner, memberRole } = await getWorkspaceAccess(params.id, user.id)
  if (!workspace) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const itemId = searchParams.get('itemId')
  if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 })

  const canRemove = isOwner || memberRole === 'owner' || memberRole === 'editor'
  if (!canRemove) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.workspaceItem.delete({ where: { id: itemId, workspaceId: params.id } })
  return NextResponse.json({ success: true })
}
