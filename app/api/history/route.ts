import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const userId = user.id
  const { searchParams } = new URL(req.url)
  const entityType = searchParams.get('entityType')
  const entityId = searchParams.get('entityId')
  const offset = parseInt(searchParams.get('offset') || '0')

  // Specific entity history
  if (entityType && entityId) {
    const logs = await prisma.activityLog.findMany({
      where: { userId, entityType, entityId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return NextResponse.json({ logs })
  }

  // General recent activity (last 200, with optional offset for "load more")
  const logs = await prisma.activityLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 200,
    skip: offset,
  })

  return NextResponse.json({ logs, offset })
}
