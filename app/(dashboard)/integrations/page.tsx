import { Header } from '@/components/layout/header'
import { Puzzle, Check, Clock, AlertCircle, ExternalLink } from 'lucide-react'

const INTEGRATIONS = [
  {
    id: 'google', name: 'Google', icon: '🔵', status: 'coming_soon',
    description: 'Gmail, Google Calendar, Google Drive, Google Tasks',
    features: ['Email sync', 'Calendar events', 'Drive files', 'Task import'],
  },
  {
    id: 'github', name: 'GitHub', icon: '⚫', status: 'coming_soon',
    description: 'Repository management, PR reviews, commit history',
    features: ['Repo summary', 'PR notifications', 'Issue tracking', 'Commit logs'],
  },
  {
    id: 'notion', name: 'Notion', icon: '⬜', status: 'coming_soon',
    description: 'Sync notes, databases, and pages',
    features: ['Page sync', 'Database queries', 'Task import', 'Notes export'],
  },
  {
    id: 'slack', name: 'Slack', icon: '💜', status: 'coming_soon',
    description: 'Messages, notifications, and channel monitoring',
    features: ['Message alerts', 'Channel summary', 'DM notifications', 'Status updates'],
  },
  {
    id: 'outlook', name: 'Outlook', icon: '🔷', status: 'coming_soon',
    description: 'Microsoft email and calendar integration',
    features: ['Email sync', 'Calendar events', 'Meeting alerts', 'Task sync'],
  },
  {
    id: 'spotify', name: 'Spotify', icon: '🟢', status: 'coming_soon',
    description: 'Music control and listening history',
    features: ['Now playing', 'Playlist control', 'Focus music', 'Listening stats'],
  },
  {
    id: 'todoist', name: 'Todoist', icon: '🔴', status: 'coming_soon',
    description: 'Import and sync tasks from Todoist',
    features: ['Task import', 'Project sync', 'Priority mapping', 'Two-way sync'],
  },
  {
    id: 'discord', name: 'Discord', icon: '🟣', status: 'coming_soon',
    description: 'Server notifications and message summaries',
    features: ['Notification alerts', 'Channel summary', 'Mention tracking', 'Event reminders'],
  },
  {
    id: 'home_assistant', name: 'Home Assistant', icon: '🏠', status: 'future',
    description: 'Smart home automation and device control',
    features: ['Device control', 'Scene automation', 'Energy monitoring', 'Security alerts'],
  },
  {
    id: 'vscode', name: 'VS Code', icon: '💙', status: 'future',
    description: 'IDE integration for development workflows',
    features: ['Code review', 'PR summaries', 'Debug assistance', 'Snippet generation'],
  },
]

export default function IntegrationsPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Integrations" subtitle="Connect your digital ecosystem" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-5xl mx-auto space-y-4">

          <div className="glass-panel rounded-xl p-4 border border-cyan-400/15 flex items-start gap-3">
            <Puzzle size={18} className="text-cyan-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-white/70 text-sm font-medium">Integration Hub</p>
              <p className="text-white/40 text-xs mt-0.5">
                Connect NEXUS to your apps and services. Integrations are being developed progressively —
                Phase 2 will bring Gmail and Google Calendar, with more following each release.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {INTEGRATIONS.map(integration => (
              <div key={integration.id} className="glass-panel-hover rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{integration.icon}</span>
                    <div>
                      <p className="text-white/85 font-medium">{integration.name}</p>
                      <p className="text-white/40 text-xs">{integration.description}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full border flex items-center gap-1 ${
                    integration.status === 'connected' ? 'text-green-400 border-green-400/30 bg-green-400/5' :
                    integration.status === 'coming_soon' ? 'text-yellow-400 border-yellow-400/30 bg-yellow-400/5' :
                    'text-white/30 border-white/10'
                  }`}>
                    {integration.status === 'connected' && <Check size={10} />}
                    {integration.status === 'coming_soon' && <Clock size={10} />}
                    {integration.status === 'future' && <AlertCircle size={10} />}
                    {integration.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {integration.features.map(f => (
                    <span key={f} className="text-[10px] text-white/35 bg-white/5 px-2 py-0.5 rounded">{f}</span>
                  ))}
                </div>
                {integration.status !== 'future' && (
                  <button
                    disabled={integration.status === 'coming_soon'}
                    className="nexus-btn-secondary text-xs py-2 flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ExternalLink size={12} />
                    {integration.status === 'connected' ? 'Manage' : 'Connect (Coming Phase 2)'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
