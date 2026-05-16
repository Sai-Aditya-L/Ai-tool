'use client'

import { useState, useEffect, useRef } from 'react'
import { Header } from '@/components/layout/header'
import { Plus, CheckSquare, Clock, Tag, Trash2, Check, Edit2, X, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
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
  isRecurring?: boolean
  recurringSchedule?: string
}

const PRIORITIES = ['urgent', 'high', 'medium', 'low']
const STATUSES = ['pending', 'in_progress', 'completed', 'cancelled']

const priorityColors: Record<string, string> = {
  urgent: 'border-l-red-500',
  high: 'border-l-orange-500',
  medium: 'border-l-yellow-500',
  low: 'border-l-green-500',
}

// ─── Edit Modal ────────────────────────────────────────────────────────────────

interface EditModalProps {
  task: Task
  onClose: () => void
  onSave: (updated: Task) => void
}

function EditModal({ task, onClose, onSave }: EditModalProps) {
  const [form, setForm] = useState({
    title: task.title,
    description: task.description ?? '',
    priority: task.priority,
    status: task.status,
    dueDate: task.dueDate ? task.dueDate.slice(0, 16) : '',
    tags: task.tags ?? '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description || undefined,
          priority: form.priority,
          status: form.status,
          dueDate: form.dueDate || null,
          tags: form.tags || undefined,
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      toast.success('Task updated')
      onSave(data.task)
    } catch {
      toast.error('Failed to update task')
    } finally {
      setSaving(false)
    }
  }

  // Close on backdrop click
  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={handleBackdrop}
    >
      <div className="glass-panel rounded-2xl p-6 w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <Edit2 size={16} className="text-cyan-400" />
            Edit Task
          </h2>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-3">
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
            rows={3}
            className="nexus-input resize-none"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={form.priority}
              onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
              className="nexus-input"
            >
              {PRIORITIES.map(p => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)} Priority</option>
              ))}
            </select>
            <select
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="nexus-input"
            >
              {STATUSES.map(s => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <input
            type="datetime-local"
            value={form.dueDate}
            onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
            className="nexus-input"
          />
          <input
            type="text"
            placeholder="Tags (comma separated)"
            value={form.tags}
            onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
            className="nexus-input"
          />
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving} className="nexus-btn-primary flex-1">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button type="button" onClick={onClose} className="nexus-btn-secondary px-5">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Subtask Row ───────────────────────────────────────────────────────────────

interface SubtaskRowProps {
  subtask: Task
  onComplete: (id: string, completed: boolean) => void
  onDelete: (id: string) => void
}

function SubtaskRow({ subtask, onComplete, onDelete }: SubtaskRowProps) {
  return (
    <div className="flex items-center gap-2 py-1.5 group">
      <button
        onClick={() => onComplete(subtask.id, subtask.status !== 'completed')}
        className={cn(
          'w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all',
          subtask.status === 'completed'
            ? 'bg-green-400/20 border-green-400/50'
            : 'border-white/20 hover:border-cyan-400/50'
        )}
      >
        {subtask.status === 'completed' && <Check size={9} className="text-green-400" />}
      </button>
      <span className={cn(
        'flex-1 text-xs',
        subtask.status === 'completed' ? 'line-through text-white/25' : 'text-white/60'
      )}>
        {subtask.title}
      </span>
      <button
        onClick={() => onDelete(subtask.id)}
        className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all p-0.5"
      >
        <X size={11} />
      </button>
    </div>
  )
}

// ─── Task Row ──────────────────────────────────────────────────────────────────

interface TaskRowProps {
  task: Task
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
  onEdit: (task: Task) => void
  onTaskUpdate: (updated: Task) => void
  selectMode?: boolean
  selected?: boolean
  onSelect?: (id: string) => void
}

function TaskRow({ task, onStatusChange, onDelete, onEdit, onTaskUpdate, selectMode, selected, onSelect }: TaskRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [subtasks, setSubtasks] = useState<Task[]>(task.subtasks ?? [])
  const [newSubtask, setNewSubtask] = useState('')
  const [addingSubtask, setAddingSubtask] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const completedCount = subtasks.filter(s => s.status === 'completed').length

  // Keep subtasks in sync when parent task changes (e.g. after edit)
  useEffect(() => {
    setSubtasks(task.subtasks ?? [])
  }, [task.subtasks])

  function toggleExpand() {
    setExpanded(prev => !prev)
  }

  async function addSubtask(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    const title = newSubtask.trim()
    if (!title) return

    setAddingSubtask(true)
    // Optimistic add with a temp id
    const tempId = `temp-${Date.now()}`
    const optimistic: Task = { id: tempId, title, status: 'pending', priority: 'medium' }
    setSubtasks(prev => [...prev, optimistic])
    setNewSubtask('')

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, parentId: task.id, priority: 'medium' }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      // Replace temp with real
      setSubtasks(prev => prev.map(s => s.id === tempId ? data.task : s))
      // Update parent task count in parent state
      onTaskUpdate({ ...task, subtasks: [...(task.subtasks ?? []).filter(s => s.id !== tempId), data.task] })
    } catch {
      setSubtasks(prev => prev.filter(s => s.id !== tempId))
      toast.error('Failed to add subtask')
    } finally {
      setAddingSubtask(false)
    }
  }

  async function completeSubtask(id: string, complete: boolean) {
    const status = complete ? 'completed' : 'pending'
    // Optimistic
    setSubtasks(prev => prev.map(s => s.id === id ? { ...s, status } : s))
    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
    } catch {
      // Rollback
      setSubtasks(prev => prev.map(s => s.id === id ? { ...s, status: complete ? 'pending' : 'completed' } : s))
      toast.error('Failed to update subtask')
    }
  }

  async function deleteSubtask(id: string) {
    // Optimistic
    const prev = subtasks
    setSubtasks(prevList => prevList.filter(s => s.id !== id))
    try {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    } catch {
      setSubtasks(prev)
      toast.error('Failed to delete subtask')
    }
  }

  const hasSubtasks = subtasks.length > 0

  return (
    <div className={cn(
      'glass-panel-hover rounded-xl border-l-2 transition-all',
      priorityColors[task.priority] || 'border-l-white/10'
    )}>
      {/* Main task row */}
      <div className="flex items-start gap-3 p-4">
        {/* Select checkbox (selectMode) */}
        {selectMode && (
          <button
            onClick={() => onSelect?.(task.id)}
            className={cn(
              'mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all',
              selected
                ? 'bg-cyan-400/20 border-cyan-400'
                : 'border-white/30 hover:border-cyan-400/60'
            )}
          >
            {selected && <Check size={12} className="text-cyan-400" />}
          </button>
        )}

        {/* Expand toggle */}
        {!selectMode && (
          <button
            onClick={toggleExpand}
            className={cn(
              'mt-0.5 flex-shrink-0 transition-colors',
              hasSubtasks || expanded
                ? 'text-white/40 hover:text-cyan-400'
                : 'text-white/10 hover:text-white/30'
            )}
          >
            {expanded
              ? <ChevronDown size={14} />
              : <ChevronRight size={14} />
            }
          </button>
        )}

        {/* Checkbox */}
        <button
          onClick={() => onStatusChange(task.id, task.status === 'completed' ? 'pending' : 'completed')}
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
              'text-sm font-medium flex items-center gap-1.5',
              task.status === 'completed' ? 'line-through text-white/30' : 'text-white/85'
            )}>
              {task.title}
              {task.isRecurring && (
                <RefreshCw size={11} className="text-cyan-400/70 flex-shrink-0" aria-label={`Recurring: ${task.recurringSchedule}`} />
              )}
            </p>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className={cn(
                'text-xs px-2 py-0.5 rounded-full border',
                getPriorityColor(task.priority)
              )}>
                {task.priority}
              </span>
              <button
                onClick={() => onEdit(task)}
                className="text-white/20 hover:text-cyan-400 transition-colors p-1"
                title="Edit task"
              >
                <Edit2 size={12} />
              </button>
              <button
                onClick={() => onDelete(task.id)}
                className="text-white/20 hover:text-red-400 transition-colors p-1"
                title="Delete task"
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
            {subtasks.length > 0 && (
              <span className="text-cyan-400/50 text-xs">
                {completedCount}/{subtasks.length} subtasks
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Expanded subtask section */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3 ml-8">
          {subtasks.length > 0 ? (
            <div className="divide-y divide-white/5">
              {subtasks.map(sub => (
                <SubtaskRow
                  key={sub.id}
                  subtask={sub}
                  onComplete={completeSubtask}
                  onDelete={deleteSubtask}
                />
              ))}
            </div>
          ) : (
            <p className="text-white/20 text-xs mb-2">No subtasks yet</p>
          )}

          {/* Add subtask input */}
          <div className="mt-2 flex items-center gap-2">
            <Plus size={11} className="text-white/25 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Add subtask… (press Enter)"
              value={newSubtask}
              onChange={e => setNewSubtask(e.target.value)}
              onKeyDown={addSubtask}
              disabled={addingSubtask}
              className="flex-1 bg-transparent border-0 border-b border-white/10 focus:border-cyan-400/40 text-xs text-white/60 placeholder:text-white/20 outline-none py-1 transition-colors"
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

type DueDateFilter = 'all' | 'overdue' | 'today' | 'this_week' | 'no_date'

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState({ status: 'pending', priority: '' })
  const [dueDateFilter, setDueDateFilter] = useState<DueDateFilter>('all')
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', dueDate: '', tags: '', isRecurring: false, recurringSchedule: 'daily' })
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => { document.title = 'Tasks | NEXUS' }, [])

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
      setForm({ title: '', description: '', priority: 'medium', dueDate: '', tags: '', isRecurring: false, recurringSchedule: 'daily' })
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

  function handleEditSave(updated: Task) {
    setTasks(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t))
    setEditingTask(null)
  }

  function handleTaskUpdate(updated: Task) {
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function bulkComplete() {
    const ids = Array.from(selectedIds)
    try {
      const res = await fetch('/api/tasks/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete', ids }),
      })
      if (!res.ok) throw new Error()
      toast.success(`${ids.length} task${ids.length !== 1 ? 's' : ''} completed`)
      setSelectedIds(new Set())
      setSelectMode(false)
      fetchTasks()
    } catch {
      toast.error('Failed to complete tasks')
    }
  }

  async function bulkDelete() {
    const ids = Array.from(selectedIds)
    if (!confirm(`Delete ${ids.length} task${ids.length !== 1 ? 's' : ''}? This cannot be undone.`)) return
    try {
      const res = await fetch('/api/tasks/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', ids }),
      })
      if (!res.ok) throw new Error()
      toast.success(`${ids.length} task${ids.length !== 1 ? 's' : ''} deleted`)
      setSelectedIds(new Set())
      setSelectMode(false)
      fetchTasks()
    } catch {
      toast.error('Failed to delete tasks')
    }
  }

  function applyDueDateFilter(taskList: Task[]): Task[] {
    if (dueDateFilter === 'all') return taskList
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
    const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000)
    return taskList.filter(t => {
      if (dueDateFilter === 'no_date') return !t.dueDate
      if (!t.dueDate) return false
      const due = new Date(t.dueDate)
      if (dueDateFilter === 'overdue') return due < now && t.status !== 'completed'
      if (dueDateFilter === 'today') return due >= todayStart && due < todayEnd
      if (dueDateFilter === 'this_week') return due >= todayStart && due < weekEnd
      return true
    })
  }

  const visibleTasks = applyDueDateFilter(tasks)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Tasks" subtitle={`${visibleTasks.length} ${filter.status || 'total'} tasks`} />
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
            <button
              onClick={() => { setSelectMode(m => !m); setSelectedIds(new Set()) }}
              className={cn(
                'flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border transition-all',
                selectMode
                  ? 'bg-cyan-400/15 border-cyan-400/30 text-cyan-400'
                  : 'text-white/40 border-white/10 hover:border-white/20 hover:text-white/60'
              )}
            >
              <CheckSquare size={14} />
              Select
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

            {/* Due date range filter */}
            <select
              value={dueDateFilter}
              onChange={e => setDueDateFilter(e.target.value as DueDateFilter)}
              className="nexus-input w-auto text-xs py-1.5 px-3"
            >
              <option value="all">All Dates</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due Today</option>
              <option value="this_week">Due This Week</option>
              <option value="no_date">No Due Date</option>
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
                {/* Recurring options */}
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.isRecurring}
                      onChange={e => setForm(f => ({ ...f, isRecurring: e.target.checked }))}
                      className="w-4 h-4 rounded accent-cyan-400"
                    />
                    <span className="text-sm text-white/60 flex items-center gap-1.5">
                      <RefreshCw size={13} className="text-cyan-400/70" />
                      Recurring
                    </span>
                  </label>
                  {form.isRecurring && (
                    <select
                      value={form.recurringSchedule}
                      onChange={e => setForm(f => ({ ...f, recurringSchedule: e.target.value }))}
                      className="nexus-input w-auto text-sm py-1.5 px-3"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="weekdays">Weekdays</option>
                    </select>
                  )}
                </div>
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
          ) : visibleTasks.length === 0 ? (
            <div className="text-center py-16 glass-panel rounded-2xl">
              <CheckSquare size={40} className="text-white/20 mx-auto mb-3" />
              <p className="text-white/40 font-medium">No tasks found</p>
              <p className="text-white/25 text-sm mt-1">Create your first task or ask NEXUS to help</p>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleTasks.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onStatusChange={updateTaskStatus}
                  onDelete={deleteTask}
                  onEdit={setEditingTask}
                  onTaskUpdate={handleTaskUpdate}
                  selectMode={selectMode}
                  selected={selectedIds.has(task.id)}
                  onSelect={toggleSelect}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {editingTask && (
        <EditModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSave={handleEditSave}
        />
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 glass-panel rounded-2xl px-5 py-3 flex items-center gap-3 shadow-2xl border border-cyan-400/20">
          <span className="text-white/60 text-sm nexus-mono">{selectedIds.size} selected</span>
          <button
            onClick={bulkComplete}
            className="nexus-btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3"
          >
            <Check size={13} /> Complete All
          </button>
          <button
            onClick={bulkDelete}
            className="text-xs flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-red-400/30 text-red-400 hover:bg-red-400/10 transition-all"
          >
            <Trash2 size={13} /> Delete All
          </button>
          <button
            onClick={() => { setSelectedIds(new Set()); setSelectMode(false) }}
            className="text-white/40 hover:text-white/70 transition-colors p-1"
            title="Cancel"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
