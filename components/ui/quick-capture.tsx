'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X, CheckSquare, StickyNote, Bell, Send } from 'lucide-react'
import toast from 'react-hot-toast'

type Tab = 'task' | 'note' | 'reminder'

interface TaskForm {
  title: string
  priority: 'low' | 'medium' | 'high'
}

interface NoteForm {
  title: string
  content: string
}

interface ReminderForm {
  title: string
  dueAt: string
}

const TAB_ICONS = {
  task: <CheckSquare size={14} />,
  note: <StickyNote size={14} />,
  reminder: <Bell size={14} />,
}

const TAB_LABELS = {
  task: 'Task',
  note: 'Note',
  reminder: 'Reminder',
}

const inputCls =
  'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-cyan-400/40 focus:bg-white/8 transition-all'

const selectCls =
  'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40 transition-all appearance-none'

export function QuickCapture() {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('task')
  const [submitting, setSubmitting] = useState(false)

  const [taskForm, setTaskForm] = useState<TaskForm>({ title: '', priority: 'medium' })
  const [noteForm, setNoteForm] = useState<NoteForm>({ title: '', content: '' })
  const [reminderForm, setReminderForm] = useState<ReminderForm>({ title: '', dueAt: '' })

  // Cmd+N / Ctrl+N keyboard shortcut
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
      e.preventDefault()
      setOpen(prev => !prev)
    }
    if (e.key === 'Escape' && open) {
      setOpen(false)
    }
  }, [open])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  function resetForms() {
    setTaskForm({ title: '', priority: 'medium' })
    setNoteForm({ title: '', content: '' })
    setReminderForm({ title: '', dueAt: '' })
  }

  async function handleSubmit() {
    if (submitting) return

    if (activeTab === 'task' && !taskForm.title.trim()) {
      toast.error('Title is required')
      return
    }
    if (activeTab === 'note' && !noteForm.title.trim()) {
      toast.error('Title is required')
      return
    }
    if (activeTab === 'reminder' && (!reminderForm.title.trim() || !reminderForm.dueAt)) {
      toast.error('Title and date are required')
      return
    }

    setSubmitting(true)
    try {
      let url = ''
      let body: Record<string, unknown> = {}

      if (activeTab === 'task') {
        url = '/api/tasks'
        body = { title: taskForm.title.trim(), priority: taskForm.priority }
      } else if (activeTab === 'note') {
        url = '/api/notes'
        body = { title: noteForm.title.trim(), content: noteForm.content }
      } else if (activeTab === 'reminder') {
        url = '/api/reminders'
        body = { title: reminderForm.title.trim(), dueAt: reminderForm.dueAt }
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to create')
      }

      const labels = { task: 'Task', note: 'Note', reminder: 'Reminder' }
      toast.success(`${labels[activeTab]} created!`)
      resetForms()
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Modal card */}
      {open && (
        <div
          className="absolute bottom-16 right-0 w-80 rounded-2xl p-4 shadow-2xl"
          style={{
            background: 'rgba(0,4,12,0.97)',
            border: '1px solid rgba(0,229,255,0.2)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-cyan-400/80 tracking-widest uppercase">
              Quick Capture
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-white/30 hover:text-white/70 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 bg-white/4 rounded-lg p-1">
            {(['task', 'note', 'reminder'] as Tab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === tab
                    ? 'bg-cyan-400/15 text-cyan-400 border border-cyan-400/25'
                    : 'text-white/35 hover:text-white/60'
                }`}
              >
                {TAB_ICONS[tab]}
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>

          {/* Task form */}
          {activeTab === 'task' && (
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Task title..."
                value={taskForm.title}
                onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className={inputCls}
                autoFocus
              />
              <select
                value={taskForm.priority}
                onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value as 'low' | 'medium' | 'high' }))}
                className={selectCls}
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
            </div>
          )}

          {/* Note form */}
          {activeTab === 'note' && (
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Note title..."
                value={noteForm.title}
                onChange={e => setNoteForm(f => ({ ...f, title: e.target.value }))}
                className={inputCls}
                autoFocus
              />
              <textarea
                rows={3}
                placeholder="Content..."
                value={noteForm.content}
                onChange={e => setNoteForm(f => ({ ...f, content: e.target.value }))}
                className={`${inputCls} resize-none`}
              />
            </div>
          )}

          {/* Reminder form */}
          {activeTab === 'reminder' && (
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Reminder title..."
                value={reminderForm.title}
                onChange={e => setReminderForm(f => ({ ...f, title: e.target.value }))}
                className={inputCls}
                autoFocus
              />
              <input
                type="datetime-local"
                value={reminderForm.dueAt}
                onChange={e => setReminderForm(f => ({ ...f, dueAt: e.target.value }))}
                className={inputCls}
                style={{ colorScheme: 'dark' }}
              />
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, rgba(0,229,255,0.25), rgba(124,58,237,0.25))',
              border: '1px solid rgba(0,229,255,0.3)',
              color: '#00e5ff',
            }}
          >
            <Send size={14} />
            {submitting ? 'Saving...' : 'CAPTURE'}
          </button>

          {/* Keyboard hint */}
          <p className="text-center text-white/20 text-[10px] mt-2">
            ⌘N to toggle • Esc to close
          </p>
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95"
        style={{
          background: 'linear-gradient(135deg, rgba(0,229,255,0.8), rgba(124,58,237,0.8))',
          boxShadow: '0 0 30px rgba(0,229,255,0.3)',
        }}
        title="Quick Capture (⌘N)"
      >
        <Plus size={24} className="text-white" />
      </button>
    </div>
  )
}
