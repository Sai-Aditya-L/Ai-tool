import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  await prisma.integration.updateMany({
    where: { userId: user.id, provider: 'google' },
    data: { status: 'disconnected', accessToken: null, refreshToken: null },
  })

  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: 'INTEGRATION_DISCONNECTED',
      details: 'Disconnected Google account',
    },
  })

  return NextResponse.json({ success: true })
}
