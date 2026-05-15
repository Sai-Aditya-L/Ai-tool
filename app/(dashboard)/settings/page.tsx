'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/layout/header'
import { User, Bell, Shield, Cpu, Key, Save, Download, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

// ── Toggle component ──────────────────────────────────────────────────────────
function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`relative w-10 h-5 rounded-full border transition-all duration-200 flex-shrink-0 ${
        enabled
          ? 'bg-cyan-400/40 border-cyan-400/50'
          : 'bg-white/10 border-white/20'
      }`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200 ${
          enabled ? 'left-5 bg-cyan-400' : 'left-0.5 bg-white/40'
        }`}
      />
    </button>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Preferences {
  assistantName: string
  aiModel: string
  aiProvider: string
  openaiModel: string
  memoryEnabled: boolean
  voiceEnabled: boolean
  notificationsOn: boolean
  timezone: string
  language: string
  theme: string
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { data: session } = useSession()
  const [activeSection, setActiveSection] = useState('profile')

  // Profile
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  // Assistant
  const [assistantName, setAssistantName] = useState('NEXUS')
  const [aiModel, setAiModel] = useState('claude-sonnet-4-6')
  const [aiProvider, setAiProvider] = useState<'anthropic' | 'openai'>('anthropic')
  const [openaiModel, setOpenaiModel] = useState('gpt-4o')
  const [openaiKey, setOpenaiKey] = useState('')
  const [memoryEnabled, setMemoryEnabled] = useState(true)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [timezone, setTimezone] = useState('UTC')
  const [language, setLanguage] = useState('en')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [savingAssistant, setSavingAssistant] = useState(false)

  // Notifications
  const [notificationsOn, setNotificationsOn] = useState(true)
  const [notifTypes, setNotifTypes] = useState({
    taskReminders: true,
    reminderAlerts: true,
    dailyBriefing: false,
    automationReports: false,
    importantEmails: true,
  })
  const [savingNotifs, setSavingNotifs] = useState(false)

  // Privacy
  const [clearingMemory, setClearingMemory] = useState(false)
  const [exportingData, setExportingData] = useState(false)

  // ── Load settings on mount ──────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        if (data.name !== undefined) setDisplayName(data.name ?? '')
        if (data.email !== undefined) setEmail(data.email ?? '')
        if (data.preferences) {
          const p: Preferences = data.preferences
          setAssistantName(p.assistantName ?? 'NEXUS')
          setAiModel(p.aiModel ?? 'claude-sonnet-4-6')
          setAiProvider((p.aiProvider as 'anthropic' | 'openai') ?? 'anthropic')
          setOpenaiModel(p.openaiModel ?? 'gpt-4o')
          setMemoryEnabled(p.memoryEnabled ?? true)
          setVoiceEnabled(p.voiceEnabled ?? false)
          setNotificationsOn(p.notificationsOn ?? true)
          setTimezone(p.timezone ?? 'UTC')
          setLanguage(p.language ?? 'en')
          const savedTheme = (p.theme ?? 'dark') as 'dark' | 'light'
          setTheme(savedTheme)
          if (savedTheme === 'light') document.documentElement.classList.add('light-mode')
          else document.documentElement.classList.remove('light-mode')
        }
      })
      .catch(() => toast.error('Failed to load settings'))
  }, [])

  // ── Save handlers ───────────────────────────────────────────────────────────
  async function saveProfile() {
    setSavingProfile(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: displayName }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Profile saved')
    } catch {
      toast.error('Failed to save profile')
    } finally {
      setSavingProfile(false)
    }
  }

  async function saveAssistant() {
    setSavingAssistant(true)
    try {
      const body: Record<string, unknown> = {
        assistantName,
        aiModel,
        aiProvider,
        openaiModel,
        memoryEnabled,
        voiceEnabled,
        timezone,
        language,
        theme,
      }
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Assistant configuration saved')
    } catch {
      toast.error('Failed to save configuration')
    } finally {
      setSavingAssistant(false)
    }
  }

  async function saveNotifications() {
    setSavingNotifs(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationsOn }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Notification preferences saved')
    } catch {
      toast.error('Failed to save preferences')
    } finally {
      setSavingNotifs(false)
    }
  }

  async function clearAllMemory() {
    if (!confirm('Clear all NEXUS memory? This cannot be undone.')) return
    setClearingMemory(true)
    try {
      const res = await fetch('/api/memory', { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      toast.success('All memory cleared')
    } catch {
      toast.error('Failed to clear memory')
    } finally {
      setClearingMemory(false)
    }
  }

  async function exportData() {
    setExportingData(true)
    try {
      const [tasksRes, notesRes, remindersRes, memoryRes, convsRes, agentsRes] = await Promise.all([
        fetch('/api/tasks'),
        fetch('/api/notes'),
        fetch('/api/reminders'),
        fetch('/api/memory'),
        fetch('/api/conversations'),
        fetch('/api/agents'),
      ])
      const [tasksData, notesData, remindersData, memoryData, convsData, agentsData] = await Promise.all([
        tasksRes.json(),
        notesRes.json(),
        remindersRes.json(),
        memoryRes.json(),
        convsRes.json(),
        agentsRes.json(),
      ])
      const exportPayload = {
        exportedAt: new Date().toISOString(),
        tasks: tasksData.tasks ?? [],
        notes: notesData.notes ?? [],
        reminders: remindersData.reminders ?? [],
        memories: memoryData.memories ?? [],
        conversations: convsData.conversations ?? [],
        agents: agentsData.agents ?? [],
      }
      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `nexus-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Data exported successfully')
    } catch {
      toast.error('Failed to export data')
    } finally {
      setExportingData(false)
    }
  }

  // ── Sections ────────────────────────────────────────────────────────────────
  const sections = [
    { id: 'profile', icon: User, label: 'Profile' },
    { id: 'assistant', icon: Cpu, label: 'Assistant' },
    { id: 'notifications', icon: Bell, label: 'Notifications' },
    { id: 'privacy', icon: Shield, label: 'Privacy & Security' },
    { id: 'api', icon: Key, label: 'API Keys' },
  ]

  const notifItems: { key: keyof typeof notifTypes; label: string; desc: string }[] = [
    { key: 'taskReminders', label: 'Task reminders', desc: 'Get notified when tasks are due' },
    { key: 'reminderAlerts', label: 'Reminder alerts', desc: 'Push notifications for your reminders' },
    { key: 'dailyBriefing', label: 'Daily briefing', desc: 'Morning summary of your day' },
    { key: 'automationReports', label: 'Automation reports', desc: 'Get notified when automations run' },
    { key: 'importantEmails', label: 'Important emails', desc: 'Alert when important emails detected' },
  ]

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Settings" subtitle="Configure your NEXUS system" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-4">
            {/* Sidebar */}
            <div className="w-48 flex-shrink-0">
              <nav className="space-y-1">
                {sections.map(s => {
                  const Icon = s.icon
                  return (
                    <button
                      key={s.id}
                      onClick={() => setActiveSection(s.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all ${
                        activeSection === s.id
                          ? 'bg-cyan-400/10 border border-cyan-400/20 text-cyan-400'
                          : 'text-white/50 hover:text-white/70 hover:bg-white/5'
                      }`}
                    >
                      <Icon size={15} />
                      {s.label}
                    </button>
                  )
                })}
              </nav>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">

              {/* ── Profile ── */}
              {activeSection === 'profile' && (
                <div className="glass-panel rounded-2xl p-6 space-y-4">
                  <h2 className="text-white font-semibold flex items-center gap-2">
                    <User size={16} className="text-cyan-400" /> Profile
                  </h2>
                  <div className="flex items-center gap-4 pb-4 border-b border-white/5">
                    <div className="w-16 h-16 rounded-full border-2 border-cyan-400/20 bg-gradient-to-br from-cyan-900/40 to-violet-900/40 flex items-center justify-center text-2xl">
                      {displayName?.charAt(0).toUpperCase() || session?.user?.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div>
                      <p className="text-white font-medium">{displayName || session?.user?.name || 'User'}</p>
                      <p className="text-white/40 text-sm">{email || session?.user?.email}</p>
                      <p className="text-cyan-400/60 text-xs mt-1">NEXUS Account</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-white/50 text-xs uppercase tracking-wider mb-1.5 block">Display Name</label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                        className="nexus-input"
                      />
                    </div>
                    <div>
                      <label className="text-white/50 text-xs uppercase tracking-wider mb-1.5 block">Email</label>
                      <input
                        type="email"
                        value={email}
                        className="nexus-input"
                        disabled
                      />
                    </div>
                  </div>
                  <button
                    onClick={saveProfile}
                    disabled={savingProfile}
                    className="nexus-btn-primary flex items-center gap-2 text-sm disabled:opacity-60"
                  >
                    {savingProfile ? (
                      <span className="w-3.5 h-3.5 border border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Save size={14} />
                    )}
                    {savingProfile ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              )}

              {/* ── Assistant ── */}
              {activeSection === 'assistant' && (
                <div className="glass-panel rounded-2xl p-6 space-y-4">
                  <h2 className="text-white font-semibold flex items-center gap-2">
                    <Cpu size={16} className="text-cyan-400" /> Assistant Configuration
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <label className="text-white/50 text-xs uppercase tracking-wider mb-1.5 block">Assistant Name</label>
                      <input
                        type="text"
                        value={assistantName}
                        onChange={e => setAssistantName(e.target.value)}
                        className="nexus-input"
                      />
                    </div>

                    {/* AI Provider toggle */}
                    <div>
                      <label className="text-white/50 text-xs uppercase tracking-wider mb-1.5 block">AI Provider</label>
                      <div className="flex rounded-lg border border-white/10 overflow-hidden w-fit">
                        <button
                          type="button"
                          onClick={() => setAiProvider('anthropic')}
                          className={`px-4 py-2 text-sm transition-all ${
                            aiProvider === 'anthropic'
                              ? 'bg-cyan-400/20 text-cyan-400 border-r border-cyan-400/30'
                              : 'text-white/50 hover:text-white/70 hover:bg-white/5 border-r border-white/10'
                          }`}
                        >
                          Anthropic
                        </button>
                        <button
                          type="button"
                          onClick={() => setAiProvider('openai')}
                          className={`px-4 py-2 text-sm transition-all ${
                            aiProvider === 'openai'
                              ? 'bg-cyan-400/20 text-cyan-400'
                              : 'text-white/50 hover:text-white/70 hover:bg-white/5'
                          }`}
                        >
                          OpenAI
                        </button>
                      </div>
                    </div>

                    {/* Anthropic model select */}
                    {aiProvider === 'anthropic' && (
                      <div>
                        <label className="text-white/50 text-xs uppercase tracking-wider mb-1.5 block">AI Model</label>
                        <select
                          value={aiModel}
                          onChange={e => setAiModel(e.target.value)}
                          className="nexus-input"
                        >
                          <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (Recommended)</option>
                          <option value="claude-opus-4-7">Claude Opus 4.7 (Most Capable)</option>
                          <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (Fastest)</option>
                        </select>
                      </div>
                    )}

                    {/* OpenAI fields */}
                    {aiProvider === 'openai' && (
                      <>
                        <div>
                          <label className="text-white/50 text-xs uppercase tracking-wider mb-1.5 block">OpenAI Model</label>
                          <select
                            value={openaiModel}
                            onChange={e => setOpenaiModel(e.target.value)}
                            className="nexus-input"
                          >
                            <option value="gpt-4o">GPT-4o (Recommended)</option>
                            <option value="gpt-4o-mini">GPT-4o Mini (Faster)</option>
                            <option value="gpt-4-turbo">GPT-4 Turbo</option>
                            <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Fastest)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-white/50 text-xs uppercase tracking-wider mb-1.5 block">OpenAI API Key</label>
                          <input
                            type="password"
                            value={openaiKey}
                            onChange={e => setOpenaiKey(e.target.value)}
                            placeholder="sk-..."
                            className="nexus-input"
                          />
                          <p className="text-white/30 text-xs mt-1">Stored securely. Leave blank to use server-side OPENAI_API_KEY.</p>
                        </div>
                      </>
                    )}

                    <div>
                      <label className="text-white/50 text-xs uppercase tracking-wider mb-1.5 block">Timezone</label>
                      <input
                        type="text"
                        value={timezone}
                        onChange={e => setTimezone(e.target.value)}
                        placeholder="UTC"
                        className="nexus-input"
                      />
                    </div>

                    <div>
                      <label className="text-white/50 text-xs uppercase tracking-wider mb-1.5 block">Language</label>
                      <select value={language} onChange={e => setLanguage(e.target.value)} className="nexus-input">
                        <option value="en">English</option>
                        <option value="es">Spanish — Español</option>
                        <option value="fr">French — Français</option>
                        <option value="de">German — Deutsch</option>
                        <option value="ja">Japanese — 日本語</option>
                        <option value="zh">Chinese — 中文</option>
                        <option value="pt">Portuguese — Português</option>
                        <option value="hi">Hindi — हिन्दी</option>
                        <option value="ar">Arabic — العربية</option>
                        <option value="ko">Korean — 한국어</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-white/50 text-xs uppercase tracking-wider mb-1.5 block">Theme</label>
                      <div className="flex rounded-lg border border-white/10 overflow-hidden w-fit">
                        {(['dark', 'light'] as const).map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => {
                              setTheme(t)
                              if (t === 'light') document.documentElement.classList.add('light-mode')
                              else document.documentElement.classList.remove('light-mode')
                            }}
                            className={`px-5 py-2 text-sm capitalize transition-all ${
                              theme === t
                                ? 'bg-cyan-400/20 text-cyan-400'
                                : 'text-white/50 hover:text-white/70 hover:bg-white/5'
                            } ${t === 'dark' ? 'border-r border-white/10' : ''}`}
                          >
                            {t === 'dark' ? '🌙 Dark' : '☀️ Light'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Memory toggle */}
                    <div className="flex items-center justify-between p-3 rounded-lg border border-white/5">
                      <div>
                        <p className="text-white/70 text-sm">Memory System</p>
                        <p className="text-white/35 text-xs">Allow NEXUS to remember preferences and context</p>
                      </div>
                      <Toggle enabled={memoryEnabled} onChange={setMemoryEnabled} />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg border border-white/5">
                      <div>
                        <p className="text-white/70 text-sm">Voice Commands</p>
                        <p className="text-white/35 text-xs">Enable push-to-talk voice input</p>
                      </div>
                      <Toggle enabled={voiceEnabled} onChange={setVoiceEnabled} />
                    </div>
                  </div>
                  <button
                    onClick={saveAssistant}
                    disabled={savingAssistant}
                    className="nexus-btn-primary flex items-center gap-2 text-sm disabled:opacity-60"
                  >
                    {savingAssistant ? (
                      <span className="w-3.5 h-3.5 border border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Save size={14} />
                    )}
                    {savingAssistant ? 'Saving…' : 'Save Configuration'}
                  </button>
                </div>
              )}

              {/* ── Notifications ── */}
              {activeSection === 'notifications' && (
                <div className="glass-panel rounded-2xl p-6 space-y-4">
                  <h2 className="text-white font-semibold flex items-center gap-2">
                    <Bell size={16} className="text-cyan-400" /> Notifications
                  </h2>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-cyan-400/10 bg-cyan-400/5">
                    <div>
                      <p className="text-white/80 text-sm font-medium">All Notifications</p>
                      <p className="text-white/35 text-xs">Master toggle for all notification types</p>
                    </div>
                    <Toggle enabled={notificationsOn} onChange={setNotificationsOn} />
                  </div>
                  <div className="space-y-2">
                    {notifItems.map(item => (
                      <div key={item.key} className="flex items-center justify-between p-3 rounded-lg border border-white/5">
                        <div>
                          <p className="text-white/70 text-sm">{item.label}</p>
                          <p className="text-white/35 text-xs">{item.desc}</p>
                        </div>
                        <Toggle
                          enabled={notifTypes[item.key]}
                          onChange={v => setNotifTypes(prev => ({ ...prev, [item.key]: v }))}
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={saveNotifications}
                    disabled={savingNotifs}
                    className="nexus-btn-primary flex items-center gap-2 text-sm disabled:opacity-60"
                  >
                    {savingNotifs ? (
                      <span className="w-3.5 h-3.5 border border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Save size={14} />
                    )}
                    {savingNotifs ? 'Saving…' : 'Save Preferences'}
                  </button>
                </div>
              )}

              {/* ── Privacy ── */}
              {activeSection === 'privacy' && (
                <div className="glass-panel rounded-2xl p-6 space-y-4">
                  <h2 className="text-white font-semibold flex items-center gap-2">
                    <Shield size={16} className="text-cyan-400" /> Privacy & Security
                  </h2>
                  <div className="space-y-3">
                    {[
                      { title: 'Data Retention', desc: 'Conversations and activity logs are kept for 90 days by default' },
                      { title: 'Memory Control', desc: 'NEXUS memory can be fully cleared at any time using the button below' },
                      { title: 'Encrypted Storage', desc: 'All sensitive data is encrypted at rest and in transit' },
                      { title: 'OAuth Security', desc: 'Third-party integrations use OAuth 2.0 — we never store passwords' },
                      { title: 'Audit Logs', desc: 'All NEXUS actions are logged and visible in the Activity Log' },
                    ].map(item => (
                      <div key={item.title} className="p-3 rounded-lg border border-white/5 flex items-start gap-3">
                        <Shield size={14} className="text-cyan-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-white/70 text-sm font-medium">{item.title}</p>
                          <p className="text-white/35 text-xs mt-0.5">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-white/5 flex flex-wrap gap-3">
                    <button
                      onClick={clearAllMemory}
                      disabled={clearingMemory}
                      className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg border transition-all disabled:opacity-60 text-red-400 border-red-400/20 hover:border-red-400/40 hover:bg-red-400/5"
                    >
                      {clearingMemory ? (
                        <span className="w-3.5 h-3.5 border border-red-400/40 border-t-red-400 rounded-full animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                      {clearingMemory ? 'Clearing…' : 'Clear All Memory'}
                    </button>
                    <button
                      onClick={exportData}
                      disabled={exportingData}
                      className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg border transition-all disabled:opacity-60 text-cyan-400 border-cyan-400/20 hover:border-cyan-400/40 hover:bg-cyan-400/5"
                    >
                      {exportingData ? (
                        <span className="w-3.5 h-3.5 border border-cyan-400/40 border-t-cyan-400 rounded-full animate-spin" />
                      ) : (
                        <Download size={14} />
                      )}
                      {exportingData ? 'Exporting…' : 'Export Data'}
                    </button>
                  </div>
                </div>
              )}

              {/* ── API Keys ── */}
              {activeSection === 'api' && (
                <div className="glass-panel rounded-2xl p-6 space-y-4">
                  <h2 className="text-white font-semibold flex items-center gap-2">
                    <Key size={16} className="text-cyan-400" /> API Configuration
                  </h2>
                  <p className="text-white/40 text-sm">
                    API keys are configured server-side via environment variables for security.
                    Contact your system administrator to update API credentials.
                  </p>
                  <div className="space-y-3">
                    {[
                      { name: 'Anthropic API', key: 'ANTHROPIC_API_KEY', status: 'configured' },
                      { name: 'Google OAuth', key: 'GOOGLE_CLIENT_ID', status: 'optional' },
                      { name: 'GitHub OAuth', key: 'GITHUB_CLIENT_ID', status: 'optional' },
                    ].map(item => (
                      <div key={item.name} className="flex items-center justify-between p-3 rounded-lg border border-white/5">
                        <div>
                          <p className="text-white/70 text-sm">{item.name}</p>
                          <p className="text-white/30 text-xs nexus-mono">{item.key}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full border ${
                          item.status === 'configured' ? 'text-green-400 border-green-400/30' :
                          item.status === 'missing' ? 'text-red-400 border-red-400/30' :
                          'text-white/30 border-white/10'
                        }`}>
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
