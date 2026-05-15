import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NEXUS_SYSTEM_PROMPT, NEXUS_TOOLS } from '@/lib/anthropic'
import { createMessage, buildToolResultMessages, AIProvider } from '@/lib/ai-provider'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

// ---------------------------------------------------------------------------
// Role-specific system prompt builder
// ---------------------------------------------------------------------------
function buildSystemPrompt(agent: { name: string; role: string; systemPrompt: string | null }): string {
  if (agent.systemPrompt) return agent.systemPrompt

  const suffix = 'Complete the assigned task efficiently and report your findings.'

  const rolePrompts: Record<string, string> = {
    'Travel Agent': `You are Atlas, a specialized travel planning agent. You help users plan trips, find the best routes, accommodations, and activities. You have deep knowledge of travel logistics, visa requirements, and cultural nuances. ${suffix}`,
    'Coding Agent': `You are Forge, a specialized software development agent. You write clean, efficient code, debug issues, review pull requests, and architect solutions. You are proficient in multiple programming languages and frameworks. ${suffix}`,
    'Calendar Agent': `You are Chronos, a specialized scheduling agent. You manage calendars, schedule meetings, detect conflicts, and optimize the user's time. You are meticulous about time zones and availability. ${suffix}`,
    'Research Agent': `You are Oracle, a specialized research and information agent. You gather, synthesize, and analyze information from multiple sources to deliver comprehensive, accurate insights. ${suffix}`,
    'Finance Agent': `You are Ledger, a specialized financial tracking agent. You track expenses, analyze spending patterns, monitor budgets, and provide actionable financial insights. ${suffix}`,
    'Communication Agent': `You are Hermes, a specialized communication agent. You draft emails, compose messages, summarize correspondence, and help maintain clear and professional communication. ${suffix}`,
    'Security Agent': `You are Sentinel, a specialized security monitoring agent. You identify risks, review permissions, flag suspicious activity, and recommend security best practices. ${suffix}`,
    'Memory Agent': `You are Echo, a specialized memory and knowledge agent. You store, recall, and organize information about the user's preferences, goals, and context to provide personalized assistance. ${suffix}`,
    'Automation Agent': `You are Titan, a specialized workflow automation agent. You design, execute, and optimize automated workflows to save the user time and reduce repetitive tasks. ${suffix}`,
  }

  return rolePrompts[agent.role] ??
    `You are ${agent.name}, a specialized AI agent with role: ${agent.role}. You are focused, efficient, and always act in the user's best interest. ${suffix}`
}

// ---------------------------------------------------------------------------
// Lightweight tool executor (essential tools for agent runs)
// ---------------------------------------------------------------------------
async function executeAgentTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  userId: string
): Promise<string> {
  try {
    switch (toolName) {
      case 'get_tasks': {
        const tasks = await prisma.task.findMany({
          where: {
            userId,
            ...(toolInput.status ? { status: toolInput.status as string } : {}),
            ...(toolInput.priority ? { priority: toolInput.priority as string } : {}),
          },
          include: { subtasks: true },
          orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
          take: toolInput.limit ? parseInt(toolInput.limit as string) : 20,
        })
        return JSON.stringify({
          tasks: tasks.map(t => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            dueDate: t.dueDate,
            subtasksCount: t.subtasks.length,
          })),
        })
      }

      case 'create_task': {
        const task = await prisma.task.create({
          data: {
            userId,
            title: toolInput.title as string,
            description: toolInput.description as string | undefined,
            priority: (toolInput.priority as string) || 'medium',
            dueDate: toolInput.dueDate ? new Date(toolInput.dueDate as string) : null,
            tags: toolInput.tags as string | undefined,
          },
        })
        await prisma.activityLog.create({
          data: {
            userId,
            action: 'TASK_CREATED',
            entityType: 'task',
            entityId: task.id,
            details: `Agent created task: ${task.title}`,
          },
        })
        return JSON.stringify({ success: true, task: { id: task.id, title: task.title, priority: task.priority, dueDate: task.dueDate } })
      }

      case 'get_reminders': {
        const reminders = await prisma.reminder.findMany({
          where: {
            userId,
            status: (toolInput.status as string) || 'pending',
          },
          orderBy: { dueAt: 'asc' },
          take: toolInput.limit ? parseInt(toolInput.limit as string) : 10,
        })
        return JSON.stringify({
          reminders: reminders.map(r => ({
            id: r.id,
            title: r.title,
            dueAt: r.dueAt,
            priority: r.priority,
            status: r.status,
          })),
        })
      }

      case 'create_reminder': {
        const reminder = await prisma.reminder.create({
          data: {
            userId,
            title: toolInput.title as string,
            description: toolInput.description as string | undefined,
            dueAt: new Date(toolInput.dueAt as string),
            priority: (toolInput.priority as string) || 'medium',
          },
        })
        await prisma.activityLog.create({
          data: {
            userId,
            action: 'REMINDER_CREATED',
            entityType: 'reminder',
            entityId: reminder.id,
            details: `Agent created reminder: ${reminder.title}`,
          },
        })
        return JSON.stringify({ success: true, reminder: { id: reminder.id, title: reminder.title, dueAt: reminder.dueAt } })
      }

      case 'search_notes': {
        const notes = await prisma.note.findMany({
          where: {
            userId,
            OR: [
              { title: { contains: toolInput.query as string } },
              { content: { contains: toolInput.query as string } },
              { tags: { contains: toolInput.query as string } },
            ],
          },
          take: 5,
        })
        return JSON.stringify({
          notes: notes.map(n => ({
            id: n.id,
            title: n.title,
            content: n.content.substring(0, 200),
            tags: n.tags,
          })),
        })
      }

      case 'get_memory': {
        const memories = await prisma.memory.findMany({
          where: {
            userId,
            ...(toolInput.category ? { category: toolInput.category as string } : {}),
          },
          orderBy: { updatedAt: 'desc' },
        })
        return JSON.stringify({
          memories: memories.map(m => ({
            id: m.id,
            category: m.category,
            key: m.key,
            value: m.value,
          })),
        })
      }

      case 'save_memory': {
        const memory = await prisma.memory.upsert({
          where: { userId_key: { userId, key: toolInput.key as string } },
          update: { value: toolInput.value as string, category: toolInput.category as string },
          create: {
            userId,
            category: toolInput.category as string,
            key: toolInput.key as string,
            value: toolInput.value as string,
            source: 'agent',
          },
        })
        return JSON.stringify({ success: true, memory: { id: memory.id, key: memory.key, category: memory.category } })
      }

      case 'summarize_day': {
        const today = new Date()
        const startOfDay = new Date(today.setHours(0, 0, 0, 0))
        const endOfDay = new Date(today.setHours(23, 59, 59, 999))
        const [pendingTasks, todayReminders, recentActivity, upcomingReminders] = await Promise.all([
          prisma.task.findMany({
            where: { userId, status: { in: ['pending', 'in_progress'] } },
            orderBy: [{ priority: 'desc' }],
            take: 10,
          }),
          prisma.reminder.findMany({
            where: { userId, dueAt: { gte: startOfDay, lte: endOfDay } },
            orderBy: { dueAt: 'asc' },
          }),
          prisma.activityLog.findMany({
            where: { userId, createdAt: { gte: startOfDay } },
            orderBy: { createdAt: 'desc' },
            take: 10,
          }),
          prisma.reminder.findMany({
            where: { userId, status: 'pending', dueAt: { gte: new Date() } },
            orderBy: { dueAt: 'asc' },
            take: 5,
          }),
        ])
        return JSON.stringify({
          date: new Date().toLocaleDateString(),
          pendingTasks: pendingTasks.map(t => ({ title: t.title, priority: t.priority, dueDate: t.dueDate })),
          todayReminders: todayReminders.map(r => ({ title: r.title, dueAt: r.dueAt, priority: r.priority })),
          upcomingReminders: upcomingReminders.map(r => ({ title: r.title, dueAt: r.dueAt })),
          activityToday: recentActivity.length,
          summary: {
            tasksCount: pendingTasks.length,
            remindersToday: todayReminders.length,
            urgentTasks: pendingTasks.filter(t => t.priority === 'urgent').length,
          },
        })
      }

      case 'get_dashboard_summary': {
        const [pendingTasks, reminders, recentActivity, memories] = await Promise.all([
          prisma.task.count({ where: { userId, status: { in: ['pending', 'in_progress'] } } }),
          prisma.reminder.count({ where: { userId, status: 'pending' } }),
          prisma.activityLog.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 5,
          }),
          prisma.memory.count({ where: { userId } }),
        ])
        return JSON.stringify({
          pendingTasks,
          pendingReminders: reminders,
          memoriesStored: memories,
          recentActivity: recentActivity.map(a => ({ action: a.action, details: a.details, time: a.createdAt })),
        })
      }

      // Sensitive tool — handled above in agentic loop; this fallback should not be reached
      case 'draft_email':
        return JSON.stringify({ error: 'draft_email requires user approval' })

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` })
    }
  } catch (error) {
    console.error(`Agent tool execution error (${toolName}):`, error)
    return JSON.stringify({ error: 'Tool execution failed', tool: toolName })
  }
}

// Sensitive tool names that require human approval before execution
const SENSITIVE_TOOLS = new Set(['draft_email'])

function isDeleteOperation(toolName: string): boolean {
  return toolName.toLowerCase().includes('delete') || toolName.toLowerCase().includes('remove')
}

// ---------------------------------------------------------------------------
// GET — list runs for an agent
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const agent = await prisma.agent.findFirst({ where: { id: params.id, userId: user.id } })
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

  const runs = await prisma.agentRun.findMany({
    where: { agentId: params.id, userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      _count: { select: { logs: true } },
    },
  })

  return NextResponse.json({ runs })
}

// ---------------------------------------------------------------------------
// POST — start a new agent run (execution engine)
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const rl = rateLimit(`agents:${user.id}`, 10, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const agent = await prisma.agent.findFirst({ where: { id: params.id, userId: user.id } })
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

  const body = await req.json()
  const { task } = body

  if (!task || typeof task !== 'string' || task.trim().length === 0) {
    return NextResponse.json({ error: 'task is required' }, { status: 400 })
  }

  // 1. Create AgentRun with status "running"
  const run = await prisma.agentRun.create({
    data: {
      agentId: agent.id,
      userId: user.id,
      task: task.trim(),
      status: 'running',
      startedAt: new Date(),
    },
  })

  // Helper: create a log entry for this run
  async function log(type: string, content: string, metadata?: Record<string, unknown>) {
    await prisma.agentLog.create({
      data: {
        runId: run.id,
        type,
        content,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    })
  }

  try {
    await log('info', `Agent ${agent.name} starting task: ${task.trim()}`)

    // 2. Build system prompt
    const agentSystemPrompt = buildSystemPrompt(agent as { name: string; role: string; systemPrompt: string | null })
    const builtSystemPrompt = `${NEXUS_SYSTEM_PROMPT}\n\n---\n\nAgent Identity:\n${agentSystemPrompt}\n\nTask: ${task.trim()}`

    // 3. Resolve provider and model from user preferences
    const prefs = await prisma.userPreferences.findUnique({ where: { userId: user.id } })
    const provider = (prefs?.aiProvider || 'anthropic') as AIProvider
    const agentModel = provider === 'openai'
      ? (prefs?.openaiModel || 'gpt-4o')
      : ((agent.model || prefs?.aiModel || 'claude-sonnet-4-6') as string)

    // 4. Initial API call via unified abstraction
    const agentMessages: (MessageParam | ChatCompletionMessageParam)[] = [
      { role: 'user', content: task.trim() },
    ]

    let response = await createMessage({
      provider,
      model: agentModel,
      system: builtSystemPrompt,
      tools: NEXUS_TOOLS,
      messages: agentMessages,
    })

    // 5. Agentic loop (max 5 iterations)
    const toolsUsed: string[] = []
    let iterations = 0
    const maxIterations = 5

    while (response.stopReason === 'tool_use' && iterations < maxIterations) {
      iterations++

      // Check for sensitive tools BEFORE executing any of them
      for (const toolCall of response.toolCalls) {
        if (SENSITIVE_TOOLS.has(toolCall.name) || isDeleteOperation(toolCall.name)) {
          await log('tool_use', JSON.stringify({ tool: toolCall.name, input: toolCall.input }))
          await log('approval_needed', `Action requires user approval: ${toolCall.name}`)

          await prisma.agentRun.update({
            where: { id: run.id },
            data: {
              status: 'needs_approval',
              metadata: JSON.stringify({
                pendingTool: toolCall.name,
                pendingInput: toolCall.input,
                pendingToolUseId: toolCall.id,
                iterationsCompleted: iterations,
                toolsUsed,
              }),
              toolsUsed: JSON.stringify(toolsUsed),
            },
          })

          const updatedRun = await prisma.agentRun.findUnique({
            where: { id: run.id },
            include: { logs: { orderBy: { createdAt: 'asc' } } },
          })
          return NextResponse.json({ run: updatedRun }, { status: 202 })
        }
      }

      // Execute all tool calls in this iteration
      const results: { id: string; content: string }[] = []

      for (const toolCall of response.toolCalls) {
        await log('tool_use', JSON.stringify({ tool: toolCall.name, input: toolCall.input }))

        const result = await executeAgentTool(toolCall.name, toolCall.input, user.id)
        toolsUsed.push(toolCall.name)

        await log('tool_result', result.substring(0, 500))
        results.push({ id: toolCall.id, content: result })
      }

      const toolResultMessages = buildToolResultMessages(provider, response.toolCalls, results)

      // Append assistant message + tool results to conversation and continue
      agentMessages.push(response.assistantMessage)
      agentMessages.push(...toolResultMessages)

      response = await createMessage({
        provider,
        model: agentModel,
        system: builtSystemPrompt,
        tools: NEXUS_TOOLS,
        messages: agentMessages,
      })
    }

    // 6. Extract final text output
    const finalOutput = response.text || 'Task completed.'

    await log('output', finalOutput)

    // 6. Mark run as completed
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: 'completed',
        output: finalOutput,
        completedAt: new Date(),
        toolsUsed: JSON.stringify(toolsUsed),
      },
    })

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'AGENT_RUN_COMPLETED',
        entityType: 'agentRun',
        entityId: run.id,
        details: `Agent ${agent.name} completed task. Tools used: ${toolsUsed.join(', ') || 'none'}`,
      },
    })

    const completedRun = await prisma.agentRun.findUnique({
      where: { id: run.id },
      include: { logs: { orderBy: { createdAt: 'asc' } } },
    })

    return NextResponse.json({ run: completedRun }, { status: 201 })
  } catch (error) {
    console.error(`Agent run error (run ${run.id}):`, error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: 'failed',
        error: errorMessage,
        completedAt: new Date(),
      },
    })

    // Attempt to log the error (best-effort)
    try {
      await prisma.agentLog.create({
        data: {
          runId: run.id,
          type: 'error',
          content: errorMessage,
        },
      })
    } catch {}

    return NextResponse.json({ error: 'Agent run failed', details: errorMessage }, { status: 500 })
  }
}
