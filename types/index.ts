export interface User {
  id: string
  name?: string | null
  email: string
  image?: string | null
  createdAt: Date
}

export interface Task {
  id: string
  userId: string
  title: string
  description?: string | null
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  dueDate?: Date | null
  tags?: string | null
  parentId?: string | null
  recurring: boolean
  recurrenceRule?: string | null
  completedAt?: Date | null
  createdAt: Date
  updatedAt: Date
  subtasks?: Task[]
}

export interface Reminder {
  id: string
  userId: string
  title: string
  description?: string | null
  dueAt: Date
  status: 'pending' | 'completed' | 'snoozed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  recurring: boolean
  recurrenceRule?: string | null
  snoozedUntil?: Date | null
  completedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface Memory {
  id: string
  userId: string
  category: string
  key: string
  value: string
  source: string
  createdAt: Date
  updatedAt: Date
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  toolCalls?: string | null
  toolResults?: string | null
  tokens?: number | null
  createdAt: Date
}

export interface Conversation {
  id: string
  userId: string
  title?: string | null
  context?: string | null
  createdAt: Date
  updatedAt: Date
  messages?: Message[]
}

export interface Note {
  id: string
  userId: string
  title: string
  content: string
  tags?: string | null
  pinned: boolean
  color?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Tracker {
  id: string
  userId: string
  type: 'bill' | 'subscription' | 'expense' | 'package' | 'habit' | 'goal' | 'job_application' | 'custom'
  title: string
  description?: string | null
  status: 'active' | 'completed' | 'cancelled' | 'overdue'
  data?: string | null
  dueDate?: Date | null
  amount?: number | null
  currency?: string | null
  tags?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface ActivityLog {
  id: string
  userId: string
  action: string
  entityType?: string | null
  entityId?: string | null
  details?: string | null
  metadata?: string | null
  createdAt: Date
}

export interface Integration {
  id: string
  userId: string
  provider: string
  status: 'connected' | 'disconnected' | 'error' | 'pending'
  scope?: string | null
  metadata?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Automation {
  id: string
  userId: string
  name: string
  description?: string | null
  trigger: string
  conditions?: string | null
  actions: string
  status: 'active' | 'paused' | 'disabled'
  lastRun?: Date | null
  nextRun?: Date | null
  runCount: number
  createdAt: Date
  updatedAt: Date
}

export interface DashboardStats {
  pendingTasks: number
  todayReminders: number
  activeAutomations: number
  connectedIntegrations: number
  recentActivity: ActivityLog[]
  upcomingEvents: Reminder[]
}

export interface AITool {
  name: string
  description: string
  input_schema: {
    type: string
    properties: Record<string, {
      type: string
      description: string
      enum?: string[]
    }>
    required: string[]
  }
}

export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ToolResult {
  tool_use_id: string
  content: string
}
