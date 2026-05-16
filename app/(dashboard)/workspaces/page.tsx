'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import {
  Plus,
  Users,
  Settings,
  Trash2,
  X,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

// ─── Types ───────────────────────────────────────────────────────────────────

interface WorkspaceMember {
  id: string
  userId?: string
  email: string
  role: string
  status: string
  joinedAt?: string
  inviteToken?: string
  user?: { name?: string; email: string; image?: string }
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
  _count: { items: number }
  isOwner: boolean
  memberRole?: string
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

function getTypeEmoji(type: string) {
  return WORKSPACE_TYPES.find((t) => t.value === type)?.emoji || '⚙️'
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function getRoleBadgeStyle(role: string) {
  switch (role) {
    case 'owner':
      return 'bg-cyan-400/20 text-cyan-400 border border-cyan-400/30'
    case 'editor':
      return 'bg-green-400/20 text-green-400 border border-green-400/30'
    case 'viewer':
      return 'bg-white/10 text-white/60 border border-white/20'
    default:
      return 'bg-white/5 text-white/40 border border-white/10'
  }
}

// ─── Create Workspace Form ────────────────────────────────────────────────────

function CreateWorkspaceForm({ onCreated }: { onCreated: (w: Workspace) => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('family')
  const [color, setColor] = useState('#00d4ff')
  const [emoji, setEmoji] = useState('🏠')
  const [loading, setLoading] = useState(false)

  function handleTypeSelect(t: typeof WORKSPACE_TYPES[0]) {
    setType(t.value)
    setEmoji(t.emoji)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toast.error('Name is required')
    setLoading(true)
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, type, color, emoji }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Workspace created!')
      onCreated(data.workspace)
      setName('')
      setDescription('')
      setType('family')
      setColor('#00d4ff')
      setEmoji('🏠')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="hud-label block mb-1">WORKSPACE NAME</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Family Hub"
            className="w-full bg-white/5 border border-cyan-400/20 rounded-lg px-3 py-2 text-white/90 text-sm placeholder-white/30 focus:outline-none focus:border-cyan-400/50"
          />
        </div>
        <div>
          <label className="hud-label block mb-1">EMOJI</label>
          <input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            placeholder="🏠"
            className="w-full bg-white/5 border border-cyan-400/20 rounded-lg px-3 py-2 text-white/90 text-sm placeholder-white/30 focus:outline-none focus:border-cyan-400/50"
          />
        </div>
      </div>

      <div>
        <label className="hud-label block mb-1">DESCRIPTION</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this workspace for?"
          rows={2}
          className="w-full bg-white/5 border border-cyan-400/20 rounded-lg px-3 py-2 text-white/90 text-sm placeholder-white/30 focus:outline-none focus:border-cyan-400/50 resize-none"
        />
      </div>

      <div>
        <label className="hud-label block mb-2">TYPE</label>
        <div className="flex flex-wrap gap-2">
          {WORKSPACE_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => handleTypeSelect(t)}
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
        <label className="hud-label block mb-2">COLOR</label>
        <div className="flex gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setColor(c.value)}
              className={cn(
                'w-8 h-8 rounded-full border-2 transition-all',
                color === c.value ? 'border-white scale-110' : 'border-transparent'
              )}
              style={{ backgroundColor: c.value }}
              title={c.label}
            />
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 rounded-lg text-xs font-bold tracking-widest bg-cyan-400/10 border border-cyan-400/30 text-cyan-400 hover:bg-cyan-400/20 transition-all disabled:opacity-50"
      >
        {loading ? 'CREATING...' : 'CREATE WORKSPACE'}
      </button>
    </form>
  )
}

// ─── Workspace Card ───────────────────────────────────────────────────────────

function WorkspaceCard({
  workspace,
  onDelete,
  onUpdate,
}: {
  workspace: Workspace
  onDelete: (id: string) => void
  onUpdate: (w: Workspace) => void
}) {
  const router = useRouter()
  const [showEdit, setShowEdit] = useState(false)
  const [editName, setEditName] = useState(workspace.name)
  const [editDesc, setEditDesc] = useState(workspace.description || '')
  const [editColor, setEditColor] = useState(workspace.color)
  const [editEmoji, setEditEmoji] = useState(workspace.emoji)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const activeMembers = workspace.members.filter((m) => m.status === 'active')
  const displayMembers = activeMembers.slice(0, 3)

  const role = workspace.isOwner ? 'owner' : workspace.memberRole || 'viewer'

  async function handleUpdate() {
    setSaving(true)
    try {
      const res = await fetch(`/api/workspaces?id=${workspace.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, description: editDesc, color: editColor, emoji: editEmoji }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Workspace updated!')
      onUpdate(data.workspace)
      setShowEdit(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete workspace "${workspace.name}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/workspaces?id=${workspace.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Workspace deleted')
      onDelete(workspace.id)
    } catch {
      toast.error('Failed to delete workspace')
      setDeleting(false)
    }
  }

  return (
    <div
      className="hud-stat-card relative flex flex-col gap-3 p-4 border-l-2"
      style={{ borderLeftColor: workspace.color }}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        <span className="text-3xl leading-none mt-0.5">{workspace.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-white font-semibold text-sm truncate">{workspace.name}</h3>
            <span
              className="text-xs px-2 py-0.5 rounded-full border"
              style={{ color: workspace.color, borderColor: `${workspace.color}40`, backgroundColor: `${workspace.color}15` }}
            >
              {WORKSPACE_TYPES.find((t) => t.value === workspace.type)?.label || workspace.type}
            </span>
          </div>
          {workspace.description && (
            <p className="text-white/40 text-xs mt-0.5 line-clamp-2">{workspace.description}</p>
          )}
        </div>
        {workspace.isOwner && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setShowEdit(!showEdit)}
              className="p-1 rounded text-white/30 hover:text-white/70 transition-colors"
              title="Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-1 rounded text-white/30 hover:text-red-400 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs text-white/40">
        {/* Member avatars */}
        <div className="flex items-center gap-1.5">
          <div className="flex -space-x-1">
            {displayMembers.map((m) => (
              <div
                key={m.id}
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border border-black/40"
                style={{ backgroundColor: `${workspace.color}30`, color: workspace.color }}
                title={m.user?.name || m.email}
              >
                {getInitials(m.user?.name || m.email)}
              </div>
            ))}
          </div>
          <span>{activeMembers.length} member{activeMembers.length !== 1 ? 's' : ''}</span>
        </div>
        <span>{workspace._count.items} item{workspace._count.items !== 1 ? 's' : ''}</span>
        <span
          className={cn('ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium', getRoleBadgeStyle(role))}
        >
          {role.charAt(0).toUpperCase() + role.slice(1)}
        </span>
      </div>

      {/* Edit panel */}
      {showEdit && workspace.isOwner && (
        <div className="border-t border-white/10 pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Name"
              className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white/90 text-xs focus:outline-none focus:border-cyan-400/40"
            />
            <input
              value={editEmoji}
              onChange={(e) => setEditEmoji(e.target.value)}
              placeholder="Emoji"
              className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white/90 text-xs focus:outline-none focus:border-cyan-400/40"
            />
          </div>
          <input
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            placeholder="Description"
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white/90 text-xs focus:outline-none focus:border-cyan-400/40"
          />
          <div className="flex gap-1.5">
            {PRESET_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setEditColor(c.value)}
                className={cn('w-5 h-5 rounded-full border transition-all', editColor === c.value ? 'border-white' : 'border-transparent')}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleUpdate}
              disabled={saving}
              className="flex-1 py-1.5 rounded text-xs font-bold bg-cyan-400/10 border border-cyan-400/30 text-cyan-400 hover:bg-cyan-400/20 transition-all disabled:opacity-50"
            >
              {saving ? 'SAVING...' : 'SAVE'}
            </button>
            <button
              onClick={() => setShowEdit(false)}
              className="px-3 py-1.5 rounded text-xs font-bold bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 transition-all"
            >
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* Open button */}
      <button
        onClick={() => router.push(`/workspaces/${workspace.id}`)}
        className="w-full py-1.5 rounded text-xs font-bold tracking-widest border transition-all text-white/60 border-white/10 hover:border-white/30 hover:text-white/90 flex items-center justify-center gap-1.5"
      >
        OPEN <ExternalLink className="w-3 h-3" />
      </button>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [pendingInvites, setPendingInvites] = useState<WorkspaceMember[]>([])
  const [acceptingInvite, setAcceptingInvite] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/workspaces')
      const data = await res.json()
      if (res.ok) setWorkspaces(data.workspaces || [])
    } catch {
      toast.error('Failed to load workspaces')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function handleCreated(w: Workspace) {
    setWorkspaces((prev) => [w, ...prev])
    setShowCreate(false)
  }

  function handleDelete(id: string) {
    setWorkspaces((prev) => prev.filter((w) => w.id !== id))
  }

  function handleUpdate(updated: Workspace) {
    setWorkspaces((prev) => prev.map((w) => (w.id === updated.id ? { ...w, ...updated } : w)))
  }

  async function acceptInvite(token: string) {
    setAcceptingInvite(token)
    try {
      const res = await fetch(`/api/workspaces/invite/${token}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Joined workspace!')
      setPendingInvites((prev) => prev.filter((i) => i.inviteToken !== token))
      load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to accept invite')
    } finally {
      setAcceptingInvite(null)
    }
  }

  const ownedWorkspaces = workspaces.filter((w) => w.isOwner)
  const memberWorkspaces = workspaces.filter((w) => !w.isOwner)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="SHARED WORKSPACES" subtitle="Collaborate and share with family, friends & colleagues" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Create Workspace panel */}
        <div className="hud-panel p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="hud-label">WORKSPACES</h2>
              <p className="text-white/40 text-xs mt-0.5">Create and manage collaborative spaces</p>
            </div>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold tracking-widest border transition-all',
                showCreate
                  ? 'bg-white/5 border-white/20 text-white/60'
                  : 'bg-cyan-400/10 border-cyan-400/30 text-cyan-400 hover:bg-cyan-400/20'
              )}
            >
              {showCreate ? (
                <>
                  <X className="w-3.5 h-3.5" /> CANCEL
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" /> NEW WORKSPACE
                </>
              )}
            </button>
          </div>

          {showCreate && <CreateWorkspaceForm onCreated={handleCreated} />}
        </div>

        {/* Pending Invites */}
        {pendingInvites.length > 0 && (
          <div className="hud-panel p-4">
            <h2 className="hud-label mb-3">PENDING INVITATIONS</h2>
            <div className="space-y-2">
              {pendingInvites.map((invite) => (
                <div key={invite.id} className="flex items-center justify-between p-3 bg-amber-400/5 border border-amber-400/20 rounded-lg">
                  <div>
                    <p className="text-white/80 text-sm">Workspace invitation</p>
                    <p className="text-white/40 text-xs">Role: {invite.role}</p>
                  </div>
                  <button
                    onClick={() => acceptInvite(invite.inviteToken!)}
                    disabled={acceptingInvite === invite.inviteToken}
                    className="px-3 py-1.5 rounded text-xs font-bold bg-green-400/10 border border-green-400/30 text-green-400 hover:bg-green-400/20 transition-all disabled:opacity-50"
                  >
                    {acceptingInvite === invite.inviteToken ? 'JOINING...' : 'ACCEPT'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My Workspaces */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-cyan-400/60 text-sm animate-pulse">LOADING WORKSPACES...</div>
          </div>
        ) : (
          <>
            {ownedWorkspaces.length > 0 && (
              <div>
                <h2 className="hud-label mb-3">MY WORKSPACES</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ownedWorkspaces.map((w) => (
                    <WorkspaceCard key={w.id} workspace={w} onDelete={handleDelete} onUpdate={handleUpdate} />
                  ))}
                </div>
              </div>
            )}

            {memberWorkspaces.length > 0 && (
              <div>
                <h2 className="hud-label mb-3">MEMBER OF</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {memberWorkspaces.map((w) => (
                    <WorkspaceCard key={w.id} workspace={w} onDelete={handleDelete} onUpdate={handleUpdate} />
                  ))}
                </div>
              </div>
            )}

            {workspaces.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <Users className="w-12 h-12 text-white/10 mb-4" />
                <p className="text-white/40 text-sm mb-2">No workspaces yet</p>
                <p className="text-white/20 text-xs max-w-xs">
                  Create a shared workspace to collaborate with family, friends, or colleagues on tasks, notes, goals, and more.
                </p>
                <button
                  onClick={() => setShowCreate(true)}
                  className="mt-6 px-6 py-2 rounded-lg text-xs font-bold tracking-widest bg-cyan-400/10 border border-cyan-400/30 text-cyan-400 hover:bg-cyan-400/20 transition-all"
                >
                  CREATE YOUR FIRST WORKSPACE
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
