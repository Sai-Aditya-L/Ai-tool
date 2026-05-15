import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const schema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(500),
  sendAt: z.string().datetime(),
  url: z.string().optional(),
  tag: z.string().optional(),
})

// Creates a DB notification that will be picked up by the cron webhook at the right time.
// The cron at /api/automations/run (GET) or a separate endpoint will flush due notifications.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  try {
    const body = await req.json()
    const data = schema.parse(body)

    const sendAt = new Date(data.sendAt)
    if (sendAt <= new Date()) {
      return NextResponse.json({ error: 'sendAt must be in the future' }, { status: 400 })
    }

    // Store as a Notification record with read=false; a background job will send it at the right time
    const notification = await prisma.notification.create({
      data: {
        userId: user.id,
        title: data.title,
        body: data.body,
        type: 'scheduled',
        read: false,
        link: data.url || '/notifications',
      },
    })

    // Also create a Reminder to act as the schedule anchor if sendAt is far in the future
    await prisma.reminder.create({
      data: {
        userId: user.id,
        title: `[Scheduled Push] ${data.title}`,
        description: JSON.stringify({ notificationId: notification.id, url: data.url, tag: data.tag }),
        dueAt: sendAt,
        status: 'pending',
        priority: 'medium',
      },
    })

    return NextResponse.json({ success: true, notification })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: err.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to schedule notification' }, { status: 500 })
  }
}

// GET: flush scheduled notifications that are due — called by cron
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  // Find reminders of type scheduled push that are due and not yet completed
  const dueReminders = await prisma.reminder.findMany({
    where: {
      status: 'pending',
      dueAt: { lte: now },
      title: { startsWith: '[Scheduled Push]' },
    },
    include: { user: { include: { pushSubscriptions: true } } },
    take: 50,
  })

  let sent = 0
  for (const reminder of dueReminders) {
    try {
      const meta = JSON.parse(reminder.description || '{}')
      const subs = reminder.user.pushSubscriptions

      if (subs.length > 0 && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
        const webpush = (await import('web-push')).default
        webpush.setVapidDetails('mailto:nexus@app.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY)

        const payload = JSON.stringify({
          title: reminder.title.replace('[Scheduled Push] ', ''),
          body: reminder.description ? 'Scheduled notification' : '',
          url: meta.url || '/notifications',
          tag: meta.tag || 'scheduled',
        })

        await Promise.allSettled(
          subs.map(sub =>
            webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
          )
        )
        sent++
      }

      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { status: 'completed', completedAt: now },
      })
    } catch {
      // continue to next
    }
  }

  return NextResponse.json({ flushed: sent, checked: dueReminders.length })
}
