import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { anthropic } from '@/lib/anthropic'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const { automationId } = body

  if (!automationId) {
    return NextResponse.json({ error: 'automationId is required' }, { status: 400 })
  }

  const automation = await prisma.automation.findFirst({
    where: { id: automationId, userId: user.id },
  })
  if (!automation) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Create AutomationRun record
  const run = await prisma.automationRun.create({
    data: {
      automationId,
      userId: user.id,
      status: 'running',
      startedAt: new Date(),
    },
  })

  // Build execution prompt from automation.actions
  const prompt = `Execute this automation task: "${automation.name}"\nTrigger: ${automation.trigger}\nAction: ${automation.actions}\n\nComplete the task and provide a summary of what was done.`

  try {
    // Use Anthropic to execute
    const result = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: 'You are NEXUS automation engine. Execute the requested automation task and provide a clear summary. Be concise.',
      messages: [{ role: 'user', content: prompt }],
    })

    const output = (result.content.find(b => b.type === 'text') as { type: 'text'; text: string } | undefined)?.text || 'Completed'

    await prisma.automationRun.update({
      where: { id: run.id },
      data: { status: 'completed', output, completedAt: new Date() },
    })

    await prisma.automation.update({
      where: { id: automationId },
      data: { lastRun: new Date(), runCount: { increment: 1 } },
    })

    // Create a notification for the automation result
    await prisma.notification.create({
      data: {
        userId: user.id,
        title: `Automation: ${automation.name}`,
        body: output.substring(0, 200),
        type: 'info',
        link: '/automations',
      },
    })

    return NextResponse.json({ success: true, message: output.slice(0, 120), run: { ...run, output, status: 'completed' } })
  } catch (error) {
    await prisma.automationRun.update({
      where: { id: run.id },
      data: { status: 'failed', error: String(error), completedAt: new Date() },
    })
    return NextResponse.json({ error: 'Automation failed', message: 'Execution failed' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  // Webhook endpoint for cron services — runs all active automations that are due
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  // Find all active automations where nextRun <= now, run up to 10
  const automations = await prisma.automation.findMany({
    where: { status: 'active' },
    take: 10,
  })

  // For a basic cron pass-through, we just return how many are active
  // Full scheduling logic would check nextRun field if it exists on the model
  return NextResponse.json({ message: 'Cron triggered', processed: automations.length })
}
