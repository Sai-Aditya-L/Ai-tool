import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { endpoint, p256dh, auth, deviceName, userAgent } = await req.json()

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const subscription = await prisma.pushSubscription.upsert({
    where: { userId_endpoint: { userId: user.id, endpoint } },
    update: {
      p256dh,
      auth,
      deviceName: deviceName || null,
      userAgent: userAgent || null,
    },
    create: {
      userId: user.id,
      endpoint,
      p256dh,
      auth,
      deviceName: deviceName || null,
      userAgent: userAgent || null,
    },
  })

  return NextResponse.json({ success: true, id: subscription.id })
}
