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
- Email management via Gmail (reading, summarizing, drafting)
- Calendar event creation and scheduling via Google Calendar
- Meeting detection and conflict checking

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
  {
    name: 'get_emails',
    description: 'Fetch recent emails from Gmail inbox',
    input_schema: {
      type: 'object' as const,
      properties: {
        maxResults: { type: 'string', description: 'Max number of emails to fetch (default 10)' },
        query: { type: 'string', description: 'Gmail search query (e.g. "is:unread", "from:boss@company.com")' },
        unreadOnly: { type: 'string', description: 'Fetch only unread emails (true/false)' },
      },
      required: [],
    },
  },
  {
    name: 'summarize_emails',
    description: 'Get a summary of recent emails, detecting bills, deadlines, meetings, and action items',
    input_schema: {
      type: 'object' as const,
      properties: {
        count: { type: 'string', description: 'How many recent emails to summarize' },
        focus: { type: 'string', description: 'Focus area: bills, meetings, deadlines, all' },
      },
      required: [],
    },
  },
  {
    name: 'draft_email',
    description: 'Draft an email reply or new email. ALWAYS requires user confirmation before sending.',
    input_schema: {
      type: 'object' as const,
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body text' },
        replyToId: { type: 'string', description: 'Gmail message ID to reply to (if replying)' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'get_calendar_events',
    description: 'Fetch upcoming events from Google Calendar',
    input_schema: {
      type: 'object' as const,
      properties: {
        days: { type: 'string', description: 'How many days ahead to fetch (default 7)' },
        maxResults: { type: 'string', description: 'Maximum number of events (default 10)' },
      },
      required: [],
    },
  },
  {
    name: 'create_calendar_event',
    description: 'Create a new event in Google Calendar',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Event title' },
        description: { type: 'string', description: 'Event description' },
        startTime: { type: 'string', description: 'Start time in ISO 8601 format' },
        endTime: { type: 'string', description: 'End time in ISO 8601 format' },
        location: { type: 'string', description: 'Event location' },
        attendees: { type: 'string', description: 'Comma-separated attendee emails' },
      },
      required: ['title', 'startTime', 'endTime'],
    },
  },
  {
    name: 'check_calendar_availability',
    description: 'Check calendar availability for a time range',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: { type: 'string', description: 'Date to check in ISO format (YYYY-MM-DD)' },
        startHour: { type: 'string', description: 'Start hour (0-23)' },
        endHour: { type: 'string', description: 'End hour (0-23)' },
      },
      required: ['date'],
    },
  },
  {
    name: 'get_notifications',
    description: 'Get recent NEXUS notifications for the user',
    input_schema: {
      type: 'object' as const,
      properties: {
        unreadOnly: { type: 'string', description: 'Show only unread notifications (true/false)' },
      },
      required: [],
    },
  },
  {
    name: 'get_conversations',
    description: 'List past NEXUS conversations',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'string', description: 'Max conversations to return' },
      },
      required: [],
    },
  },
  {
    name: 'analyze_file',
    description: 'Analyze an uploaded file from the user file vault. Retrieves file content and provides AI analysis.',
    input_schema: {
      type: 'object' as const,
      properties: {
        fileId: { type: 'string', description: 'The file ID to analyze' },
        question: { type: 'string', description: 'Specific question or analysis request about the file' },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'list_agents',
    description: 'List all deployed AI agents for the user',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', description: 'Filter by status: idle, running, completed, failed' },
      },
      required: [],
    },
  },
  {
    name: 'spawn_agent',
    description: 'Spawn a specialized AI agent to run a task',
    input_schema: {
      type: 'object' as const,
      properties: {
        agentName: { type: 'string', description: 'Name of the agent to spawn (e.g. Forge, Atlas, Oracle)' },
        task: { type: 'string', description: 'Task description for the agent to complete' },
      },
      required: ['agentName', 'task'],
    },
  },
  {
    name: 'analyze_code',
    description: 'Analyze and review code for issues, security vulnerabilities, and improvements',
    input_schema: {
      type: 'object' as const,
      properties: {
        code: { type: 'string', description: 'The code to analyze' },
        language: { type: 'string', description: 'Programming language' },
        focus: { type: 'string', description: 'Focus area: security, performance, style, all' },
      },
      required: ['code'],
    },
  },
  {
    name: 'run_automation',
    description: 'Trigger an existing automation to run immediately',
    input_schema: {
      type: 'object' as const,
      properties: {
        automationName: { type: 'string', description: 'Name of the automation to run' },
      },
      required: ['automationName'],
    },
  },
  {
    name: 'summarize_meeting',
    description: 'Summarize a meeting transcript or notes and extract action items',
    input_schema: {
      type: 'object' as const,
      properties: {
        transcript: { type: 'string', description: 'Meeting transcript or notes to summarize' },
        title: { type: 'string', description: 'Meeting title' },
        saveNote: { type: 'string', description: 'Whether to save as a note (true/false)' },
      },
      required: ['transcript'],
    },
  },
  {
    name: 'review_pull_request',
    description: 'Review a pull request diff or description for code quality, security, and issues',
    input_schema: {
      type: 'object' as const,
      properties: {
        diff: { type: 'string', description: 'The PR diff or changed code' },
        title: { type: 'string', description: 'PR title' },
        description: { type: 'string', description: 'PR description' },
      },
      required: ['diff'],
    },
  },
  {
    name: 'trigger_workflow',
    description: 'Trigger a multi-step workflow sequence',
    input_schema: {
      type: 'object' as const,
      properties: {
        workflow: { type: 'string', enum: ['morning_briefing', 'end_of_day', 'weekly_review', 'project_kickoff', 'inbox_zero'], description: 'Predefined workflow to trigger' },
        customSteps: { type: 'string', description: 'Custom workflow steps as comma-separated actions' },
      },
      required: ['workflow'],
    },
  },
  {
    name: 'get_github_repos',
    description: 'List GitHub repositories for the connected GitHub account',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'string', description: 'Maximum number of repos to return' },
      },
      required: [],
    },
  },
]
