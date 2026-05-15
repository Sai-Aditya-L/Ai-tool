import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).optional(),
  systemPrompt: z.string().max(10000).optional(),
  model: z.string().max(100).optional(),
  tools: z.string().optional(),
  avatar: z.string().max(100).optional(),
  status: z.enum(['idle', 'running', 'error']).optional(),
})

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
    const data = patchSchema.parse(body)

    const agent = await prisma.agent.update({
      where: { id: params.id },
      data,
    })

    return NextResponse.json({ agent })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
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
