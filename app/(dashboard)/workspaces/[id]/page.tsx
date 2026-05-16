'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import {
  Users,
  Plus,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  Settings,
  X,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkspaceMember {
  id: string
  userId?: string
  email: string
  role: string
  status: string
  joinedAt?: string
  inviteToken?: string
  user?: { id: string; name?: string; email: string; image?: string }
}

interface WorkspaceItem {
  id: string
  entityType: string
  entityId: string
  addedById: string
  note?: string
  createdAt: string
  addedBy: { name?: string; email: string }
  entityDetails?: {
    id: string
    title: string
    status?: string
    priority?: string
    progress?: number
    dueAt?: string
    startTime?: string
    content?: string
  } | null
}

interface Workspace {
  id: string
  ownerId: string
  name: string
  description?: string
  type: string
  color: string
  emoji: string
  isPublic: boolean
  createdAt: string
  members: WorkspaceMember[]
  _count?: { items: number }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WORKSPACE_TYPES = [
  { value: 'family', label: 'Family', emoji: '🏠' },
  { value: 'work', label: 'Work', emoji: '💼' },
  { value: 'travel', label: 'Travel', emoji: '✈️' },
  { value: 'household', label: 'Household', emoji: '🏡' },
  { value: 'learning', label: 'Learning', emoji: '📚' },
  { value: 'custom', label: 'Custom', emoji: '⚙️' },
]

const PRESET_COLORS = [
  { value: '#00d4ff', label: 'Cyan' },
  { value: '#8b5cf6', label: 'Violet' },
  { value: '#22c55e', label: 'Green' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#f43f5e', label: 'Rose' },
  { value: '#3b82f6', label: 'Blue' },
]

const ENTITY_TYPES = [
  { value: 'task', label: 'Task', color: '#22c55e' },
  { value: 'note', label: 'Note', color: '#3b82f6' },
  { value: 'goal', label: 'Goal', color: '#f472b6' },
  { value: 'reminder', label: 'Reminder', color: '#f59e0b' },
]

function getRoleBadgeStyle(role: string) {
  switch (role) {
    case 'owner': return 'bg-cyan-400/20 text-cyan-400 border border-cyan-400/30'
    case 'editor': return 'bg-green-400/20 text-green-400 border border-green-400/30'
    case 'viewer': return 'bg-white/10 text-white/60 border border-white/20'
    default: return 'bg-white/5 text-white/40 border border-white/10'
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'active': return 'text-green-400'
    case 'pending': return 'text-amber-400'
    case 'revoked': return 'text-red-400'
    default: return 'text-white/40'
  }
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function getEntityColor(type: string) {
  return ENTITY_TYPES.find((t) => t.value === type)?.color || '#ffffff'
}

// ─── Item Select Modal ────────────────────────────────────────────────────────

function AddItemModal({
  entityType,
  workspaceId,
  onClose,
  onAdded,
}: {
  entityType: string
  workspaceId: string
  onClose: () => void
  onAdded: () => void
}) {
  const [entities, setEntities] = useState<Array<{ id: string; title: string; status?: string }>>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    async function fetchEntities() {
      try {
        const apiMap: Record<string, string> = {
          task: '/api/tasks',
          note: '/api/notes',
          goal: '/api/goals',
          reminder: '/api/reminders',
        }
        const url = apiMap[entityType]
        if (!url) return
        const res = await fetch(url)
        const data = await res.json()
        const key = entityType === 'calendarEvent' ? 'events' : `${entityType}s`
        setEntities(data[key] || data.tasks || data.notes || data.goals || data.reminders || [])
      } catch {
        toast.error('Failed to load items')
      } finally {
        setLoading(false)
      }
    }
    fetchEntities()
  }, [entityType])

  async function handleAdd() {
    if (selected.length === 0) return toast.error('Select at least one item')
    setAdding(true)
    try {
      await Promise.all(
        selected.map((entityId) =>
          fetch(`/api/workspaces/${workspaceId}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entityType, entityId, note }),
          })
        )
      )
      toast.success(`${selected.length} item(s) added!`)
      onAdded()
      onClose()
    } catch {
      toast.error('Failed to add items')
    } finally {
      setAdding(false)
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))
  }

  const color = getEntityColor(entityType)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="hud-panel w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-white font-semibold text-sm">
            ADD {entityType.toUpperCase()}S TO WORKSPACE
          </h3>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <p className="text-white/40 text-sm text-center py-8">Loading...</p>
          ) : entities.length === 0 ? (
            <p className="text-white/40 text-sm text-center py-8">No {entityType}s found</p>
          ) : (
            entities.map((e) => (
              <div
                key={e.id}
                onClick={() => toggleSelect(e.id)}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-all',
                  selected.includes(e.id)
                    ? 'border-cyan-400/40 bg-cyan-400/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                )}
              >
                <div
                  className={cn(
                    'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0',
                    selected.includes(e.id) ? 'bg-cyan-400 border-cyan-400' : 'border-white/30'
                  )}
                >
                  {selected.includes(e.id) && <Check className="w-2.5 h-2.5 text-black" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white/80 text-xs truncate">{e.title}</p>
                  {e.status && (
                    <p className="text-white/40 text-[10px]">{e.status}</p>
                  )}
                </div>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{ color, backgroundColor: `${color}20`, border: `1px solid ${color}40` }}
                >
                  {entityType}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-white/10 space-y-3">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note..."
            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white/80 text-xs focus:outline-none focus:border-cyan-400/40"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={adding || selected.length === 0}
              className="flex-1 py-2 rounded text-xs font-bold bg-cyan-400/10 border border-cyan-400/30 text-cyan-400 hover:bg-cyan-400/20 transition-all disabled:opacity-50"
            >
              {adding ? 'ADDING...' : `ADD SELECTED (${selected.length})`}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded text-xs font-bold bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 transition-all"
            >
              CANCEL
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Items Tab ────────────────────────────────────────────────────────────────

function ItemsTab({
  workspaceId,
  isOwner,
  memberRole,
}: {
  workspaceId: string
  isOwner: boolean
  memberRole: string
}) {
  const [items, setItems] = useState<WorkspaceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDropdown, setShowAddDropdown] = useState(false)
  const [addModal, setAddModal] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)

  const canRemove = isOwner || memberRole === 'editor'

  const loadItems = useCallback(async () => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/items`)
      const data = await res.json()
      if (res.ok) setItems(data.items || [])
    } catch {
      toast.error('Failed to load items')
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  async function handleRemove(itemId: string) {
    setRemoving(itemId)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/items?itemId=${itemId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to remove')
      setItems((prev) => prev.filter((i) => i.id !== itemId))
      toast.success('Item removed')
    } catch {
      toast.error('Failed to remove item')
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Add button */}
      <div className="flex justify-end relative">
        <button
          onClick={() => setShowAddDropdown(!showAddDropdown)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold tracking-widest bg-cyan-400/10 border border-cyan-400/30 text-cyan-400 hover:bg-cyan-400/20 transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> ADD ITEM <ChevronDown className="w-3 h-3" />
        </button>
        {showAddDropdown && (
          <div className="absolute top-10 right-0 z-20 bg-[#0a1628] border border-cyan-400/20 rounded-lg overflow-hidden shadow-2xl min-w-[140px]">
            {ENTITY_TYPES.map((et) => (
              <button
                key={et.value}
                onClick={() => {
                  setAddModal(et.value)
                  setShowAddDropdown(false)
                }}
                className="w-full text-left px-4 py-2.5 text-xs text-white/70 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: et.color }} />
                Add {et.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Items list */}
      {loading ? (
        <div className="text-center py-12 text-white/40 text-sm animate-pulse">LOADING ITEMS...</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3">
            <Plus className="w-5 h-5 text-white/20" />
          </div>
          <p className="text-white/40 text-sm">No items shared yet</p>
          <p className="text-white/20 text-xs mt-1 max-w-xs">
            Add tasks, notes, or goals to collaborate with workspace members.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const color = getEntityColor(item.entityType)
            return (
              <div
                key={item.id}
                className="hud-stat-card flex items-start gap-3 p-3 border-l-2"
                style={{ borderLeftColor: color }}
              >
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium mt-0.5 shrink-0"
                  style={{ color, backgroundColor: `${color}20`, border: `1px solid ${color}40` }}
                >
                  {item.entityType.toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-white/80 text-sm truncate">
                    {item.entityDetails?.title || item.entityId}
                  </p>
                  {item.note && (
                    <p className="text-white/40 text-xs mt-0.5 italic">&ldquo;{item.note}&rdquo;</p>
                  )}
                  <p className="text-white/30 text-[10px] mt-1">
                    Added by {item.addedBy.name || item.addedBy.email} &bull;{' '}
                    {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {canRemove && (
                  <button
                    onClick={() => handleRemove(item.id)}
                    disabled={removing === item.id}
                    className="text-white/20 hover:text-red-400 transition-colors shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add item modal */}
      {addModal && (
        <AddItemModal
          entityType={addModal}
          workspaceId={workspaceId}
          onClose={() => setAddModal(null)}
          onAdded={loadItems}
        />
      )}
    </div>
  )
}

// ─── Members Tab ──────────────────────────────────────────────────────────────

function MembersTab({
  workspaceId,
  isOwner,
  currentUserId,
  workspaceColor,
}: {
  workspaceId: string
  isOwner: boolean
  currentUserId: string
  workspaceColor: string
}) {
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('viewer')
  const [inviting, setInviting] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

  const loadMembers = useCallback(async () => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members`)
      const data = await res.json()
      if (res.ok) setMembers(data.members || [])
    } catch {
      toast.error('Failed to load members')
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    loadMembers()
  }, [loadMembers])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return toast.error('Email is required')
    setInviting(true)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Invite sent!')
      setInviteLink(data.inviteUrl)
      setInviteEmail('')
      loadMembers()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to invite')
    } finally {
      setInviting(false)
    }
  }

  async function handleRemove(memberId: string) {
    setRemoving(memberId)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members?memberId=${memberId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to remove')
      setMembers((prev) => prev.filter((m) => m.id !== memberId))
      toast.success('Member removed')
    } catch {
      toast.error('Failed to remove member')
    } finally {
      setRemoving(null)
    }
  }

  async function handleRoleChange(memberId: string, role: string) {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members?memberId=${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      if (!res.ok) throw new Error('Failed to update')
      setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role } : m)))
      toast.success('Role updated')
    } catch {
      toast.error('Failed to update role')
    }
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    toast.success('Invite link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Members list */}
      {loading ? (
        <div className="text-center py-8 text-white/40 text-sm animate-pulse">LOADING MEMBERS...</div>
      ) : (
        <div className="space-y-2">
          {members.map((member) => (
            <div key={member.id} className="hud-stat-card flex items-center gap-3 p-3">
              {/* Avatar */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{
                  backgroundColor: `${workspaceColor}25`,
                  color: workspaceColor,
                  border: `1px solid ${workspaceColor}40`,
                }}
              >
                {getInitials(member.user?.name || member.email)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-white/80 text-sm truncate">
                  {member.user?.name || member.email}
                </p>
                {member.user?.name && (
                  <p className="text-white/30 text-xs">{member.email}</p>
                )}
              </div>

              {/* Role + Status */}
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn('text-[10px]', getStatusBadge(member.status))}>
                  {member.status}
                </span>
                {isOwner && member.role !== 'owner' ? (
                  <select
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.id, e.target.value)}
                    className="bg-transparent border border-white/10 rounded px-2 py-0.5 text-[10px] text-white/60 focus:outline-none"
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                    <option value="guest">Guest</option>
                  </select>
                ) : (
                  <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', getRoleBadgeStyle(member.role))}>
                    {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                  </span>
                )}
                {(isOwner && member.role !== 'owner') || member.userId === currentUserId ? (
                  <button
                    onClick={() => handleRemove(member.id)}
                    disabled={removing === member.id}
                    className="text-white/20 hover:text-red-400 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Invite form */}
      {isOwner && (
        <div className="hud-panel p-4 space-y-4">
          <h3 className="hud-label">INVITE MEMBER</h3>
          <form onSubmit={handleInvite} className="space-y-3">
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                className="flex-1 bg-white/5 border border-cyan-400/20 rounded-lg px-3 py-2 text-white/90 text-sm placeholder-white/30 focus:outline-none focus:border-cyan-400/50"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="bg-white/5 border border-cyan-400/20 rounded-lg px-3 py-2 text-white/70 text-sm focus:outline-none"
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
                <option value="guest">Guest</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={inviting}
              className="w-full py-2 rounded-lg text-xs font-bold tracking-widest bg-cyan-400/10 border border-cyan-400/30 text-cyan-400 hover:bg-cyan-400/20 transition-all disabled:opacity-50"
            >
              {inviting ? 'SENDING...' : 'SEND INVITE'}
            </button>
          </form>

          {inviteLink && (
            <div className="space-y-2">
              <p className="hud-label text-xs">INVITE LINK</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white/5 border border-cyan-400/20 rounded-lg p-3 font-mono text-xs text-cyan-400 truncate">
                  {inviteLink}
                </div>
                <button
                  onClick={copyInvite}
                  className={cn(
                    'p-2.5 rounded-lg border transition-all shrink-0',
                    copied
                      ? 'bg-green-400/10 border-green-400/30 text-green-400'
                      : 'bg-white/5 border-white/10 text-white/50 hover:border-white/30'
                  )}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab({
  workspace,
  onUpdate,
  onDelete,
}: {
  workspace: Workspace
  onUpdate: (w: Workspace) => void
  onDelete: () => void
}) {
  const [name, setName] = useState(workspace.name)
  const [description, setDescription] = useState(workspace.description || '')
  const [emoji, setEmoji] = useState(workspace.emoji)
  const [color, setColor] = useState(workspace.color)
  const [type, setType] = useState(workspace.type)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/workspaces?id=${workspace.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, emoji, color, type }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Settings saved!')
      onUpdate(data.workspace)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (deleteConfirm !== workspace.name) {
      return toast.error(`Type "${workspace.name}" to confirm deletion`)
    }
    setDeleting(true)
    try {
      const res = await fetch(`/api/workspaces?id=${workspace.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Workspace deleted')
      onDelete()
    } catch {
      toast.error('Failed to delete workspace')
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="hud-panel p-4 space-y-4">
        <h3 className="hud-label">GENERAL</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="hud-label block mb-1 text-[10px]">NAME</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/5 border border-cyan-400/20 rounded-lg px-3 py-2 text-white/90 text-sm focus:outline-none focus:border-cyan-400/50"
            />
          </div>
          <div>
            <label className="hud-label block mb-1 text-[10px]">EMOJI</label>
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              className="w-full bg-white/5 border border-cyan-400/20 rounded-lg px-3 py-2 text-white/90 text-sm focus:outline-none focus:border-cyan-400/50"
            />
          </div>
        </div>
        <div>
          <label className="hud-label block mb-1 text-[10px]">DESCRIPTION</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full bg-white/5 border border-cyan-400/20 rounded-lg px-3 py-2 text-white/90 text-sm resize-none focus:outline-none focus:border-cyan-400/50"
          />
        </div>
        <div>
          <label className="hud-label block mb-2 text-[10px]">TYPE</label>
          <div className="flex flex-wrap gap-2">
            {WORKSPACE_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                  type === t.value
                    ? 'bg-cyan-400/20 border-cyan-400/50 text-cyan-400'
                    : 'bg-white/5 border-white/10 text-white/50 hover:border-white/30'
                )}
              >
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="hud-label block mb-2 text-[10px]">COLOR</label>
          <div className="flex gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setColor(c.value)}
                className={cn('w-8 h-8 rounded-full border-2 transition-all', color === c.value ? 'border-white scale-110' : 'border-transparent')}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2 rounded-lg text-xs font-bold tracking-widest bg-cyan-400/10 border border-cyan-400/30 text-cyan-400 hover:bg-cyan-400/20 transition-all disabled:opacity-50"
        >
          {saving ? 'SAVING...' : 'SAVE SETTINGS'}
        </button>
      </div>

      {/* Danger Zone */}
      <div className="hud-panel p-4 border border-red-400/20 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <h3 className="text-red-400 text-xs font-bold tracking-widest">DANGER ZONE</h3>
        </div>
        <p className="text-white/40 text-xs">
          Deleting this workspace is permanent and cannot be undone. All shared items and members will be removed.
        </p>
        <div>
          <label className="hud-label block mb-1 text-[10px]">
            TYPE &ldquo;{workspace.name}&rdquo; TO CONFIRM
          </label>
          <input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder={workspace.name}
            className="w-full bg-red-400/5 border border-red-400/20 rounded-lg px-3 py-2 text-white/80 text-sm focus:outline-none focus:border-red-400/40"
          />
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting || deleteConfirm !== workspace.name}
          className="w-full py-2 rounded-lg text-xs font-bold tracking-widest bg-red-400/10 border border-red-400/30 text-red-400 hover:bg-red-400/20 transition-all disabled:opacity-40"
        >
          {deleting ? 'DELETING...' : 'DELETE WORKSPACE'}
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WorkspaceDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'items' | 'members' | 'settings'>('items')
  const [currentUserId, setCurrentUserId] = useState('')

  const loadWorkspace = useCallback(async () => {
    try {
      const res = await fetch('/api/workspaces')
      const data = await res.json()
      if (res.ok) {
        if (data.currentUserId) setCurrentUserId(data.currentUserId)
        const ws = (data.workspaces || []).find((w: Workspace) => w.id === params.id)
        if (ws) {
          setWorkspace(ws)
        } else {
          toast.error('Workspace not found')
          router.push('/workspaces')
        }
      }
    } catch {
      toast.error('Failed to load workspace')
    } finally {
      setLoading(false)
    }
  }, [params.id, router])

  useEffect(() => {
    loadWorkspace()
  }, [loadWorkspace])

  function handleWorkspaceUpdate(updated: Workspace) {
    setWorkspace((prev) => (prev ? { ...prev, ...updated } : updated))
  }

  function handleDelete() {
    router.push('/workspaces')
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <Header title="WORKSPACE" subtitle="Loading..." />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-cyan-400/60 text-sm animate-pulse">LOADING...</div>
        </div>
      </div>
    )
  }

  if (!workspace) return null

  const isOwner = workspace.ownerId === currentUserId
  const memberRecord = workspace.members.find((m) => m.userId === currentUserId && m.status === 'active')
  const memberRole = isOwner ? 'owner' : memberRecord?.role || 'viewer'
  const activeMembers = workspace.members.filter((m) => m.status === 'active')

  const tabs: Array<{ id: 'items' | 'members' | 'settings'; label: string }> = [
    { id: 'items', label: 'Items' },
    { id: 'members', label: 'Members' },
    ...(isOwner ? [{ id: 'settings' as const, label: 'Settings' }] : []),
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title={`${workspace.emoji} ${workspace.name}`}
        subtitle={`${WORKSPACE_TYPES.find((t) => t.value === workspace.type)?.label || workspace.type} • ${activeMembers.length} member${activeMembers.length !== 1 ? 's' : ''}`}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Tab navigation */}
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-2 rounded-full text-xs font-bold tracking-wider border transition-all',
                activeTab === tab.id
                  ? 'bg-cyan-400/20 border-cyan-400/40 text-cyan-400'
                  : 'bg-white/5 border-white/10 text-white/50 hover:border-white/30'
              )}
            >
              {tab.label.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'items' && (
          <ItemsTab
            workspaceId={params.id}
            isOwner={isOwner}
            memberRole={memberRole}
          />
        )}

        {activeTab === 'members' && (
          <MembersTab
            workspaceId={params.id}
            isOwner={isOwner}
            currentUserId={currentUserId}
            workspaceColor={workspace.color}
          />
        )}

        {activeTab === 'settings' && isOwner && (
          <SettingsTab
            workspace={workspace}
            onUpdate={handleWorkspaceUpdate}
            onDelete={handleDelete}
          />
        )}
      </div>
    </div>
  )
}
