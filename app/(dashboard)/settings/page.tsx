'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/layout/header'
import { Settings, User, Bell, Shield, Brain, Cpu, Key, Save } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const { data: session } = useSession()
  const [saving, setSaving] = useState(false)
  const [activeSection, setActiveSection] = useState('profile')

  const sections = [
    { id: 'profile', icon: User, label: 'Profile' },
    { id: 'assistant', icon: Cpu, label: 'Assistant' },
    { id: 'notifications', icon: Bell, label: 'Notifications' },
    { id: 'privacy', icon: Shield, label: 'Privacy & Security' },
    { id: 'api', icon: Key, label: 'API Keys' },
  ]

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
              {activeSection === 'profile' && (
                <div className="glass-panel rounded-2xl p-6 space-y-4">
                  <h2 className="text-white font-semibold flex items-center gap-2">
                    <User size={16} className="text-cyan-400" /> Profile
                  </h2>
                  <div className="flex items-center gap-4 pb-4 border-b border-white/5">
                    <div className="w-16 h-16 rounded-full border-2 border-cyan-400/20 bg-gradient-to-br from-cyan-900/40 to-violet-900/40 flex items-center justify-center text-2xl">
                      {session?.user?.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div>
                      <p className="text-white font-medium">{session?.user?.name || 'User'}</p>
                      <p className="text-white/40 text-sm">{session?.user?.email}</p>
                      <p className="text-cyan-400/60 text-xs mt-1">NEXUS Account</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-white/50 text-xs uppercase tracking-wider mb-1.5 block">Display Name</label>
                      <input type="text" defaultValue={session?.user?.name || ''} className="nexus-input" />
                    </div>
                    <div>
                      <label className="text-white/50 text-xs uppercase tracking-wider mb-1.5 block">Email</label>
                      <input type="email" defaultValue={session?.user?.email || ''} className="nexus-input" disabled />
                    </div>
                  </div>
                  <button className="nexus-btn-primary flex items-center gap-2 text-sm">
                    <Save size={14} /> Save Changes
                  </button>
                </div>
              )}

              {activeSection === 'assistant' && (
                <div className="glass-panel rounded-2xl p-6 space-y-4">
                  <h2 className="text-white font-semibold flex items-center gap-2">
                    <Cpu size={16} className="text-cyan-400" /> Assistant Configuration
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <label className="text-white/50 text-xs uppercase tracking-wider mb-1.5 block">Assistant Name</label>
                      <input type="text" defaultValue="NEXUS" className="nexus-input" />
                    </div>
                    <div>
                      <label className="text-white/50 text-xs uppercase tracking-wider mb-1.5 block">AI Model</label>
                      <select className="nexus-input">
                        <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (Recommended)</option>
                        <option value="claude-opus-4-7">Claude Opus 4.7 (Most Capable)</option>
                        <option value="claude-haiku-4-5">Claude Haiku 4.5 (Fastest)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-white/50 text-xs uppercase tracking-wider mb-1.5 block">Timezone</label>
                      <input type="text" placeholder="UTC" className="nexus-input" />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-white/5">
                      <div>
                        <p className="text-white/70 text-sm">Voice Commands</p>
                        <p className="text-white/35 text-xs">Enable push-to-talk voice input</p>
                      </div>
                      <div className="w-10 h-5 bg-cyan-400/30 rounded-full border border-cyan-400/40" />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-white/5">
                      <div>
                        <p className="text-white/70 text-sm">Proactive Suggestions</p>
                        <p className="text-white/35 text-xs">Allow NEXUS to proactively suggest actions</p>
                      </div>
                      <div className="w-10 h-5 bg-cyan-400/30 rounded-full border border-cyan-400/40" />
                    </div>
                  </div>
                  <button className="nexus-btn-primary flex items-center gap-2 text-sm">
                    <Save size={14} /> Save Configuration
                  </button>
                </div>
              )}

              {activeSection === 'privacy' && (
                <div className="glass-panel rounded-2xl p-6 space-y-4">
                  <h2 className="text-white font-semibold flex items-center gap-2">
                    <Shield size={16} className="text-cyan-400" /> Privacy & Security
                  </h2>
                  <div className="space-y-3">
                    {[
                      { title: 'Data Retention', desc: 'Conversations and activity logs are kept for 90 days by default' },
                      { title: 'Memory Control', desc: 'NEXUS memory can be fully cleared at any time from the Memory page' },
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
                  <div className="pt-2 border-t border-white/5">
                    <button className="text-red-400 hover:text-red-300 text-sm border border-red-400/20 hover:border-red-400/40 px-4 py-2 rounded-lg transition-all">
                      Delete All My Data
                    </button>
                  </div>
                </div>
              )}

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
                      { name: 'Anthropic API', key: 'ANTHROPIC_API_KEY', status: process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing' },
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

              {activeSection === 'notifications' && (
                <div className="glass-panel rounded-2xl p-6 space-y-4">
                  <h2 className="text-white font-semibold flex items-center gap-2">
                    <Bell size={16} className="text-cyan-400" /> Notifications
                  </h2>
                  {[
                    { label: 'Task reminders', desc: 'Get notified when tasks are due' },
                    { label: 'Reminder alerts', desc: 'Push notifications for your reminders' },
                    { label: 'Daily briefing', desc: 'Morning summary of your day' },
                    { label: 'Automation reports', desc: 'Get notified when automations run' },
                    { label: 'Important emails', desc: 'Alert when important emails detected' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between p-3 rounded-lg border border-white/5">
                      <div>
                        <p className="text-white/70 text-sm">{item.label}</p>
                        <p className="text-white/35 text-xs">{item.desc}</p>
                      </div>
                      <div className="w-10 h-5 bg-cyan-400/30 rounded-full border border-cyan-400/40 cursor-pointer" />
                    </div>
                  ))}
                  <button className="nexus-btn-primary flex items-center gap-2 text-sm">
                    <Save size={14} /> Save Preferences
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
