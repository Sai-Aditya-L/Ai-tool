'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import {
  Puzzle,
  Webhook,
  Key,
  Bot,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Check,
  Loader2,
  AlertTriangle,
  Send,
  ToggleLeft,
  ToggleRight,
  Edit2,
  X,
  ChevronDown,
  ChevronUp,
  Shield,
  Zap,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Plugin {
  id: string
  name: string
  description?: string | null
  toolName: string
  config: string
  isActive: boolean
  permissions: string
  createdAt: string
  updatedAt: string
}

interface WebhookEndpoint {
  id: string
  name: string
  url: string
  events: string
  secret?: string | null
  isActive: boolean
  lastTriggeredAt?: string | null
  createdAt: string
}

interface ApiKey {
  id: string
  name: string
  prefix: string
  permissions: string
  lastUsedAt?: string | null
  expiresAt?: string | null
  createdAt: string
}

interface AgentTemplate {
  id: string
  name: string
  role: string
  description?: string | null
  systemPrompt: string
  tools: string
  isPublic: boolean
  createdAt: string
}

type TabId = 'plugins' | 'webhooks' | 'api-keys' | 'agent-templates'

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'plugins',         label: 'Custom Plugins',   icon: <Puzzle size={14} /> },
  { id: 'webhooks',        label: 'Webhooks',          icon: <Webhook size={14} /> },
  { id: 'api-keys',        label: 'API Keys',          icon: <Key size={14} /> },
  { id: 'agent-templates', label: 'Agent Templates',   icon: <Bot size={14} /> },
]

const PLUGIN_PERMISSIONS = [
  { value: 'read_tasks',     label: 'Read Tasks' },
  { value: 'write_tasks',    label: 'Write Tasks' },
  { value: 'read_notes',     label: 'Read Notes' },
  { value: 'write_notes',    label: 'Write Notes' },
  { value: 'read_calendar',  label: 'Read Calendar' },
  { value: 'web_search',     label: 'Web Search' },
]

const WEBHOOK_EVENTS = [
  { value: 'task.created',      label: 'Task Created' },
  { value: 'task.completed',    label: 'Task Completed' },
  { value: 'reminder.triggered', label: 'Reminder Triggered' },
  { value: 'agent.completed',   label: 'Agent Completed' },
  { value: 'automation.run',    label: 'Automation Run' },
  { value: 'note.created',      label: 'Note Created' },
]

const COMMON_TOOLS = [
  'web_search', 'read_file', 'write_file', 'run_code', 'send_email',
  'create_task', 'update_calendar', 'query_database', 'call_api',
]

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatRelative(d: string | null | undefined) {
  if (!d) return 'Never'
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function parseJSON<T>(str: string, fallback: T): T {
  try { return JSON.parse(str) as T } catch { return fallback }
}

// ─── Tab Bar ───────────────────────────────────────────────────────────────────

function TabBar({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10 flex-wrap">
      {TABS.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all',
            active === t.id
              ? 'bg-cyan-400/20 text-cyan-400 border border-cyan-400/30'
              : 'text-white/50 hover:text-white/80 hover:bg-white/5',
          )}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ─── Plugin Card ───────────────────────────────────────────────────────────────

function PluginCard({ plugin, onToggle, onDelete }: {
  plugin: Plugin
  onToggle: (id: string, active: boolean) => void
  onDelete: (id: string) => void
}) {
  const perms: string[] = parseJSON(plugin.permissions, [])
  return (
    <div className="hud-stat-card rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-semibold text-sm">{plugin.name}</span>
            <span className="text-[10px] px-2 py-0.5 rounded border border-cyan-400/20 text-cyan-400 bg-cyan-400/5 nexus-mono">
              {plugin.toolName}
            </span>
          </div>
          {plugin.description && (
            <p className="text-white/50 text-xs mt-1">{plugin.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 ml-2">
          <button
            onClick={() => onToggle(plugin.id, !plugin.isActive)}
            className={cn(
              'transition-colors',
              plugin.isActive ? 'text-green-400' : 'text-white/20',
            )}
            title={plugin.isActive ? 'Deactivate' : 'Activate'}
          >
            {plugin.isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
          </button>
          <button
            onClick={() => onDelete(plugin.id)}
            className="text-white/30 hover:text-red-400 transition-colors"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {perms.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {perms.map(p => (
            <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-violet-400/10 text-violet-400 border border-violet-400/20">
              {p}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-white/5">
        <span className={cn(
          'text-[10px] font-medium px-2 py-0.5 rounded-full',
          plugin.isActive ? 'text-green-400 bg-green-400/10' : 'text-white/30 bg-white/5',
        )}>
          {plugin.isActive ? 'ACTIVE' : 'INACTIVE'}
        </span>
        <span className="text-[10px] text-white/30 nexus-mono">{formatDate(plugin.createdAt)}</span>
      </div>
    </div>
  )
}

// ─── Plugin Form ───────────────────────────────────────────────────────────────

function PluginForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', toolName: '', description: '', permissions: [] as string[] })

  function togglePerm(v: string) {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(v) ? f.permissions.filter(p => p !== v) : [...f.permissions, v],
    }))
  }

  async function submit() {
    if (!form.name.trim() || !form.toolName.trim()) {
      toast.error('Name and tool name are required')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/plugins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create plugin')
      toast.success('Plugin created')
      setForm({ name: '', toolName: '', description: '', permissions: [] })
      setOpen(false)
      onCreated()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="hud-stat-card rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2 text-cyan-400">
          <Plus size={15} />
          <span className="text-xs font-bold uppercase tracking-wider nexus-mono">Add Plugin</span>
        </div>
        {open ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-white/10 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="hud-label mb-1">Name</label>
              <input
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/40"
                placeholder="My Weather Plugin"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="hud-label mb-1">Tool Name (slug)</label>
              <input
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/40 nexus-mono"
                placeholder="my_weather_tool"
                value={form.toolName}
                onChange={e => setForm(f => ({ ...f, toolName: e.target.value.replace(/\s+/g, '_').toLowerCase() }))}
              />
            </div>
          </div>

          <div>
            <label className="hud-label mb-1">Description</label>
            <textarea
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/40 resize-none"
              placeholder="Describe what this plugin does..."
              rows={2}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div>
            <label className="hud-label mb-2">Permissions</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PLUGIN_PERMISSIONS.map(p => (
                <label key={p.value} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={form.permissions.includes(p.value)}
                    onChange={() => togglePerm(p.value)}
                    className="accent-cyan-400"
                  />
                  <span className="text-xs text-white/60 group-hover:text-white/80 transition-colors">{p.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={submit}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400/20 text-cyan-400 border border-cyan-400/30 hover:bg-cyan-400/30 transition-all text-xs font-bold uppercase tracking-wider disabled:opacity-50"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Create Plugin
            </button>
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-2 rounded-lg text-white/40 hover:text-white/70 transition-colors text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Webhook Card ──────────────────────────────────────────────────────────────

function WebhookCard({ webhook, onDelete, onTest, onToggle }: {
  webhook: WebhookEndpoint
  onDelete: (id: string) => void
  onTest: (id: string) => void
  onToggle: (id: string, active: boolean) => void
}) {
  const [secretVisible, setSecretVisible] = useState(false)
  const events: string[] = parseJSON(webhook.events, [])

  return (
    <div className="hud-stat-card rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-semibold text-sm">{webhook.name}</span>
            <span className={cn(
              'text-[10px] px-2 py-0.5 rounded-full font-medium',
              webhook.isActive ? 'text-green-400 bg-green-400/10' : 'text-white/30 bg-white/5',
            )}>
              {webhook.isActive ? 'ACTIVE' : 'INACTIVE'}
            </span>
          </div>
          <p className="text-white/40 text-xs mt-1 truncate nexus-mono">{webhook.url}</p>
        </div>
        <div className="flex items-center gap-2 ml-2">
          <button
            onClick={() => onToggle(webhook.id, !webhook.isActive)}
            className={cn('transition-colors', webhook.isActive ? 'text-green-400' : 'text-white/20')}
          >
            {webhook.isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
          </button>
          <button
            onClick={() => onDelete(webhook.id)}
            className="text-white/30 hover:text-red-400 transition-colors"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {events.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {events.map(e => (
            <span key={e} className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-400/10 text-cyan-400 border border-cyan-400/20 nexus-mono">
              {e}
            </span>
          ))}
        </div>
      )}

      {webhook.secret && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/40 nexus-mono flex-1 truncate">
            Secret:{' '}
            <span className={cn('text-white/70', !secretVisible && 'blur-sm select-none')}>
              {webhook.secret}
            </span>
          </span>
          <button
            onClick={() => setSecretVisible(v => !v)}
            className="text-white/30 hover:text-white/60 transition-colors flex-shrink-0"
          >
            {secretVisible ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-white/5">
        <div className="flex items-center gap-1.5 text-[10px] text-white/30">
          <Clock size={11} />
          <span>Last triggered: {formatRelative(webhook.lastTriggeredAt)}</span>
        </div>
        <button
          onClick={() => onTest(webhook.id)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-cyan-400 border border-cyan-400/20 hover:bg-cyan-400/10 transition-all"
        >
          <Send size={11} />
          Send Test
        </button>
      </div>
    </div>
  )
}

// ─── Webhook Form ──────────────────────────────────────────────────────────────

function WebhookForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', url: '', events: [] as string[] })

  function toggleEvent(v: string) {
    setForm(f => ({
      ...f,
      events: f.events.includes(v) ? f.events.filter(e => e !== v) : [...f.events, v],
    }))
  }

  async function submit() {
    if (!form.name.trim() || !form.url.trim()) {
      toast.error('Name and URL are required')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create webhook')
      toast.success('Webhook created')
      setForm({ name: '', url: '', events: [] })
      setOpen(false)
      onCreated()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="hud-stat-card rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2 text-cyan-400">
          <Plus size={15} />
          <span className="text-xs font-bold uppercase tracking-wider nexus-mono">Add Webhook</span>
        </div>
        {open ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-white/10 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="hud-label mb-1">Name</label>
              <input
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/40"
                placeholder="Slack Notifications"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="hud-label mb-1">Endpoint URL</label>
              <input
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/40 nexus-mono text-xs"
                placeholder="https://hooks.example.com/nexus"
                value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="hud-label mb-2">Events to Listen</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {WEBHOOK_EVENTS.map(ev => (
                <label key={ev.value} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={form.events.includes(ev.value)}
                    onChange={() => toggleEvent(ev.value)}
                    className="accent-cyan-400"
                  />
                  <span className="text-xs text-white/60 group-hover:text-white/80 transition-colors">{ev.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={submit}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400/20 text-cyan-400 border border-cyan-400/30 hover:bg-cyan-400/30 transition-all text-xs font-bold uppercase tracking-wider disabled:opacity-50"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Create Webhook
            </button>
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-2 rounded-lg text-white/40 hover:text-white/70 transition-colors text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── API Key Card ──────────────────────────────────────────────────────────────

function ApiKeyCard({ apiKey, onRevoke }: {
  apiKey: ApiKey
  onRevoke: (id: string) => void
}) {
  const permColor: Record<string, string> = {
    read:  'text-blue-400 bg-blue-400/10 border-blue-400/20',
    write: 'text-violet-400 bg-violet-400/10 border-violet-400/20',
    admin: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  }

  return (
    <div className="hud-stat-card rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-white font-semibold text-sm">{apiKey.name}</span>
          <p className="text-white/40 text-xs nexus-mono mt-0.5">{apiKey.prefix}••••••••••••••••••••••••••••••••</p>
        </div>
        <button
          onClick={() => onRevoke(apiKey.id)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-red-400 border border-red-400/20 hover:bg-red-400/10 transition-all"
        >
          <X size={12} />
          Revoke
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium', permColor[apiKey.permissions] ?? permColor.read)}>
          {apiKey.permissions.toUpperCase()}
        </span>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px] text-white/30 nexus-mono">
        <span>Created {formatDate(apiKey.createdAt)}</span>
        <span>Expires {apiKey.expiresAt ? formatDate(apiKey.expiresAt) : 'Never'}</span>
      </div>
    </div>
  )
}

// ─── API Key Form ──────────────────────────────────────────────────────────────

function ApiKeyForm({ onCreated }: { onCreated: (raw: string) => void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', permissions: 'read', expiresInDays: 90 as number | null })

  async function submit() {
    if (!form.name.trim()) {
      toast.error('Name is required')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          permissions: form.permissions,
          expiresInDays: form.expiresInDays,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate key')
      toast.success('API key generated')
      setForm({ name: '', permissions: 'read', expiresInDays: 90 })
      setOpen(false)
      onCreated(data.key)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="hud-stat-card rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2 text-cyan-400">
          <Plus size={15} />
          <span className="text-xs font-bold uppercase tracking-wider nexus-mono">Generate New Key</span>
        </div>
        {open ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-white/10 space-y-4 mt-3">
          <div>
            <label className="hud-label mb-1">Key Name</label>
            <input
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/40"
              placeholder="My Integration"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div>
            <label className="hud-label mb-2">Permissions</label>
            <div className="flex flex-col gap-2">
              {[
                { value: 'read',  label: 'Read',  desc: 'Read-only access to all data' },
                { value: 'write', label: 'Write', desc: 'Read and write access' },
                { value: 'admin', label: 'Admin', desc: 'Full access including system settings' },
              ].map(opt => (
                <label key={opt.value} className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="permissions"
                    value={opt.value}
                    checked={form.permissions === opt.value}
                    onChange={() => setForm(f => ({ ...f, permissions: opt.value }))}
                    className="accent-cyan-400 mt-0.5"
                  />
                  <div>
                    <span className="text-sm text-white/80 font-medium">{opt.label}</span>
                    <p className="text-[11px] text-white/40">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="hud-label mb-2">Expires In</label>
            <div className="flex gap-2 flex-wrap">
              {[
                { label: '30 days', value: 30 },
                { label: '90 days', value: 90 },
                { label: '1 year',  value: 365 },
                { label: 'Never',   value: null },
              ].map(opt => (
                <button
                  key={String(opt.value)}
                  onClick={() => setForm(f => ({ ...f, expiresInDays: opt.value }))}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs border transition-all',
                    form.expiresInDays === opt.value
                      ? 'bg-cyan-400/20 text-cyan-400 border-cyan-400/30'
                      : 'text-white/40 border-white/10 hover:text-white/60',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={submit}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400/20 text-cyan-400 border border-cyan-400/30 hover:bg-cyan-400/30 transition-all text-xs font-bold uppercase tracking-wider disabled:opacity-50"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Key size={13} />}
              Generate Key
            </button>
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-2 rounded-lg text-white/40 hover:text-white/70 transition-colors text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Generated Key Display ─────────────────────────────────────────────────────

function GeneratedKeyBox({ rawKey, onDismiss }: { rawKey: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false)

  function copyKey() {
    navigator.clipboard.writeText(rawKey).then(() => {
      setCopied(true)
      toast.success('Key copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => toast.error('Failed to copy'))
  }

  return (
    <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 space-y-3">
      <div className="flex items-center gap-2 text-amber-400">
        <AlertTriangle size={15} />
        <span className="text-xs font-bold uppercase tracking-wider">This key will not be shown again — copy it now!</span>
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 bg-black/30 rounded-lg px-3 py-2 text-xs text-green-400 nexus-mono break-all select-all border border-white/10">
          {rawKey}
        </code>
        <button
          onClick={copyKey}
          className="flex-shrink-0 p-2 rounded-lg border border-cyan-400/20 text-cyan-400 hover:bg-cyan-400/10 transition-all"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      <button
        onClick={onDismiss}
        className="text-xs text-white/40 hover:text-white/60 transition-colors"
      >
        I have saved my key, dismiss this
      </button>
    </div>
  )
}

// ─── Agent Template Card ───────────────────────────────────────────────────────

function AgentTemplateCard({ template, onDelete, onDeploy, onEdit }: {
  template: AgentTemplate
  onDelete: (id: string) => void
  onDeploy: (id: string) => void
  onEdit: (template: AgentTemplate) => void
}) {
  const tools: string[] = parseJSON(template.tools, [])

  return (
    <div className="hud-stat-card rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <span className="text-white font-semibold text-sm">{template.name}</span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] px-2 py-0.5 rounded border border-violet-400/20 text-violet-400 bg-violet-400/5">
              {template.role}
            </span>
          </div>
          {template.description && (
            <p className="text-white/50 text-xs mt-1.5">{template.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 ml-2">
          <button
            onClick={() => onEdit(template)}
            className="p-1.5 rounded-lg text-white/30 hover:text-cyan-400 hover:bg-cyan-400/10 transition-all"
          >
            <Edit2 size={13} />
          </button>
          <button
            onClick={() => onDelete(template.id)}
            className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-all"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {tools.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tools.map(t => (
            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40 border border-white/10">
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <span className="text-[10px] text-white/30 nexus-mono">{formatDate(template.createdAt)}</span>
        <button
          onClick={() => onDeploy(template.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-cyan-400/15 text-cyan-400 border border-cyan-400/25 hover:bg-cyan-400/25 transition-all font-medium"
        >
          <Zap size={12} />
          Deploy Agent
        </button>
      </div>
    </div>
  )
}

// ─── Agent Template Form ───────────────────────────────────────────────────────

function AgentTemplateForm({ onCreated, editing, onCancelEdit }: {
  onCreated: () => void
  editing: AgentTemplate | null
  onCancelEdit: () => void
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', role: '', description: '', systemPrompt: '', tools: '' })

  useEffect(() => {
    if (editing) {
      const tools: string[] = parseJSON(editing.tools, [])
      setForm({
        name: editing.name,
        role: editing.role,
        description: editing.description || '',
        systemPrompt: editing.systemPrompt,
        tools: tools.join(', '),
      })
      setOpen(true)
    }
  }, [editing])

  async function submit() {
    if (!form.name.trim() || !form.role.trim() || !form.systemPrompt.trim()) {
      toast.error('Name, role, and system prompt are required')
      return
    }
    const toolsArr = form.tools.split(',').map(t => t.trim()).filter(Boolean)
    setLoading(true)
    try {
      let res: Response
      if (editing) {
        res = await fetch(`/api/agent-templates?id=${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, tools: toolsArr }),
        })
      } else {
        res = await fetch('/api/agent-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, tools: toolsArr }),
        })
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save template')
      toast.success(editing ? 'Template updated' : 'Template created')
      setForm({ name: '', role: '', description: '', systemPrompt: '', tools: '' })
      setOpen(false)
      onCancelEdit()
      onCreated()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  function cancel() {
    setOpen(false)
    onCancelEdit()
    setForm({ name: '', role: '', description: '', systemPrompt: '', tools: '' })
  }

  return (
    <div className="hud-stat-card rounded-xl overflow-hidden">
      <button
        onClick={() => { if (!editing) setOpen(o => !o) }}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2 text-cyan-400">
          <Plus size={15} />
          <span className="text-xs font-bold uppercase tracking-wider nexus-mono">
            {editing ? 'Edit Template' : 'Create Template'}
          </span>
        </div>
        {!editing && (open ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />)}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-white/10 space-y-3 mt-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="hud-label mb-1">Name</label>
              <input
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/40"
                placeholder="Research Specialist"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="hud-label mb-1">Role</label>
              <input
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/40"
                placeholder="Research Agent"
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="hud-label mb-1">Description</label>
            <input
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/40"
              placeholder="Performs deep research and synthesises findings"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div>
            <label className="hud-label mb-1">System Prompt</label>
            <textarea
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/40 resize-none nexus-mono text-xs leading-relaxed"
              placeholder={'You are a research specialist. Your goal is to:\n1. Search for relevant information\n2. Synthesise findings from multiple sources\n3. Provide concise, accurate reports\n\nAlways cite your sources and flag uncertainty.'}
              rows={5}
              value={form.systemPrompt}
              onChange={e => setForm(f => ({ ...f, systemPrompt: e.target.value }))}
            />
          </div>

          <div>
            <label className="hud-label mb-1">Tools (comma-separated)</label>
            <div className="flex flex-wrap gap-1 mb-2">
              {COMMON_TOOLS.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    const curr = form.tools.split(',').map(x => x.trim()).filter(Boolean)
                    if (curr.includes(t)) {
                      setForm(f => ({ ...f, tools: curr.filter(x => x !== t).join(', ') }))
                    } else {
                      setForm(f => ({ ...f, tools: [...curr, t].join(', ') }))
                    }
                  }}
                  className={cn(
                    'text-[10px] px-2 py-0.5 rounded border transition-all',
                    form.tools.split(',').map(x => x.trim()).includes(t)
                      ? 'bg-cyan-400/15 text-cyan-400 border-cyan-400/30'
                      : 'text-white/40 border-white/10 hover:text-white/60',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <input
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/40 nexus-mono text-xs"
              placeholder="web_search, read_file, run_code"
              value={form.tools}
              onChange={e => setForm(f => ({ ...f, tools: e.target.value }))}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={submit}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400/20 text-cyan-400 border border-cyan-400/30 hover:bg-cyan-400/30 transition-all text-xs font-bold uppercase tracking-wider disabled:opacity-50"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Bot size={13} />}
              {editing ? 'Update Template' : 'Save Template'}
            </button>
            <button
              onClick={cancel}
              className="px-3 py-2 rounded-lg text-white/40 hover:text-white/70 transition-colors text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function PluginsPage() {
  const router = useRouter()
  const [tab, setTab] = useState<TabId>('plugins')

  // Plugins state
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [pluginsLoading, setPluginsLoading] = useState(true)

  // Webhooks state
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([])
  const [webhooksLoading, setWebhooksLoading] = useState(true)

  // API keys state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [keysLoading, setKeysLoading] = useState(true)
  const [newRawKey, setNewRawKey] = useState<string | null>(null)

  // Agent templates state
  const [templates, setTemplates] = useState<AgentTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [editingTemplate, setEditingTemplate] = useState<AgentTemplate | null>(null)

  // ─── Loaders ────────────────────────────────────────────────────────────────

  const loadPlugins = useCallback(async () => {
    setPluginsLoading(true)
    try {
      const res = await fetch('/api/plugins')
      const data = await res.json()
      setPlugins(data.plugins ?? [])
    } finally {
      setPluginsLoading(false)
    }
  }, [])

  const loadWebhooks = useCallback(async () => {
    setWebhooksLoading(true)
    try {
      const res = await fetch('/api/webhooks')
      const data = await res.json()
      setWebhooks(data.webhooks ?? [])
    } finally {
      setWebhooksLoading(false)
    }
  }, [])

  const loadKeys = useCallback(async () => {
    setKeysLoading(true)
    try {
      const res = await fetch('/api/api-keys')
      const data = await res.json()
      setApiKeys(data.keys ?? [])
    } finally {
      setKeysLoading(false)
    }
  }, [])

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true)
    try {
      const res = await fetch('/api/agent-templates')
      const data = await res.json()
      setTemplates(data.templates ?? [])
    } finally {
      setTemplatesLoading(false)
    }
  }, [])

  useEffect(() => { loadPlugins() }, [loadPlugins])
  useEffect(() => { loadWebhooks() }, [loadWebhooks])
  useEffect(() => { loadKeys() }, [loadKeys])
  useEffect(() => { loadTemplates() }, [loadTemplates])

  // ─── Plugin actions ──────────────────────────────────────────────────────────

  async function togglePlugin(id: string, active: boolean) {
    try {
      const res = await fetch(`/api/plugins?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: active }),
      })
      if (!res.ok) throw new Error('Failed to update plugin')
      setPlugins(ps => ps.map(p => p.id === id ? { ...p, isActive: active } : p))
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
  }

  async function deletePlugin(id: string) {
    if (!confirm('Delete this plugin?')) return
    try {
      const res = await fetch(`/api/plugins?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete plugin')
      setPlugins(ps => ps.filter(p => p.id !== id))
      toast.success('Plugin deleted')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
  }

  // ─── Webhook actions ─────────────────────────────────────────────────────────

  async function toggleWebhook(id: string, active: boolean) {
    try {
      const res = await fetch(`/api/webhooks?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: active }),
      })
      if (!res.ok) throw new Error('Failed to update webhook')
      setWebhooks(ws => ws.map(w => w.id === id ? { ...w, isActive: active } : w))
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
  }

  async function deleteWebhook(id: string) {
    if (!confirm('Delete this webhook?')) return
    try {
      const res = await fetch(`/api/webhooks?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete webhook')
      setWebhooks(ws => ws.filter(w => w.id !== id))
      toast.success('Webhook deleted')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
  }

  async function testWebhook(id: string) {
    const toastId = toast.loading('Sending test payload...')
    try {
      const res = await fetch(`/api/webhooks?test=${id}`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        toast.success(`Test delivered (HTTP ${data.status})`, { id: toastId })
      } else {
        toast.error(`Test failed: HTTP ${data.status ?? 'unknown'}`, { id: toastId })
      }
      setWebhooks(ws => ws.map(w => w.id === id ? { ...w, lastTriggeredAt: new Date().toISOString() } : w))
    } catch (e: unknown) {
      toast.error('Test delivery failed', { id: toastId })
    }
  }

  // ─── API key actions ─────────────────────────────────────────────────────────

  async function revokeKey(id: string) {
    if (!confirm('Revoke this API key? This cannot be undone.')) return
    try {
      const res = await fetch(`/api/api-keys?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to revoke key')
      setApiKeys(ks => ks.filter(k => k.id !== id))
      toast.success('API key revoked')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
  }

  // ─── Template actions ────────────────────────────────────────────────────────

  async function deleteTemplate(id: string) {
    if (!confirm('Delete this template?')) return
    try {
      const res = await fetch(`/api/agent-templates?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete template')
      setTemplates(ts => ts.filter(t => t.id !== id))
      toast.success('Template deleted')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
  }

  async function deployTemplate(id: string) {
    const toastId = toast.loading('Deploying agent...')
    try {
      const res = await fetch(`/api/agent-templates?deploy=${id}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to deploy agent')
      toast.success(`Agent "${data.agent.name}" deployed!`, { id: toastId })
      router.push('/agents')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to deploy', { id: toastId })
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Plugin System"
        subtitle="NEXUS Extension SDK"
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Tab bar */}
        <TabBar active={tab} onChange={setTab} />

        {/* ── Custom Plugins ────────────────────────────────────────────────────── */}
        {tab === 'plugins' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-white font-semibold text-base">Custom Plugins</h2>
              <p className="text-white/40 text-sm mt-0.5">Extend NEXUS with custom tool configurations</p>
            </div>

            <PluginForm onCreated={loadPlugins} />

            {pluginsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="text-cyan-400 animate-spin" />
              </div>
            ) : plugins.length === 0 ? (
              <div className="hud-stat-card rounded-xl p-8 text-center">
                <Puzzle size={32} className="text-white/20 mx-auto mb-3" />
                <p className="text-white/40 text-sm">No plugins yet</p>
                <p className="text-white/25 text-xs mt-1">Create your first plugin above to extend NEXUS</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plugins.map(p => (
                  <PluginCard
                    key={p.id}
                    plugin={p}
                    onToggle={togglePlugin}
                    onDelete={deletePlugin}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Webhooks ─────────────────────────────────────────────────────────── */}
        {tab === 'webhooks' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-white font-semibold text-base">Webhooks</h2>
              <p className="text-white/40 text-sm mt-0.5">Receive real-time events from NEXUS to external services</p>
            </div>

            <WebhookForm onCreated={loadWebhooks} />

            {webhooksLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="text-cyan-400 animate-spin" />
              </div>
            ) : webhooks.length === 0 ? (
              <div className="hud-stat-card rounded-xl p-8 text-center">
                <Webhook size={32} className="text-white/20 mx-auto mb-3" />
                <p className="text-white/40 text-sm">No webhooks configured</p>
                <p className="text-white/25 text-xs mt-1">Add a webhook to receive NEXUS events in external services</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {webhooks.map(w => (
                  <WebhookCard
                    key={w.id}
                    webhook={w}
                    onDelete={deleteWebhook}
                    onTest={testWebhook}
                    onToggle={toggleWebhook}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── API Keys ──────────────────────────────────────────────────────────── */}
        {tab === 'api-keys' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-white font-semibold text-base">API Keys</h2>
              <p className="text-white/40 text-sm mt-0.5">Generate personal API keys to integrate NEXUS with your own tools</p>
            </div>

            {/* Warning banner */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-400/10 border border-amber-400/25">
              <AlertTriangle size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-400 text-xs font-semibold">Security Notice</p>
                <p className="text-amber-400/70 text-xs mt-0.5">API keys are shown only once at creation. Store them securely in a password manager or secrets vault.</p>
              </div>
            </div>

            {/* Generated key display */}
            {newRawKey && (
              <GeneratedKeyBox rawKey={newRawKey} onDismiss={() => { setNewRawKey(null); loadKeys() }} />
            )}

            <ApiKeyForm onCreated={(raw) => { setNewRawKey(raw); loadKeys() }} />

            {keysLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="text-cyan-400 animate-spin" />
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="hud-stat-card rounded-xl p-8 text-center">
                <Key size={32} className="text-white/20 mx-auto mb-3" />
                <p className="text-white/40 text-sm">No API keys yet</p>
                <p className="text-white/25 text-xs mt-1">Generate a key to integrate NEXUS with external tools</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {apiKeys.map(k => (
                  <ApiKeyCard key={k.id} apiKey={k} onRevoke={revokeKey} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Agent Templates ───────────────────────────────────────────────────── */}
        {tab === 'agent-templates' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-white font-semibold text-base">Agent Templates</h2>
              <p className="text-white/40 text-sm mt-0.5">Create reusable agent configurations to deploy custom agents instantly</p>
            </div>

            <AgentTemplateForm
              onCreated={loadTemplates}
              editing={editingTemplate}
              onCancelEdit={() => setEditingTemplate(null)}
            />

            {templatesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="text-cyan-400 animate-spin" />
              </div>
            ) : templates.length === 0 ? (
              <div className="hud-stat-card rounded-xl p-8 text-center">
                <Bot size={32} className="text-white/20 mx-auto mb-3" />
                <p className="text-white/40 text-sm">No agent templates yet</p>
                <p className="text-white/25 text-xs mt-1">Save agent configurations as templates to deploy them with one click</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map(t => (
                  <AgentTemplateCard
                    key={t.id}
                    template={t}
                    onDelete={deleteTemplate}
                    onDeploy={deployTemplate}
                    onEdit={setEditingTemplate}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
