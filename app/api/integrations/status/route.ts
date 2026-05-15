import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const integrations = await prisma.integration.findMany({
    where: { userId: user.id },
    select: { provider: true, status: true, scope: true, metadata: true, createdAt: true, updatedAt: true },
  })

  const statusMap: Record<string, { status: string; metadata?: any; connectedAt?: string }> = {}
  for (const integration of integrations) {
    let metadata: any = null
    try { metadata = integration.metadata ? JSON.parse(integration.metadata) : null } catch {}
    statusMap[integration.provider] = {
      status: integration.status,
      metadata,
      connectedAt: integration.updatedAt.toISOString(),
    }
  }

  return NextResponse.json({ integrations: statusMap })
}
