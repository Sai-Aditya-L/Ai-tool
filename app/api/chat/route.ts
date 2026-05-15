import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { anthropic, NEXUS_SYSTEM_PROMPT, NEXUS_TOOLS } from '@/lib/anthropic'
import {
  listEmails,
  createDraft,
  listCalendarEvents,
  createCalendarEvent,
  isGoogleConnected,
} from '@/lib/google'
import Anthropic from '@anthropic-ai/sdk'

async function executeToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  userId: string
): Promise<string> {
  try {
    switch (toolName) {
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
            details: `NEXUS created task: ${task.title}`,
          },
        })
        return JSON.stringify({ success: true, task: { id: task.id, title: task.title, priority: task.priority, dueDate: task.dueDate } })
      }

      case 'update_task': {
        const existing = await prisma.task.findFirst({ where: { id: toolInput.taskId as string, userId } })
        if (!existing) return JSON.stringify({ error: 'Task not found' })
        const updateData: Record<string, unknown> = {}
        if (toolInput.title) updateData.title = toolInput.title as string
        if (toolInput.status) updateData.status = toolInput.status as string
        if (toolInput.priority) updateData.priority = toolInput.priority as string
        if (toolInput.dueDate) updateData.dueDate = new Date(toolInput.dueDate as string)
        if (toolInput.status === 'completed') updateData.completedAt = new Date()
        const updated = await prisma.task.update({
          where: { id: toolInput.taskId as string },
          data: updateData,
        })
        return JSON.stringify({ success: true, task: { id: updated.id, title: updated.title, status: updated.status } })
      }

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
        return JSON.stringify({ tasks: tasks.map(t => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate, subtasksCount: t.subtasks.length })) })
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
            details: `NEXUS created reminder: ${reminder.title}`,
          },
        })
        return JSON.stringify({ success: true, reminder: { id: reminder.id, title: reminder.title, dueAt: reminder.dueAt } })
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
        return JSON.stringify({ reminders: reminders.map(r => ({ id: r.id, title: r.title, dueAt: r.dueAt, priority: r.priority, status: r.status })) })
      }

      case 'create_note': {
        const note = await prisma.note.create({
          data: {
            userId,
            title: toolInput.title as string,
            content: toolInput.content as string,
            tags: toolInput.tags as string | undefined,
            pinned: toolInput.pinned === 'true' || toolInput.pinned === true,
          },
        })
        await prisma.activityLog.create({
          data: {
            userId,
            action: 'NOTE_CREATED',
            entityType: 'note',
            entityId: note.id,
            details: `NEXUS created note: ${note.title}`,
          },
        })
        return JSON.stringify({ success: true, note: { id: note.id, title: note.title } })
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
        return JSON.stringify({ notes: notes.map(n => ({ id: n.id, title: n.title, content: n.content.substring(0, 200), tags: n.tags })) })
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
            source: 'nexus',
          },
        })
        return JSON.stringify({ success: true, memory: { id: memory.id, key: memory.key, category: memory.category } })
      }

      case 'get_memory': {
        const memories = await prisma.memory.findMany({
          where: {
            userId,
            ...(toolInput.category ? { category: toolInput.category as string } : {}),
          },
          orderBy: { updatedAt: 'desc' },
        })
        return JSON.stringify({ memories: memories.map(m => ({ id: m.id, category: m.category, key: m.key, value: m.value })) })
      }

      case 'create_tracker': {
        const tracker = await prisma.tracker.create({
          data: {
            userId,
            type: toolInput.type as string,
            title: toolInput.title as string,
            description: toolInput.description as string | undefined,
            dueDate: toolInput.dueDate ? new Date(toolInput.dueDate as string) : null,
            amount: toolInput.amount ? parseFloat(toolInput.amount as string) : null,
            currency: toolInput.currency as string | undefined,
          },
        })
        return JSON.stringify({ success: true, tracker: { id: tracker.id, title: tracker.title, type: tracker.type } })
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

      case 'get_emails': {
        const connected = await isGoogleConnected(userId)
        if (!connected) return JSON.stringify({ error: 'Gmail not connected. Ask the user to connect Google in Integrations settings.' })
        try {
          const maxResults = toolInput.maxResults ? parseInt(toolInput.maxResults as string) : 10
          const query = toolInput.unreadOnly === 'true' ? 'is:unread' : (toolInput.query as string || '')
          const { emails } = await listEmails(userId, { maxResults, query })
          return JSON.stringify({ emails: (emails || []).map((e: any) => ({ id: e.id, subject: e.subject, from: e.from, fromName: e.fromName, snippet: e.snippet, isRead: e.isRead, receivedAt: e.receivedAt })) })
        } catch {
          return JSON.stringify({ error: 'Failed to fetch emails' })
        }
      }

      case 'summarize_emails': {
        const connected = await isGoogleConnected(userId)
        if (!connected) return JSON.stringify({ error: 'Gmail not connected.' })
        try {
          const count = toolInput.count ? parseInt(toolInput.count as string) : 10
          const { emails } = await listEmails(userId, { maxResults: count })
          const emailList = emails || []
          return JSON.stringify({
            total: emailList.length,
            unread: emailList.filter((e: any) => !e.isRead).length,
            emails: emailList.map((e: any) => ({ subject: e.subject, from: e.from, snippet: e.snippet, isRead: e.isRead, receivedAt: e.receivedAt })),
          })
        } catch {
          return JSON.stringify({ error: 'Failed to summarize emails' })
        }
      }

      case 'draft_email': {
        const connected = await isGoogleConnected(userId)
        if (!connected) return JSON.stringify({ error: 'Gmail not connected.' })
        try {
          const draftData = await createDraft(userId, {
            to: toolInput.to as string,
            subject: toolInput.subject as string,
            body: toolInput.body as string,
            replyToMessageId: toolInput.replyToId as string | undefined,
          })
          const draftId = draftData?.id || ''
          await prisma.emailDraft.create({
            data: {
              userId,
              to: toolInput.to as string,
              subject: toolInput.subject as string,
              body: toolInput.body as string,
              status: 'draft',
            },
          }).catch(() => {})
          return JSON.stringify({ success: true, draftId, message: 'Draft saved. User must review and send from the Emails page.' })
        } catch {
          return JSON.stringify({ error: 'Failed to create draft' })
        }
      }

      case 'get_calendar_events': {
        const connected = await isGoogleConnected(userId)
        try {
          if (connected) {
            const days = toolInput.days ? parseInt(toolInput.days as string) : 7
            const maxResults = toolInput.maxResults ? parseInt(toolInput.maxResults as string) : 10
            const timeMin = new Date()
            const timeMax = new Date()
            timeMax.setDate(timeMax.getDate() + days)
            const events = await listCalendarEvents(userId, { timeMin, timeMax, maxResults })
            return JSON.stringify({ source: 'google_calendar', events })
          } else {
            const upcoming = await prisma.reminder.findMany({
              where: { userId, status: 'pending', dueAt: { gte: new Date() } },
              orderBy: { dueAt: 'asc' },
              take: 10,
            })
            return JSON.stringify({ source: 'nexus_reminders', events: upcoming.map(r => ({ id: r.id, title: r.title, start: r.dueAt, priority: r.priority })) })
          }
        } catch {
          return JSON.stringify({ error: 'Failed to fetch calendar events' })
        }
      }

      case 'create_calendar_event': {
        const connected = await isGoogleConnected(userId)
        try {
          if (connected) {
            const event = await createCalendarEvent(userId, {
              title: toolInput.title as string,
              description: toolInput.description as string | undefined,
              startTime: toolInput.startTime as string,
              endTime: toolInput.endTime as string,
              location: toolInput.location as string | undefined,
              attendees: toolInput.attendees ? (toolInput.attendees as string).split(',').map(e => e.trim()) : undefined,
            })
            return JSON.stringify({ success: true, event, source: 'google_calendar' })
          } else {
            const reminder = await prisma.reminder.create({
              data: {
                userId,
                title: toolInput.title as string,
                description: toolInput.description as string | undefined,
                dueAt: new Date(toolInput.startTime as string),
                priority: 'medium',
              },
            })
            return JSON.stringify({ success: true, reminder, source: 'nexus_reminder', note: 'Created as NEXUS reminder (Google Calendar not connected)' })
          }
        } catch {
          return JSON.stringify({ error: 'Failed to create calendar event' })
        }
      }

      case 'check_calendar_availability': {
        const connected = await isGoogleConnected(userId)
        if (!connected) return JSON.stringify({ available: true, note: 'Google Calendar not connected — cannot check real availability' })
        try {
          const date = toolInput.date as string
          const startHour = toolInput.startHour ? parseInt(toolInput.startHour as string) : 9
          const endHour = toolInput.endHour ? parseInt(toolInput.endHour as string) : 17
          const timeMin = new Date(`${date}T${String(startHour).padStart(2, '0')}:00:00`)
          const timeMax = new Date(`${date}T${String(endHour).padStart(2, '0')}:00:00`)
          const events = await listCalendarEvents(userId, { timeMin, timeMax, maxResults: 20 })
          return JSON.stringify({ date, startHour, endHour, eventCount: events.length, busy: events, available: events.length === 0 })
        } catch {
          return JSON.stringify({ error: 'Failed to check availability' })
        }
      }

      case 'get_notifications': {
        const unreadOnly = toolInput.unreadOnly === 'true'
        const notifications = await prisma.notification.findMany({
          where: { userId, ...(unreadOnly ? { read: false } : {}) },
          orderBy: { createdAt: 'desc' },
          take: 10,
        })
        return JSON.stringify({ notifications: notifications.map(n => ({ id: n.id, title: n.title, body: n.body, type: n.type, read: n.read, createdAt: n.createdAt })) })
      }

      case 'get_conversations': {
        const limit = toolInput.limit ? parseInt(toolInput.limit as string) : 10
        const conversations = await prisma.conversation.findMany({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
          take: limit,
          include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
        })
        return JSON.stringify({ conversations: conversations.map(c => ({ id: c.id, title: c.title, updatedAt: c.updatedAt, lastMessage: c.messages[0]?.content?.substring(0, 100) })) })
      }

      case 'analyze_file': {
        const file = await prisma.userFile.findFirst({ where: { id: toolInput.fileId as string, userId } })
        if (!file) return JSON.stringify({ error: 'File not found' })
        const content = file.path || ''
        const question = (toolInput.question as string) || 'Summarize this file'
        const analysis = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          messages: [{ role: 'user', content: `File: ${file.name}\n\nContent:\n${content.substring(0, 8000)}\n\nQuestion: ${question}` }],
        })
        const result = analysis.content.find(b => b.type === 'text')?.text || 'Could not analyze file'
        return JSON.stringify({ success: true, fileName: file.name, analysis: result })
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` })
    }
  } catch (error) {
    console.error(`Tool execution error (${toolName}):`, error)
    return JSON.stringify({ error: 'Tool execution failed', tool: toolName })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  try {
    const { messages, conversationId } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages' }, { status: 400 })
    }

    // Get or create conversation
    let conversation
    if (conversationId) {
      conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, userId: user.id },
        include: { messages: { orderBy: { createdAt: 'asc' }, take: 20 } },
      })
    }

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { userId: user.id, title: messages[0]?.content?.substring(0, 60) || 'New conversation' },
        include: { messages: true },
      })
    }

    // Build context from recent memory
    const memories = await prisma.memory.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    })

    const memoryContext = memories.length > 0
      ? `\n\nKnown user context from memory:\n${memories.map(m => `- ${m.category}/${m.key}: ${m.value}`).join('\n')}`
      : ''

    const systemPrompt = NEXUS_SYSTEM_PROMPT + memoryContext + `\n\nCurrent user: ${user.name || user.email}\nCurrent time: ${new Date().toISOString()}`

    // Format messages for Claude
    const claudeMessages: Anthropic.MessageParam[] = messages.map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    // Agentic loop with tool calling
    let response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      tools: NEXUS_TOOLS,
      messages: claudeMessages,
    })

    // Tool calling loop
    const toolCallsLog: Array<{ name: string; result: string }> = []
    let iterations = 0
    const maxIterations = 5

    while (response.stop_reason === 'tool_use' && iterations < maxIterations) {
      iterations++
      const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      const toolResults: Anthropic.MessageParam = {
        role: 'user',
        content: await Promise.all(
          toolUseBlocks.map(async (toolUse) => {
            const result = await executeToolCall(toolUse.name, toolUse.input as Record<string, unknown>, user.id)
            toolCallsLog.push({ name: toolUse.name, result })
            return {
              type: 'tool_result' as const,
              tool_use_id: toolUse.id,
              content: result,
            }
          })
        ),
      }

      // Continue conversation with tool results
      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: systemPrompt,
        tools: NEXUS_TOOLS,
        messages: [...claudeMessages, { role: 'assistant', content: response.content }, toolResults],
      })
    }

    // Extract text response
    const textContent = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
    const assistantMessage = textContent?.text || 'I processed your request.'

    // Save messages to DB
    const lastUserMessage = messages[messages.length - 1]
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: lastUserMessage.content,
      },
    })
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: assistantMessage,
        toolCalls: toolCallsLog.length > 0 ? JSON.stringify(toolCallsLog.map(t => t.name)) : null,
      },
    })

    // Log conversation activity
    if (toolCallsLog.length > 0) {
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: 'AI_TOOLS_EXECUTED',
          details: `NEXUS executed: ${toolCallsLog.map(t => t.name).join(', ')}`,
        },
      })
    }

    return NextResponse.json({
      message: assistantMessage,
      conversationId: conversation.id,
      toolsUsed: toolCallsLog.map(t => t.name),
    })
  } catch (error) {
    console.error('Chat API error:', error)
    if (error instanceof Error && error.message.includes('API key')) {
      return NextResponse.json({
        error: 'ANTHROPIC_API_KEY not configured. Add it to your .env file.',
        message: 'NEXUS neural link requires an Anthropic API key. Please configure ANTHROPIC_API_KEY in your environment.',
      }, { status: 503 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const conversations = await prisma.conversation.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    take: 20,
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })

  return NextResponse.json({ conversations })
}
