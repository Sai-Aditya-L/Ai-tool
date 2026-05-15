import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const agent = await prisma.agent.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      runs: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          _count: { select: { logs: true } },
        },
      },
    },
  })

  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

  return NextResponse.json({ agent })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const existing = await prisma.agent.findFirst({ where: { id: params.id, userId: user.id } })
  if (!existing) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

  try {
    const body = await req.json()
    const { name, role, description, systemPrompt, model, tools, avatar, status } = body

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (role !== undefined) updateData.role = role
    if (description !== undefined) updateData.description = description
    if (systemPrompt !== undefined) updateData.systemPrompt = systemPrompt
    if (model !== undefined) updateData.model = model
    if (tools !== undefined) updateData.tools = tools
    if (avatar !== undefined) updateData.avatar = avatar
    if (status !== undefined) updateData.status = status

    const agent = await prisma.agent.update({
      where: { id: params.id },
      data: updateData,
    })

    return NextResponse.json({ agent })
  } catch (error) {
    console.error('PATCH /api/agents/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const existing = await prisma.agent.findFirst({ where: { id: params.id, userId: user.id } })
  if (!existing) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

  // Cascade: delete logs first, then runs, then agent
  const runs = await prisma.agentRun.findMany({ where: { agentId: params.id }, select: { id: true } })
  const runIds = runs.map(r => r.id)

  if (runIds.length > 0) {
    await prisma.agentLog.deleteMany({ where: { runId: { in: runIds } } })
    await prisma.agentRun.deleteMany({ where: { agentId: params.id } })
  }

  await prisma.agent.delete({ where: { id: params.id } })

  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: 'AGENT_DELETED',
      entityType: 'agent',
      entityId: params.id,
      details: `Deleted agent: ${existing.name}`,
    },
  })

  return NextResponse.json({ success: true })
}
