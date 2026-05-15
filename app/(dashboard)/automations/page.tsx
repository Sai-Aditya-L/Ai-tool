'use client'

import { useState } from 'react'
import { Header } from '@/components/layout/header'
import { Zap, Plus, Play, Pause, Trash2, Clock, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const EXAMPLE_AUTOMATIONS = [
  {
    id: '1', name: 'Morning Briefing',
    trigger: 'Every day at 8:00 AM',
    action: 'Summarize tasks, reminders, and emails',
    status: 'active', lastRun: '8 hours ago',
  },
  {
    id: '2', name: 'Weekly Report',
    trigger: 'Every Monday at 9:00 AM',
    action: 'Generate weekly productivity summary',
    status: 'active', lastRun: '3 days ago',
  },
  {
    id: '3', name: 'Bill Alert',
    trigger: 'When bill tracker due date is 3 days away',
    action: 'Create a high-priority reminder',
    status: 'paused', lastRun: 'Never',
  },
]

const AUTOMATION_TEMPLATES = [
  { name: 'Morning Briefing', icon: '🌅', desc: 'Daily summary of your tasks and schedule' },
  { name: 'Weekly Review', icon: '📊', desc: 'Weekly productivity report every Monday' },
  { name: 'Bill Alerts', icon: '💳', desc: 'Reminders before bills are due' },
  { name: 'Task Digest', icon: '✅', desc: 'Daily digest of pending tasks at end of day' },
  { name: 'Email Summary', icon: '📧', desc: 'Summarize important emails (Phase 2)' },
  { name: 'Custom', icon: '⚡', desc: 'Build your own automation workflow' },
]

export default function AutomationsPage() {
  const [automations, setAutomations] = useState(EXAMPLE_AUTOMATIONS)
  const [showTemplates, setShowTemplates] = useState(false)

  function toggleStatus(id: string) {
    setAutomations(prev => prev.map(a =>
      a.id === id ? { ...a, status: a.status === 'active' ? 'paused' : 'active' } : a
    ))
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Automations" subtitle="Intelligent workflow automation engine" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-4">

          {/* Info */}
          <div className="glass-panel rounded-xl p-4 border border-yellow-400/15 flex items-start gap-3">
            <Zap size={18} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-white/70 text-sm font-medium">Automation Engine — Phase 3</p>
              <p className="text-white/40 text-xs mt-0.5">
                Full automation scheduling and execution engine is coming in Phase 3.
                Automations shown here are previews. Ask NEXUS in chat to help design your workflows.
              </p>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="nexus-btn-primary flex items-center gap-2 text-sm"
            >
              <Plus size={16} />
              New Automation
            </button>
          </div>

          {/* Templates */}
          {showTemplates && (
            <div className="glass-panel rounded-2xl p-5">
              <h3 className="text-white font-medium mb-4">Choose a Template</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {AUTOMATION_TEMPLATES.map(t => (
                  <button
                    key={t.name}
                    className="text-left glass-panel-hover rounded-xl p-3 transition-all"
                    onClick={() => setShowTemplates(false)}
                  >
                    <span className="text-2xl block mb-2">{t.icon}</span>
                    <p className="text-white/80 text-sm font-medium">{t.name}</p>
                    <p className="text-white/40 text-xs mt-1">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Active automations */}
          <div>
            <p className="text-white/30 text-xs uppercase tracking-wider mb-2">Your Automations</p>
            <div className="space-y-2">
              {automations.map(auto => (
                <div key={auto.id} className="glass-panel-hover rounded-xl p-4 flex items-center gap-4">
                  <div className={cn(
                    'w-2 h-2 rounded-full flex-shrink-0',
                    auto.status === 'active' ? 'bg-green-400' : 'bg-white/20'
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white/85 font-medium text-sm">{auto.name}</p>
                    <div className="flex items-center gap-1 mt-0.5 text-white/35 text-xs">
                      <Clock size={10} />
                      <span>{auto.trigger}</span>
                      <ArrowRight size={10} className="mx-1" />
                      <span>{auto.action}</span>
                    </div>
                    <p className="text-white/25 text-[10px] mt-1">Last run: {auto.lastRun}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full border',
                      auto.status === 'active'
                        ? 'text-green-400 border-green-400/30'
                        : 'text-white/30 border-white/15'
                    )}>
                      {auto.status}
                    </span>
                    <button
                      onClick={() => toggleStatus(auto.id)}
                      className="text-white/30 hover:text-cyan-400 transition-colors p-1.5 rounded-lg hover:bg-cyan-400/5"
                    >
                      {auto.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    <button className="text-white/20 hover:text-red-400 transition-colors p-1.5 rounded-lg">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* How it works */}
          <div className="glass-panel rounded-xl p-5">
            <p className="text-white/50 text-xs uppercase tracking-wider mb-3">How Automations Work</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { step: '1', title: 'Trigger', desc: 'Time-based, event-based, or condition-based triggers', icon: '⚡' },
                { step: '2', title: 'Conditions', desc: 'Optional filters and conditions to control execution', icon: '🔍' },
                { step: '3', title: 'Actions', desc: 'NEXUS executes tasks, sends notifications, creates summaries', icon: '✅' },
              ].map(s => (
                <div key={s.step} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-cyan-400 text-xs font-bold">{s.step}</span>
                  </div>
                  <div>
                    <p className="text-white/70 text-sm font-medium">{s.title} {s.icon}</p>
                    <p className="text-white/35 text-xs mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
