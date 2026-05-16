import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { anthropic } from '@/lib/anthropic'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Vercel Cron: schedule daily at 6 AM UTC — add to vercel.json:
// { "crons": [{ "path": "/api/cron/morning-briefing", "schedule": "0 6 * * *" }] }

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') ?? ''
    if (!crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const today = new Date().toISOString().split('T')[0]
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

  const users = await prisma.user.findMany({ select: { id: true } })
  let generated = 0
  let skipped = 0
  const errors: string[] = []

  for (const user of users) {
    try {
      const existing = await prisma.dailySummary.findUnique({
        where: { userId_date: { userId: user.id, date: today } },
      })
      if (existing) { skipped++; continue }

      const [pendingTasks, todayReminders, habits, goals] = await Promise.all([
        prisma.task.findMany({
          where: { userId: user.id, status: { in: ['pending', 'in_progress'] } },
          orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
          take: 8,
          select: { title: true, priority: true, dueDate: true },
        }),
        prisma.reminder.findMany({
          where: { userId: user.id, status: 'pending', dueAt: { gte: startOfDay, lte: endOfDay } },
          orderBy: { dueAt: 'asc' },
          select: { title: true, dueAt: true },
        }),
        prisma.habit.findMany({
          where: { userId: user.id, status: 'active' },
          select: { title: true, frequency: true },
          take: 5,
        }),
        prisma.goal.findMany({
          where: { userId: user.id, status: 'active' },
          select: { title: true, progress: true, targetDate: true },
          take: 5,
        }),
      ])

      const prompt = `Morning briefing for ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.

Pending tasks (${pendingTasks.length}): ${pendingTasks.map(t => `"${t.title}" [${t.priority}]${t.dueDate ? ` due ${new Date(t.dueDate).toLocaleDateString()}` : ''}`).join(', ') || 'none'}

Today's reminders (${todayReminders.length}): ${todayReminders.map(r => `"${r.title}" at ${new Date(r.dueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`).join(', ') || 'none'}

Active habits: ${habits.map(h => h.title).join(', ') || 'none'}

Active goals: ${goals.map(g => `"${g.title}" (${g.progress}% complete)`).join(', ') || 'none'}`

      const aiResult = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: 'You are NEXUS, an AI personal OS. Generate a concise, energising morning briefing in 3-4 paragraphs with ## headers: ## Good Morning, ## Today\'s Focus, ## Quick Wins. Be specific about the user\'s data. End with one motivating sentence.',
        messages: [{ role: 'user', content: prompt }],
      })

      const content = (aiResult.content.find(b => b.type === 'text') as { type: 'text'; text: string } | undefined)?.text || 'Good morning. Your day is ready.'

      await prisma.dailySummary.create({
        data: { userId: user.id, date: today, content, type: 'daily' },
      })
      generated++
    } catch (err) {
      errors.push(user.id)
      console.error(`Briefing error for user ${user.id}:`, err)
    }
  }

  return NextResponse.json({ generated, skipped, errors: errors.length, total: users.length })
}
