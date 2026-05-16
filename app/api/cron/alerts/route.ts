import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { anthropic } from '@/lib/anthropic'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Vercel Cron: runs every 4 hours — checks all users for urgent alerts
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') ?? ''
    if (!crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const now = new Date()
  const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000)

  const users = await prisma.user.findMany({ select: { id: true } })
  let alertsCreated = 0

  for (const user of users) {
    try {
      const [overdue, urgent, soonReminders] = await Promise.all([
        prisma.task.findMany({
          where: { userId: user.id, status: { in: ['pending', 'in_progress'] }, dueDate: { lt: now } },
          select: { title: true, dueDate: true, priority: true },
          take: 5,
        }),
        prisma.task.findMany({
          where: { userId: user.id, priority: 'urgent', status: { not: 'completed' } },
          select: { title: true },
          take: 3,
        }),
        prisma.reminder.findMany({
          where: { userId: user.id, status: 'pending', dueAt: { gte: now, lte: in2h } },
          select: { title: true, dueAt: true },
          take: 3,
        }),
      ])

      if (overdue.length === 0 && urgent.length === 0 && soonReminders.length === 0) continue

      const context = [
        overdue.length > 0 ? `Overdue tasks: ${overdue.map(t => `"${t.title}" (${t.priority})`).join(', ')}` : null,
        urgent.length > 0 ? `Urgent tasks pending: ${urgent.map(t => `"${t.title}"`).join(', ')}` : null,
        soonReminders.length > 0 ? `Reminders in <2h: ${soonReminders.map(r => `"${r.title}" at ${new Date(r.dueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`).join(', ')}` : null,
      ].filter(Boolean).join('\n')

      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        system: 'Return JSON only: {"alerts": [{"title": "...", "message": "...", "priority": "high|critical"}]}. Max 2 alerts. Only include genuinely urgent items.',
        messages: [{ role: 'user', content: context }],
      })

      const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
      let parsed: { alerts: Array<{ title: string; message: string; priority: string }> }
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/)
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { alerts: [] }
      } catch {
        parsed = { alerts: [] }
      }

      for (const alert of (parsed.alerts || []).slice(0, 2)) {
        await prisma.notification.create({
          data: {
            userId: user.id,
            title: alert.title,
            body: `[${(alert.priority || 'HIGH').toUpperCase()}] ${alert.message}`,
            type: 'proactive_alert',
          },
        })
        alertsCreated++
      }
    } catch (err) {
      console.error(`Alert cron error for user ${user.id}:`, err)
    }
  }

  return NextResponse.json({ alertsCreated, usersChecked: users.length })
}
