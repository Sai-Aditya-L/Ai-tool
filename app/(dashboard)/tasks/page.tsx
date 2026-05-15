'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Plus, CheckSquare, Clock, Tag, AlertCircle, Trash2, Check, Edit2, X, ChevronDown } from 'lucide-react'
import { cn, formatDate, getPriorityColor } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Task {
  id: string
  title: string
  description?: string
  status: string
  priority: string
  dueDate?: string
  tags?: string
  subtasks?: Task[]
}

const PRIORITIES = ['urgent', 'high', 'medium', 'low']
const STATUSES = ['pending', 'in_progress', 'completed', 'cancelled']

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState({ status: 'pending', priority: '' })
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', dueDate: '', tags: '' })

  useEffect(() => { fetchTasks() }, [filter])

  async function fetchTasks() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter.status) params.set('status', filter.status)
      if (filter.priority) params.set('priority', filter.priority)
      const res = await fetch(`/api/tasks?${params}`)
      const data = await res.json()
      setTasks(data.tasks || [])
    } catch {
      toast.error('Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }

  async function createTask(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      toast.success('Task created')
      setForm({ title: '', description: '', priority: 'medium', dueDate: '', tags: '' })
      setShowForm(false)
      fetchTasks()
    } catch {
      toast.error('Failed to create task')
    }
  }

  async function updateTaskStatus(id: string, status: string) {
    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t))
      if (status === 'completed') toast.success('Task completed!')
    } catch {
      toast.error('Failed to update task')
    }
  }

  async function deleteTask(id: string) {
    if (!confirm('Delete this task?')) return
    try {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
      setTasks(prev => prev.filter(t => t.id !== id))
      toast.success('Task deleted')
    } catch {
      toast.error('Failed to delete task')
    }
  }

  const priorityColors: Record<string, string> = {
    urgent: 'border-l-red-500',
    high: 'border-l-orange-500',
    medium: 'border-l-yellow-500',
    low: 'border-l-green-500',
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Tasks" subtitle={`${tasks.length} ${filter.status || 'total'} tasks`} />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-4">

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowForm(!showForm)}
              className="nexus-btn-primary flex items-center gap-2 text-sm"
            >
              <Plus size={16} />
              New Task
            </button>

            {/* Status filter */}
            <div className="flex gap-1">
              {['', 'pending', 'in_progress', 'completed'].map(s => (
                <button
                  key={s}
                  onClick={() => setFilter(f => ({ ...f, status: s }))}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs transition-all',
                    filter.status === s
                      ? 'bg-cyan-400/15 border border-cyan-400/30 text-cyan-400'
                      : 'text-white/40 border border-white/5 hover:border-white/15 hover:text-white/60'
                  )}
                >
                  {s === '' ? 'All' : s.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* Priority filter */}
            <select
              value={filter.priority}
              onChange={e => setFilter(f => ({ ...f, priority: e.target.value }))}
              className="nexus-input w-auto text-xs py-1.5 px-3"
            >
              <option value="">All priorities</option>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Create form */}
          {showForm && (
            <div className="glass-panel rounded-2xl p-5">
              <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                <Plus size={16} className="text-cyan-400" />
                New Task
              </h3>
              <form onSubmit={createTask} className="space-y-3">
                <input
                  type="text"
                  placeholder="Task title *"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  required
                  className="nexus-input"
                  autoFocus
                />
                <textarea
                  placeholder="Description (optional)"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="nexus-input resize-none"
                />
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={form.priority}
                    onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                    className="nexus-input"
                  >
                    {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)} Priority</option>)}
                  </select>
                  <input
                    type="datetime-local"
                    value={form.dueDate}
                    onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                    className="nexus-input"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Tags (comma separated)"
                  value={form.tags}
                  onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                  className="nexus-input"
                />
                <div className="flex gap-2">
                  <button type="submit" className="nexus-btn-primary flex-1">Create Task</button>
                  <button type="button" onClick={() => setShowForm(false)} className="nexus-btn-secondary px-4">
                    <X size={16} />
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tasks list */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-16 glass-panel rounded-2xl">
              <CheckSquare size={40} className="text-white/20 mx-auto mb-3" />
              <p className="text-white/40 font-medium">No tasks found</p>
              <p className="text-white/25 text-sm mt-1">Create your first task or ask NEXUS to help</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map(task => (
                <div
                  key={task.id}
                  className={cn(
                    'glass-panel-hover rounded-xl p-4 border-l-2 flex items-start gap-3',
                    priorityColors[task.priority] || 'border-l-white/10'
                  )}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => updateTaskStatus(task.id, task.status === 'completed' ? 'pending' : 'completed')}
                    className={cn(
                      'mt-0.5 w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all',
                      task.status === 'completed'
                        ? 'bg-green-400/20 border-green-400/50'
                        : 'border-white/20 hover:border-cyan-400/50'
                    )}
                  >
                    {task.status === 'completed' && <Check size={12} className="text-green-400" />}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn(
                        'text-sm font-medium',
                        task.status === 'completed' ? 'line-through text-white/30' : 'text-white/85'
                      )}>
                        {task.title}
                      </p>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full border',
                          getPriorityColor(task.priority)
                        )}>
                          {task.priority}
                        </span>
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="text-white/20 hover:text-red-400 transition-colors p-1"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {task.description && (
                      <p className="text-white/40 text-xs mt-1">{task.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      {task.dueDate && (
                        <span className="text-white/35 text-xs flex items-center gap-1">
                          <Clock size={10} />
                          {formatDate(task.dueDate)}
                        </span>
                      )}
                      {task.tags && (
                        <span className="text-white/35 text-xs flex items-center gap-1">
                          <Tag size={10} />
                          {task.tags.split(',').map((t: string) => t.trim()).join(' · ')}
                        </span>
                      )}
                      {task.subtasks && task.subtasks.length > 0 && (
                        <span className="text-cyan-400/50 text-xs">
                          {task.subtasks.filter((s: Task) => s.status === 'completed').length}/{task.subtasks.length} subtasks
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
