'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Puzzle, Check, Clock, AlertCircle, ExternalLink, RefreshCw, Unlink, Bell, Map } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useSearchParams } from 'next/navigation'

interface IntegrationStatus {
  status: 'connected' | 'disconnected' | 'error' | 'coming_soon' | 'future'
  metadata?: { email?: string; name?: string; connectedAt?: string }
  connectedAt?: string
}

const ALL_INTEGRATIONS = [
  // --- Existing ---
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
    id: 'spotify',
    name: 'Spotify',
    icon: '🟢',
    description: 'Music control and listening history',
    features: ['Now playing', 'Playlist control', 'Focus music'],
    phase: 4,
    category: 'entertainment',
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

  // --- Development ---
  {
    id: 'gitlab',
    name: 'GitLab',
    icon: '🦊',
    description: 'Repositories, merge requests, CI/CD pipelines',
    features: ['MR summaries', 'Pipeline alerts', 'Issue tracking'],
    phase: 5,
    connectPath: undefined,
    category: 'development',
  },
  {
    id: 'jira',
    name: 'Jira',
    icon: '🔵',
    description: 'Project tracking, sprints, issue management',
    features: ['Sprint overview', 'Issue creation', 'Status updates'],
    phase: 5,
    category: 'development',
  },
  {
    id: 'linear',
    name: 'Linear',
    icon: '🟣',
    description: 'Modern issue tracker for engineering teams',
    features: ['Issue sync', 'Cycle tracking', 'Team overview'],
    phase: 5,
    category: 'development',
  },
  {
    id: 'docker',
    name: 'Docker Hub',
    icon: '🐳',
    description: 'Container images, builds, and deployments',
    features: ['Image list', 'Build status', 'Pull metrics'],
    phase: 6,
    category: 'development',
  },

  // --- Productivity ---
  {
    id: 'todoist',
    name: 'Todoist',
    icon: '🔴',
    description: 'Import tasks and projects from Todoist',
    features: ['Task import', 'Project sync', 'Label mapping'],
    phase: 4,
    category: 'productivity',
  },
  {
    id: 'asana',
    name: 'Asana',
    icon: '🌸',
    description: 'Projects, tasks, and team workflows',
    features: ['Task import', 'Project view', 'Deadline sync'],
    phase: 4,
    category: 'productivity',
  },

  // --- Communication ---
  {
    id: 'discord',
    name: 'Discord',
    icon: '💙',
    description: 'Server notifications and message summaries',
    features: ['Channel alerts', 'Message digest', 'Bot commands'],
    phase: 4,
    category: 'communication',
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    icon: '🟦',
    description: 'Meeting summaries, chat and channel digest',
    features: ['Meeting intel', 'Chat digest', 'Calendar sync'],
    phase: 4,
    category: 'communication',
  },
  {
    id: 'outlook',
    name: 'Outlook',
    icon: '📧',
    description: 'Microsoft email and calendar integration',
    features: ['Email sync', 'Calendar events', 'Contact management'],
    phase: 5,
    category: 'communication',
  },

  // --- Finance ---
  {
    id: 'stripe',
    name: 'Stripe',
    icon: '💳',
    description: 'Payment analytics, subscription tracking',
    features: ['Revenue dashboard', 'Subscription alerts', 'Invoice summaries'],
    phase: 5,
    category: 'finance',
  },
  {
    id: 'plaid',
    name: 'Plaid',
    icon: '🏦',
    description: 'Bank account balance and transaction tracking',
    features: ['Balance sync', 'Transaction digest', 'Spending analysis'],
    phase: 6,
    category: 'finance',
  },

  // --- Health ---
  {
    id: 'apple_health',
    name: 'Apple Health',
    icon: '🍎',
    description: 'Steps, sleep, heart rate, and workout data',
    features: ['Daily steps', 'Sleep tracking', 'Heart rate trends'],
    phase: 5,
    category: 'health',
  },
  {
    id: 'fitbit',
    name: 'Fitbit',
    icon: '🏃',
    description: 'Fitness tracking, sleep scores, and health metrics',
    features: ['Activity sync', 'Sleep analysis', 'Goal tracking'],
    phase: 6,
    category: 'health',
  },
  {
    id: 'oura',
    name: 'Oura Ring',
    icon: '💍',
    description: 'Sleep, readiness, and recovery scores',
    features: ['Sleep stage data', 'HRV tracking', 'Readiness score'],
    phase: 6,
    category: 'health',
  },

  // --- Infrastructure ---
  {
    id: 'datadog',
    name: 'Datadog',
    icon: '🐕',
    description: 'APM metrics, logs, and infrastructure monitoring',
    features: ['Alert digest', 'Metric queries', 'Log search'],
    phase: 6,
    category: 'infrastructure',
  },
  {
    id: 'pagerduty',
    name: 'PagerDuty',
    icon: '🚨',
    description: 'Incident alerts and on-call schedule',
    features: ['Incident alerts', 'On-call status', 'Runbook assist'],
    phase: 6,
    category: 'infrastructure',
  },
]

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All',
  productivity: 'Productivity',
  development: 'Development',
  communication: 'Communication',
  finance: 'Finance',
  health: 'Health',
  infrastructure: 'Infrastructure',
  entertainment: 'Entertainment',
  smart_home: 'Smart Home',
}

const FILTER_TABS = ['all', 'productivity', 'development', 'communication', 'finance', 'health', 'infrastructure']

const PHASE_LABELS: Record<number, string> = {
  2: 'Available Now',
  3: 'Phase 3',
  4: 'Phase 4',
  5: 'Phase 5',
  6: 'Phase 6',
}

const ROADMAP_PHASES = [
  { phase: 3, label: 'Phase 3 — Current', items: ['Google', 'GitHub'] },
  { phase: 4, label: 'Phase 4 — Next', items: ['Notion', 'Slack', 'Home Assistant', 'Discord'] },
  { phase: 5, label: 'Phase 5 — Planned', items: ['GitLab', 'Jira', 'Linear', 'Outlook', 'Stripe', 'Apple Health'] },
  { phase: 6, label: 'Phase 6 — Future', items: ['Plaid', 'Fitbit', 'Oura Ring', 'Datadog', 'PagerDuty', 'Docker Hub'] },
]

export default function IntegrationsPage() {
  const [statuses, setStatuses] = useState<Record<string, IntegrationStatus>>({})
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>('all')
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

  function notifyMe(name: string) {
    toast.success(`You'll be notified when ${name} integration launches!`, { duration: 3500 })
  }

  function getStatus(id: string): 'connected' | 'disconnected' | 'error' | 'available' | 'coming_soon' {
    const db = statuses[id]
    if (db?.status === 'connected') return 'connected'
    if (db?.status === 'error') return 'error'
    const int = ALL_INTEGRATIONS.find(i => i.id === id)
    if (int && int.phase <= 2) return 'available'
    return 'coming_soon'
  }

  const connectedCount = Object.values(statuses).filter(s => s.status === 'connected').length
  const totalCount = ALL_INTEGRATIONS.length

  const filteredIntegrations = activeTab === 'all'
    ? ALL_INTEGRATIONS
    : ALL_INTEGRATIONS.filter(i => i.category === activeTab)

  const categorized = filteredIntegrations.reduce((acc, int) => {
    if (!acc[int.category]) acc[int.category] = []
    acc[int.category].push(int)
    return acc
  }, {} as Record<string, typeof ALL_INTEGRATIONS>)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Integrations"
        subtitle={`${connectedCount} connected · ${totalCount} available`}
      />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-5xl mx-auto space-y-5">

          {/* Header banner */}
          <div className="glass-panel rounded-xl p-4 border border-cyan-400/15 flex items-start gap-3">
            <Puzzle size={18} className="text-cyan-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-white/70 text-sm font-medium">Integration Hub — Phase 2 Active</p>
              <p className="text-white/40 text-xs mt-0.5">
                Connect NEXUS to your apps and services. Google (Gmail + Calendar) and GitHub are available now.
                More integrations arrive with each phase.
              </p>
            </div>
            <button onClick={fetchStatuses} className="text-white/30 hover:text-cyan-400 transition-colors flex-shrink-0">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Category filter tabs */}
          <div className="flex flex-wrap gap-2">
            {FILTER_TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                  activeTab === tab
                    ? 'border-cyan-400/60 text-cyan-400 bg-cyan-400/10'
                    : 'border-white/10 text-white/40 hover:text-white/60 hover:border-white/20'
                }`}
              >
                {CATEGORY_LABELS[tab]}
              </button>
            ))}
          </div>

          {/* Integrations by category */}
          {Object.entries(categorized).map(([category, ints]) => (
            <div key={category}>
              <p className="text-white/30 text-xs uppercase tracking-wider mb-2 px-1">
                {CATEGORY_LABELS[category] || category}
              </p>
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
                          <button
                            onClick={() => notifyMe(integration.name)}
                            className="nexus-btn-secondary text-xs py-2 flex-1 flex items-center justify-center gap-1.5 text-white/40 hover:text-cyan-400 hover:border-cyan-400/30 transition-colors"
                          >
                            <Bell size={12} /> Notify me
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Integration Roadmap */}
          <div className="glass-panel rounded-xl p-5 border border-white/8">
            <div className="flex items-center gap-2 mb-4">
              <Map size={16} className="text-cyan-400" />
              <p className="text-white/70 text-sm font-medium">Integration Roadmap</p>
            </div>
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-3 top-2 bottom-2 w-px bg-white/10" />
              <div className="space-y-5">
                {ROADMAP_PHASES.map((rp, idx) => (
                  <div key={rp.phase} className="flex gap-4 relative">
                    <div className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center z-10 ${
                      idx === 0
                        ? 'border-cyan-400 bg-cyan-400/20'
                        : idx === 1
                        ? 'border-cyan-400/50 bg-cyan-400/10'
                        : 'border-white/20 bg-white/5'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        idx === 0 ? 'bg-cyan-400' : idx === 1 ? 'bg-cyan-400/50' : 'bg-white/20'
                      }`} />
                    </div>
                    <div className="flex-1 pb-1">
                      <p className={`text-xs font-medium mb-1.5 ${
                        idx === 0 ? 'text-cyan-400' : idx === 1 ? 'text-white/60' : 'text-white/35'
                      }`}>
                        {rp.label}
                        {idx === 0 && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-400/15 text-cyan-400 border border-cyan-400/30">
                            active
                          </span>
                        )}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {rp.items.map(item => (
                          <span key={item} className={`text-[10px] px-2 py-0.5 rounded border ${
                            idx === 0
                              ? 'border-cyan-400/25 text-cyan-400/80 bg-cyan-400/5'
                              : idx === 1
                              ? 'border-white/15 text-white/45 bg-white/4'
                              : 'border-white/8 text-white/25'
                          }`}>
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
