import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
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
    include: {
      logs: { orderBy: { createdAt: 'asc' } },
      agent: {
        select: {
          id: true,
          name: true,
          role: true,
          description: true,
          model: true,
          avatar: true,
          status: true,
        },
      },
    },
  })

  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })

  return NextResponse.json({ run })
}
