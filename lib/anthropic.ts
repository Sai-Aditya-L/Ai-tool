import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export const NEXUS_SYSTEM_PROMPT = `You are NEXUS — Neural EXtended Universal System — a highly advanced AI personal operating system and intelligent companion. You are not just a chatbot; you are an integrated AI layer across the user's entire digital life.

Your personality:
- Highly intelligent, precise, and proactive
- Professional yet warm and personable
- Direct and action-oriented — you get things done
- Futuristic and sophisticated in tone
- You refer to yourself as NEXUS
- You address the user respectfully and remember their preferences

Your capabilities:
- Full conversation and reasoning
- Task management and organization
- Reminder and calendar assistance
- Note-taking and information organization
- Personal memory and preference learning
- File and document analysis
- Tracking of bills, subscriptions, packages, habits, goals
- Automation design and execution
- Email drafting and summarization
- Code review and development assistance
- Research and information synthesis
- Daily planning and productivity optimization

When the user asks you to DO something (create a task, set a reminder, etc.), use the appropriate tool function. When they ask questions, answer thoughtfully. Always confirm before performing destructive actions.

You have access to the following tools to execute actions in the system. Use them when appropriate.

Current date and context will be provided in each conversation. Always be aware of time-sensitive information.

Key rules:
1. NEVER send emails without explicit user confirmation
2. NEVER delete data without confirmation
3. Always explain what you're about to do before using a tool
4. Log your reasoning briefly when taking actions
5. If you need more information, ask a clarifying question
6. Be proactive — suggest helpful actions based on context`

export const NEXUS_TOOLS: Anthropic.Tool[] = [
  {
    name: 'create_task',
    description: 'Create a new task for the user',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Task description' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'Task priority' },
        dueDate: { type: 'string', description: 'Due date in ISO 8601 format' },
        tags: { type: 'string', description: 'Comma-separated tags' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_task',
    description: 'Update an existing task',
    input_schema: {
      type: 'object' as const,
      properties: {
        taskId: { type: 'string', description: 'Task ID to update' },
        title: { type: 'string', description: 'New title' },
        status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'], description: 'New status' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'New priority' },
        dueDate: { type: 'string', description: 'New due date' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'get_tasks',
    description: 'Retrieve tasks for the user with optional filters',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'], description: 'Filter by status' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'Filter by priority' },
        limit: { type: 'string', description: 'Maximum number of tasks to return' },
      },
      required: [],
    },
  },
  {
    name: 'create_reminder',
    description: 'Create a new reminder',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Reminder title' },
        description: { type: 'string', description: 'Reminder description' },
        dueAt: { type: 'string', description: 'When to remind in ISO 8601 format' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'Priority level' },
      },
      required: ['title', 'dueAt'],
    },
  },
  {
    name: 'get_reminders',
    description: 'Get upcoming reminders for the user',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['pending', 'completed', 'snoozed'], description: 'Filter by status' },
        limit: { type: 'string', description: 'Maximum number of reminders to return' },
      },
      required: [],
    },
  },
  {
    name: 'create_note',
    description: 'Create a new note',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Note title' },
        content: { type: 'string', description: 'Note content' },
        tags: { type: 'string', description: 'Comma-separated tags' },
        pinned: { type: 'string', description: 'Whether to pin the note (true/false)' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'search_notes',
    description: 'Search through user notes',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
  },
  {
    name: 'save_memory',
    description: 'Save a piece of information to user memory for future reference',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: { type: 'string', description: 'Memory category (preferences, goals, routines, dates, contacts, etc.)' },
        key: { type: 'string', description: 'Memory key/identifier' },
        value: { type: 'string', description: 'Memory value/content' },
      },
      required: ['category', 'key', 'value'],
    },
  },
  {
    name: 'get_memory',
    description: 'Retrieve memories about the user',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: { type: 'string', description: 'Filter by category' },
      },
      required: [],
    },
  },
  {
    name: 'summarize_day',
    description: "Generate a summary of the user's day including tasks, reminders, and recent activity",
    input_schema: {
      type: 'object' as const,
      properties: {
        date: { type: 'string', description: 'Date to summarize in ISO format (defaults to today)' },
      },
      required: [],
    },
  },
  {
    name: 'create_tracker',
    description: 'Create a new tracker (bill, subscription, expense, habit, goal, etc.)',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: { type: 'string', enum: ['bill', 'subscription', 'expense', 'package', 'habit', 'goal', 'job_application', 'custom'], description: 'Tracker type' },
        title: { type: 'string', description: 'Tracker title' },
        description: { type: 'string', description: 'Description' },
        dueDate: { type: 'string', description: 'Due or renewal date' },
        amount: { type: 'string', description: 'Amount (for financial trackers)' },
        currency: { type: 'string', description: 'Currency code (USD, EUR, etc.)' },
      },
      required: ['type', 'title'],
    },
  },
  {
    name: 'get_dashboard_summary',
    description: 'Get a summary of all dashboard data including tasks, reminders, and activity',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
]
