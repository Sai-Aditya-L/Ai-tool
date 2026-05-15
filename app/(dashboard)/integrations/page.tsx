'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Puzzle, Check, Clock, AlertCircle, ExternalLink, RefreshCw, Unlink } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useSearchParams } from 'next/navigation'

interface IntegrationStatus {
  status: 'connected' | 'disconnected' | 'error' | 'coming_soon' | 'future'
  metadata?: { email?: string; name?: string; connectedAt?: string }
  connectedAt?: string
}

const ALL_INTEGRATIONS = [
  {
    id: 'google',
    name: 'Google',
    icon: '🔵',
    description: 'Gmail, Google Calendar, Google Drive',
    features: ['Email sync', 'Calendar events', 'Drive files'],
    phase: 2,
    connectPath: '/api/integrations/google/auth',
    category: 'productivity',
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: '⚫',
    description: 'Repositories, PRs, issues',
    features: ['Repo summary', 'PR notifications', 'Issue tracking'],
    phase: 2,
    connectPath: '/api/integrations/github/auth',
    category: 'development',
  },
  {
    id: 'notion',
    name: 'Notion',
    icon: '⬜',
    description: 'Notes, databases, pages',
    features: ['Page sync', 'Database queries', 'Notes export'],
    phase: 3,
    category: 'productivity',
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: '💜',
    description: 'Messages, channels, notifications',
    features: ['Message alerts', 'Channel summary', 'Status updates'],
    phase: 3,
    category: 'communication',
  },
  {
    id: 'outlook',
    name: 'Outlook',
    icon: '🔷',
    description: 'Microsoft email and calendar',
    features: ['Email sync', 'Calendar events', 'Task sync'],
    phase: 3,
    category: 'productivity',
  },
  {
    id: 'spotify',
    name: 'Spotify',
    icon: '🟢',
    description: 'Music control and listening history',
    features: ['Now playing', 'Playlist control', 'Focus music'],
    phase: 4,
    category: 'entertainment',
  },
  {
    id: 'todoist',
    name: 'Todoist',
    icon: '🔴',
    description: 'Import and sync tasks',
    features: ['Task import', 'Project sync', 'Two-way sync'],
    phase: 3,
    category: 'productivity',
  },
  {
    id: 'discord',
    name: 'Discord',
    icon: '🟣',
    description: 'Server notifications and summaries',
    features: ['Notification alerts', 'Channel summary', 'Mention tracking'],
    phase: 4,
    category: 'communication',
  },
  {
    id: 'home_assistant',
    name: 'Home Assistant',
    icon: '🏠',
    description: 'Smart home automation',
    features: ['Device control', 'Scene automation', 'Energy monitoring'],
    phase: 5,
    category: 'smart_home',
  },
  {
    id: 'vscode',
    name: 'VS Code',
    icon: '💙',
    description: 'IDE integration for dev workflows',
    features: ['Code review', 'PR summaries', 'Debug assistance'],
    phase: 4,
    category: 'development',
  },
  {
    id: 'linear',
    name: 'Linear',
    icon: '⬛',
    description: 'Issue tracking and project management',
    features: ['Issue sync', 'Sprint tracking', 'PR linking'],
    phase: 4,
    category: 'development',
  },
  {
    id: 'jira',
    name: 'Jira',
    icon: '🔵',
    description: 'Project tracking and bug management',
    features: ['Ticket sync', 'Sprint board', 'Deadline alerts'],
    phase: 4,
    category: 'development',
  },
]

const CATEGORY_LABELS: Record<string, string> = {
  productivity: 'Productivity',
  development: 'Development',
  communication: 'Communication',
  entertainment: 'Entertainment',
  smart_home: 'Smart Home',
}

const PHASE_LABELS: Record<number, string> = {
  2: 'Available Now',
  3: 'Phase 3',
  4: 'Phase 4',
  5: 'Phase 5',
}

export default function IntegrationsPage() {
  const [statuses, setStatuses] = useState<Record<string, IntegrationStatus>>({})
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    if (success === 'google_connected') toast.success('Google account connected successfully!')
    if (success === 'github_connected') toast.success('GitHub account connected successfully!')
    if (error === 'google_denied') toast.error('Google authorization was denied')
    if (error === 'github_denied') toast.error('GitHub authorization was denied')
    if (error === 'oauth_failed') toast.error('OAuth connection failed. Try again.')
    fetchStatuses()
  }, [])

  async function fetchStatuses() {
    setLoading(true)
    try {
      const res = await fetch('/api/integrations/status')
      const data = await res.json()
      setStatuses(data.integrations || {})
    } catch {
      toast.error('Failed to load integration statuses')
    } finally {
      setLoading(false)
    }
  }

  async function disconnect(provider: string) {
    if (!confirm(`Disconnect ${provider}? This will remove access to your ${provider} data.`)) return
    setDisconnecting(provider)
    try {
      const res = await fetch(`/api/integrations/${provider}/disconnect`, { method: 'POST' })
      if (!res.ok) throw new Error()
      toast.success(`${provider} disconnected`)
      fetchStatuses()
    } catch {
      toast.error(`Failed to disconnect ${provider}`)
    } finally {
      setDisconnecting(null)
    }
  }

  const connectedCount = Object.values(statuses).filter(s => s.status === 'connected').length

  const categorized = ALL_INTEGRATIONS.reduce((acc, int) => {
    if (!acc[int.category]) acc[int.category] = []
    acc[int.category].push(int)
    return acc
  }, {} as Record<string, typeof ALL_INTEGRATIONS>)

  function getStatus(id: string): 'connected' | 'disconnected' | 'error' | 'available' | 'coming_soon' {
    const db = statuses[id]
    if (db?.status === 'connected') return 'connected'
    if (db?.status === 'error') return 'error'
    const int = ALL_INTEGRATIONS.find(i => i.id === id)
    if (int && int.phase <= 2) return 'available'
    return 'coming_soon'
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Integrations" subtitle={`${connectedCount} connected`} />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-5xl mx-auto space-y-5">

          {/* Header banner */}
          <div className="glass-panel rounded-xl p-4 border border-cyan-400/15 flex items-start gap-3">
            <Puzzle size={18} className="text-cyan-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-white/70 text-sm font-medium">Integration Hub — Phase 2 Active</p>
              <p className="text-white/40 text-xs mt-0.5">
                Connect NEXUS to your apps and services. Google (Gmail + Calendar) is available now.
                More integrations arrive with each phase.
              </p>
            </div>
            <button onClick={fetchStatuses} className="text-white/30 hover:text-cyan-400 transition-colors flex-shrink-0">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Integrations by category */}
          {Object.entries(categorized).map(([category, ints]) => (
            <div key={category}>
              <p className="text-white/30 text-xs uppercase tracking-wider mb-2 px-1">{CATEGORY_LABELS[category] || category}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {ints.map(integration => {
                  const status = getStatus(integration.id)
                  const dbStatus = statuses[integration.id]
                  return (
                    <div key={integration.id} className="glass-panel-hover rounded-xl p-4 flex flex-col gap-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{integration.icon}</span>
                          <div>
                            <p className="text-white/85 font-medium text-sm">{integration.name}</p>
                            <p className="text-white/40 text-xs">{integration.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                            status === 'connected' ? 'text-green-400 border-green-400/30 bg-green-400/5' :
                            status === 'error' ? 'text-red-400 border-red-400/30 bg-red-400/5' :
                            status === 'available' ? 'text-cyan-400 border-cyan-400/30 bg-cyan-400/5' :
                            'text-white/25 border-white/10'
                          }`}>
                            {status === 'connected' && <Check size={9} />}
                            {status === 'error' && <AlertCircle size={9} />}
                            {status === 'available' && <Clock size={9} />}
                            {status === 'connected' ? 'Connected' : status === 'error' ? 'Error' : status === 'available' ? 'Available' : `Phase ${integration.phase}`}
                          </span>
                        </div>
                      </div>

                      {/* Connected account info */}
                      {status === 'connected' && dbStatus?.metadata?.email && (
                        <div className="text-xs text-white/40 flex items-center gap-1.5 px-1">
                          <Check size={11} className="text-green-400" />
                          Connected as {dbStatus.metadata.email}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1.5">
                        {integration.features.map(f => (
                          <span key={f} className="text-[10px] text-white/35 bg-white/5 px-2 py-0.5 rounded">{f}</span>
                        ))}
                      </div>

                      {/* Action button */}
                      <div className="flex gap-2">
                        {status === 'connected' ? (
                          <button
                            onClick={() => disconnect(integration.id)}
                            disabled={disconnecting === integration.id}
                            className="nexus-btn-secondary text-xs py-2 flex-1 flex items-center justify-center gap-1.5 text-red-400/70 hover:text-red-400 disabled:opacity-50"
                          >
                            <Unlink size={12} />
                            {disconnecting === integration.id ? 'Disconnecting...' : 'Disconnect'}
                          </button>
                        ) : status === 'error' ? (
                          <Link href={(integration as any).connectPath || '#'} className="nexus-btn-primary text-xs py-2 flex-1 flex items-center justify-center gap-1.5">
                            <RefreshCw size={12} /> Reconnect
                          </Link>
                        ) : status === 'available' && (integration as any).connectPath ? (
                          <Link href={(integration as any).connectPath} className="nexus-btn-primary text-xs py-2 flex-1 flex items-center justify-center gap-1.5">
                            <ExternalLink size={12} /> Connect {integration.name}
                          </Link>
                        ) : (
                          <button disabled className="nexus-btn-secondary text-xs py-2 flex-1 flex items-center justify-center gap-1.5 opacity-40 cursor-not-allowed">
                            <Clock size={12} /> Coming {PHASE_LABELS[integration.phase] || `Phase ${integration.phase}`}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
