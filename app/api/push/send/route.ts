import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import webpush from 'web-push'

export async function POST(req: NextRequest) {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      'mailto:nexus@app.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    )
  }
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { title, body, url, tag, userId } = await req.json()

  if (!title || !body) {
    return NextResponse.json({ error: 'title and body are required' }, { status: 400 })
  }

  // Only allow sending to self
  const targetUserId = userId && userId === user.id ? userId : user.id

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: targetUserId },
  })

  if (subscriptions.length === 0) {
    return NextResponse.json({ success: true, sent: 0, message: 'No subscriptions found' })
  }

  const payload = JSON.stringify({ title, body, url: url || '/dashboard', tag: tag || 'nexus-notification' })
  const expiredIds: string[] = []

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
        return { id: sub.id, success: true }
      } catch (err: any) {
        if (err.statusCode === 410) {
          expiredIds.push(sub.id)
        }
        return { id: sub.id, success: false }
      }
    })
  )

  if (expiredIds.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: expiredIds } } })
  }

  const sent = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length
  const failed = results.filter(r => r.status === 'fulfilled' && !(r.value as any).success).length

  return NextResponse.json({ success: true, sent, failed })
}
