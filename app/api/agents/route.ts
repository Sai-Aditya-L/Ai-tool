import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const agents = await prisma.agent.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: { select: { runs: true } },
    },
  })

  return NextResponse.json({ agents })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  try {
    const body = await req.json()
    const { name, role, description, systemPrompt, model, tools, avatar } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    if (!role || typeof role !== 'string' || role.trim().length === 0) {
      return NextResponse.json({ error: 'role is required' }, { status: 400 })
    }

    const agent = await prisma.agent.create({
      data: {
        userId: user.id,
        name: name.trim(),
        role: role.trim(),
        description: description || null,
        systemPrompt: systemPrompt || null,
        model: model || 'claude-sonnet-4-6',
        tools: tools || null,
        avatar: avatar || null,
      },
    })

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'AGENT_CREATED',
        entityType: 'agent',
        entityId: agent.id,
        details: `Created agent: ${agent.name} (${agent.role})`,
      },
    })

    return NextResponse.json({ agent }, { status: 201 })
  } catch (error) {
    console.error('POST /api/agents error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
