'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { Zap, Plus, Play, Pause, Trash2, Clock, ArrowRight, X, Loader2, RotateCcw, MapPin, ChevronDown, ChevronUp, Navigation, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Automation {
  id: string
  name: string
  trigger: string
  actions: string
  description: string | null
  conditions: string | null
  status: string
  lastRun: string | null
  nextRun: string | null
  runCount: number
  createdAt: string
}

interface FormState {
  name: string
  trigger: string
  action: string
  schedule: 'daily' | 'weekly' | 'on_event' | 'manual' | 'location'
}

interface LocationTrigger {
  id: string
  name: string
  location: string
  lat: number | null
  lng: number | null
  radius: number
  event: 'arrive' | 'depart'
  action: string
  createdAt: string
}

interface LocationFormState {
  name: string
  location: string
  lat: number | null
  lng: number | null
  radius: number
  event: 'arrive' | 'depart'
  action: string
}

const EMPTY_FORM: FormState = {
  name: '',
  trigger: '',
  action: '',
  schedule: 'daily',
}

const EMPTY_LOCATION_FORM: LocationFormState = {
  name: '',
  location: '',
  lat: null,
  lng: null,
  radius: 500,
  event: 'arrive',
  action: '',
}

const TEMPLATES = [
  {
    name: 'Morning Briefing',
    icon: '🌅',
    desc: 'Daily summary of your tasks and schedule',
    form: {
      name: 'Morning Briefing',
      trigger: 'Every day at 8:00 AM',
      action: 'Summarize tasks, reminders, and emails into a morning briefing',
      schedule: 'daily' as const,
    },
  },
  {
    name: 'Weekly Review',
    icon: '📊',
    desc: 'Weekly productivity report every Monday',
    form: {
      name: 'Weekly Review',
      trigger: 'Every Monday at 9:00 AM',
      action: 'Generate a weekly productivity summary and goal review',
      schedule: 'weekly' as const,
    },
  },
  {
    name: 'Bill Alert',
    icon: '💳',
    desc: 'Reminders before bills are due',
    form: {
      name: 'Bill Alert',
      trigger: 'When a bill due date is 3 days away',
      action: 'Create a high-priority reminder for the upcoming bill',
      schedule: 'on_event' as const,
    },
  },
  {
    name: 'Task Digest',
    icon: '✅',
    desc: 'Daily digest of pending tasks at end of day',
    form: {
      name: 'Task Digest',
      trigger: 'Every day at 6:00 PM',
      action: 'Summarize all pending tasks and priorities for tomorrow',
      schedule: 'daily' as const,
    },
  },
  {
    name: 'Email Summary',
    icon: '📧',
    desc: 'Daily summary of unread emails',
    form: {
      name: 'Email Summary',
      trigger: 'Every day at 5:00 PM',
      action: 'Summarize unread emails and highlight action items',
      schedule: 'daily' as const,
    },
  },
  {
    name: 'Custom',
    icon: '⚡',
    desc: 'Build your own automation workflow',
    form: EMPTY_FORM,
  },
]

function formatLastRun(lastRun: string | null): string {
  if (!lastRun) return 'Never'
  const date = new Date(lastRun)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

const LS_KEY = 'nexus_location_triggers'

function loadLocationTriggers(): LocationTrigger[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocationTriggers(triggers: LocationTrigger[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LS_KEY, JSON.stringify(triggers))
}

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [running, setRunning] = useState<string | null>(null)
  const [runResult, setRunResult] = useState<{ id: string; success: boolean; message: string } | null>(null)

  // Location trigger state
  const [locationTriggers, setLocationTriggers] = useState<LocationTrigger[]>([])
  const [showLocationPanel, setShowLocationPanel] = useState(false)
  const [locationForm, setLocationForm] = useState<LocationFormState>(EMPTY_LOCATION_FORM)
  const [geoLoading, setGeoLoading] = useState(false)
  const [testingLocation, setTestingLocation] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null)

  // Load location triggers from localStorage on mount
  useEffect(() => {
    setLocationTriggers(loadLocationTriggers())
  }, [])

  async function handleRunNow(automation: Automation) {
    setRunning(automation.id)
    setRunResult(null)
    try {
      const res = await fetch('/api/automations/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ automationId: automation.id }),
      })
      const data = await res.json()
      setRunResult({ id: automation.id, success: res.ok, message: data.message || data.error || 'Done' })
      if (res.ok) fetchAutomations()
    } catch {
      setRunResult({ id: automation.id, success: false, message: 'Network error' })
    } finally {
      setRunning(null)
    }
  }

  const fetchAutomations = useCallback(async () => {
    try {
      const res = await fetch('/api/automations')
      if (res.ok) {
        const data = await res.json()
        setAutomations(data.automations)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAutomations()
  }, [fetchAutomations])

  function applyTemplate(template: typeof TEMPLATES[0]) {
    setForm(template.form)
    setShowForm(true)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.trigger.trim() || !form.action.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          trigger: form.trigger,
          action: form.action,
          schedule: form.schedule,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setAutomations(prev => [data.automation, ...prev])
        setForm(EMPTY_FORM)
        setShowForm(false)
      }
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(automation: Automation) {
    const next = automation.status === 'active' ? 'paused' : 'active'
    setToggling(automation.id)
    try {
      const res = await fetch(`/api/automations/${automation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (res.ok) {
        setAutomations(prev =>
          prev.map(a => (a.id === automation.id ? { ...a, status: next } : a))
        )
      }
    } finally {
      setToggling(null)
    }
  }

  async function handleDelete(automation: Automation) {
    if (!confirm(`Delete "${automation.name}"? This cannot be undone.`)) return
    setDeleting(automation.id)
    try {
      const res = await fetch(`/api/automations/${automation.id}`, { method: 'DELETE' })
      if (res.ok) {
        setAutomations(prev => prev.filter(a => a.id !== automation.id))
      }
    } finally {
      setDeleting(null)
    }
  }

  // Location trigger handlers
  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.')
      return
    }
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationForm(prev => ({
          ...prev,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          location: prev.location || `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`,
        }))
        setGeoLoading(false)
      },
      () => {
        alert('Unable to retrieve your location. Please check browser permissions.')
        setGeoLoading(false)
      }
    )
  }

  function handleAddLocationTrigger(e: React.FormEvent) {
    e.preventDefault()
    if (!locationForm.name.trim() || !locationForm.location.trim() || !locationForm.action.trim()) return
    const newTrigger: LocationTrigger = {
      id: `loc_${Date.now()}`,
      name: locationForm.name,
      location: locationForm.location,
      lat: locationForm.lat,
      lng: locationForm.lng,
      radius: locationForm.radius,
      event: locationForm.event,
      action: locationForm.action,
      createdAt: new Date().toISOString(),
    }
    const updated = [newTrigger, ...locationTriggers]
    setLocationTriggers(updated)
    saveLocationTriggers(updated)
    setLocationForm(EMPTY_LOCATION_FORM)
  }

  function handleDeleteLocationTrigger(id: string) {
    const updated = locationTriggers.filter(t => t.id !== id)
    setLocationTriggers(updated)
    saveLocationTriggers(updated)
    if (testResult?.id === id) setTestResult(null)
  }

  async function handleTestLocationTrigger(trigger: LocationTrigger) {
    setTestingLocation(trigger.id)
    setTestResult(null)
    try {
      const res = await fetch('/api/automations/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          triggerId: trigger.id,
          triggerName: trigger.name,
          event: trigger.event,
          location: trigger.location,
          action: trigger.action,
        }),
      })
      const data = await res.json()
      setTestResult({ id: trigger.id, success: res.ok, message: data.message || data.error || 'Done' })
    } catch {
      setTestResult({ id: trigger.id, success: false, message: 'Network error' })
    } finally {
      setTestingLocation(null)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Automations" subtitle="Intelligent workflow engine" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-4">

          <div className="glass-panel rounded-xl p-4 border border-cyan-400/10 flex items-start gap-3">
            <Zap size={18} className="text-cyan-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-white/70 text-sm font-medium">Automation Engine — Live</p>
              <p className="text-white/40 text-xs mt-0.5">
                Create and manage your automations here. NEXUS AI in chat can manually trigger
                summaries and actions. Scheduled execution requires a background cron service.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => { setShowForm(v => !v); setForm(EMPTY_FORM) }}
              className="nexus-btn-primary flex items-center gap-2 text-sm"
            >
              <Plus size={16} />
              New Automation
            </button>
          </div>

          {showForm && (
            <div className="glass-panel rounded-2xl p-5 border border-cyan-400/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-medium">New Automation</h3>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-white/30 hover:text-white/60 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <form onSubmit={handleCreate} className="space-y-3">
                <div>
                  <label className="text-white/50 text-xs mb-1 block">Name</label>
                  <input
                    className="nexus-input w-full text-sm"
                    placeholder="e.g. Morning Briefing"
                    value={form.name}
                    onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs mb-1 block">Trigger</label>
                  <input
                    className="nexus-input w-full text-sm"
                    placeholder="e.g. Every day at 8 AM"
                    value={form.trigger}
                    onChange={e => setForm(prev => ({ ...prev, trigger: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs mb-1 block">Action</label>
                  <input
                    className="nexus-input w-full text-sm"
                    placeholder="e.g. Summarize tasks and send briefing"
                    value={form.action}
                    onChange={e => setForm(prev => ({ ...prev, action: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs mb-1 block">Schedule</label>
                  <select
                    className="nexus-input w-full text-sm"
                    value={form.schedule}
                    onChange={e => setForm(prev => ({ ...prev, schedule: e.target.value as FormState['schedule'] }))}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="on_event">On Event</option>
                    <option value="manual">Manual</option>
                    <option value="location">Location</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={saving}
                    className="nexus-btn-primary flex items-center gap-2 text-sm"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="text-white/40 hover:text-white/70 text-sm px-3 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Location Triggers Panel */}
          <div className="glass-panel rounded-2xl border border-cyan-400/10 overflow-hidden">
            <button
              onClick={() => setShowLocationPanel(v => !v)}
              className="w-full flex items-center justify-between p-5 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-3">
                <MapPin size={18} className="text-cyan-400" />
                <div className="text-left">
                  <p className="text-white font-medium text-sm">Location Triggers</p>
                  <p className="text-white/40 text-xs mt-0.5">
                    {locationTriggers.length > 0
                      ? `${locationTriggers.length} trigger${locationTriggers.length !== 1 ? 's' : ''} active`
                      : 'Run automations when you arrive or leave a place'}
                  </p>
                </div>
              </div>
              {showLocationPanel
                ? <ChevronUp size={16} className="text-white/40" />
                : <ChevronDown size={16} className="text-white/40" />
              }
            </button>

            {showLocationPanel && (
              <div className="border-t border-white/5 p-5 space-y-5">

                {/* Add Location Trigger Form */}
                <div>
                  <p className="text-white/50 text-xs uppercase tracking-wider mb-3">Add Location Trigger</p>
                  <form onSubmit={handleAddLocationTrigger} className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-white/50 text-xs mb-1 block">Trigger Name</label>
                        <input
                          className="nexus-input w-full text-sm"
                          placeholder="e.g. Arrive at Office"
                          value={locationForm.name}
                          onChange={e => setLocationForm(prev => ({ ...prev, name: e.target.value }))}
                          required
                        />
                      </div>
                      <div>
                        <label className="text-white/50 text-xs mb-1 block">Location</label>
                        <div className="flex gap-2">
                          <input
                            className="nexus-input flex-1 text-sm"
                            placeholder="Home, Office, Gym…"
                            value={locationForm.location}
                            onChange={e => setLocationForm(prev => ({ ...prev, location: e.target.value }))}
                            required
                          />
                          <button
                            type="button"
                            onClick={handleUseCurrentLocation}
                            disabled={geoLoading}
                            title="Use my current location"
                            className="px-3 py-2 rounded-lg border border-cyan-400/20 text-cyan-400 hover:bg-cyan-400/10 transition-colors text-xs flex items-center gap-1.5 disabled:opacity-50 flex-shrink-0"
                          >
                            {geoLoading
                              ? <Loader2 size={12} className="animate-spin" />
                              : <Navigation size={12} />
                            }
                            <span className="hidden sm:inline">GPS</span>
                          </button>
                        </div>
                        {locationForm.lat !== null && (
                          <p className="text-cyan-400/60 text-[10px] mt-1">
                            {locationForm.lat.toFixed(5)}, {locationForm.lng?.toFixed(5)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="text-white/50 text-xs mb-1 block">
                        Radius: <span className="text-cyan-400">{locationForm.radius}m</span>
                      </label>
                      <input
                        type="range"
                        min={100}
                        max={5000}
                        step={100}
                        value={locationForm.radius}
                        onChange={e => setLocationForm(prev => ({ ...prev, radius: parseInt(e.target.value) }))}
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                      <div className="flex justify-between text-white/25 text-[10px] mt-0.5">
                        <span>100m</span>
                        <span>5000m</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-white/50 text-xs mb-2 block">Event Type</label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setLocationForm(prev => ({ ...prev, event: 'arrive' }))}
                            className={cn(
                              'flex-1 py-2 rounded-lg border text-xs font-medium transition-colors',
                              locationForm.event === 'arrive'
                                ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-400'
                                : 'border-white/10 text-white/40 hover:text-white/60'
                            )}
                          >
                            On Arrive
                          </button>
                          <button
                            type="button"
                            onClick={() => setLocationForm(prev => ({ ...prev, event: 'depart' }))}
                            className={cn(
                              'flex-1 py-2 rounded-lg border text-xs font-medium transition-colors',
                              locationForm.event === 'depart'
                                ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-400'
                                : 'border-white/10 text-white/40 hover:text-white/60'
                            )}
                          >
                            On Depart
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-white/50 text-xs mb-1 block">Action</label>
                        <input
                          className="nexus-input w-full text-sm"
                          placeholder="e.g. Set status to Working"
                          value={locationForm.action}
                          onChange={e => setLocationForm(prev => ({ ...prev, action: e.target.value }))}
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="nexus-btn-primary flex items-center gap-2 text-sm"
                    >
                      <Plus size={14} />
                      Add Location Trigger
                    </button>
                  </form>
                </div>

                {/* Location Triggers List */}
                {locationTriggers.length > 0 && (
                  <div>
                    <p className="text-white/50 text-xs uppercase tracking-wider mb-3">Saved Location Triggers</p>
                    <div className="space-y-2">
                      {locationTriggers.map(trigger => (
                        <div
                          key={trigger.id}
                          className="glass-panel rounded-xl p-4 border border-white/5"
                        >
                          <div className="flex items-start gap-3">
                            <MapPin size={16} className="text-cyan-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-white/85 text-sm font-medium">{trigger.name}</p>
                                <span className={cn(
                                  'text-[10px] px-2 py-0.5 rounded-full border',
                                  trigger.event === 'arrive'
                                    ? 'text-green-400 border-green-400/30'
                                    : 'text-amber-400 border-amber-400/30'
                                )}>
                                  {trigger.event === 'arrive' ? 'On Arrive' : 'On Depart'}
                                </span>
                              </div>
                              <p className="text-white/45 text-xs mt-0.5">
                                {trigger.location} &bull; {trigger.radius}m radius
                              </p>
                              <p className="text-white/35 text-xs mt-0.5 truncate">{trigger.action}</p>
                              {testResult?.id === trigger.id && (
                                <p className={`text-[10px] mt-1 ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                                  {testResult.message}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                onClick={() => handleTestLocationTrigger(trigger)}
                                disabled={testingLocation === trigger.id}
                                title="Test Now"
                                className="text-white/30 hover:text-cyan-400 transition-colors p-1.5 rounded-lg hover:bg-cyan-400/5 disabled:opacity-40 text-xs flex items-center gap-1"
                              >
                                {testingLocation === trigger.id
                                  ? <Loader2 size={12} className="animate-spin" />
                                  : <Play size={12} />
                                }
                              </button>
                              <button
                                onClick={() => handleDeleteLocationTrigger(trigger.id)}
                                title="Delete"
                                className="text-white/20 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-400/5"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* How It Works info box */}
                <div className="flex items-start gap-3 p-4 rounded-xl bg-cyan-400/5 border border-cyan-400/15">
                  <Info size={16} className="text-cyan-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-cyan-400 text-xs font-medium mb-1">How Location Triggers Work</p>
                    <p className="text-white/45 text-xs leading-relaxed">
                      Location triggers use your device&apos;s GPS to detect when you enter or leave a saved place.
                      Install NEXUS as a PWA for background location checks — when you&apos;re within the radius of a
                      saved location, the specified action will run automatically. GPS access requires your
                      permission and may affect battery life.
                    </p>
                  </div>
                </div>

              </div>
            )}
          </div>

          <div>
            <p className="text-white/30 text-xs uppercase tracking-wider mb-2">Your Automations</p>
            {loading ? (
              <div className="glass-panel rounded-xl p-8 flex justify-center">
                <Loader2 size={20} className="animate-spin text-white/30" />
              </div>
            ) : automations.length === 0 ? (
              <div className="glass-panel rounded-xl p-8 text-center">
                <Zap size={32} className="text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm">No automations yet.</p>
                <p className="text-white/20 text-xs mt-1">Create one above or choose a template below.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {automations.map(auto => (
                  <div key={auto.id} className="glass-panel-hover rounded-xl p-4 flex items-center gap-4">
                    <div className={cn(
                      'w-2 h-2 rounded-full flex-shrink-0',
                      auto.status === 'active' ? 'bg-green-400' : 'bg-white/20'
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white/85 font-medium text-sm">{auto.name}</p>
                      <div className="flex items-center gap-1 mt-0.5 text-white/35 text-xs flex-wrap">
                        <Clock size={10} />
                        <span className="truncate max-w-[160px]">{auto.trigger}</span>
                        <ArrowRight size={10} className="mx-1 flex-shrink-0" />
                        <span className="truncate max-w-[200px]">{auto.actions}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-white/25 text-[10px]">Last run: {formatLastRun(auto.lastRun)}</p>
                        {auto.runCount > 0 && (
                          <p className="text-white/20 text-[10px]">{auto.runCount} run{auto.runCount !== 1 ? 's' : ''}</p>
                        )}
                      </div>
                      {runResult?.id === auto.id && (
                        <p className={`text-[10px] mt-1 ${runResult.success ? 'text-green-400' : 'text-red-400'}`}>
                          {runResult.message}
                        </p>
                      )}
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
                        onClick={() => handleRunNow(auto)}
                        disabled={running === auto.id}
                        title="Run now"
                        className="text-white/30 hover:text-cyan-400 transition-colors p-1.5 rounded-lg hover:bg-cyan-400/5 disabled:opacity-40"
                      >
                        {running === auto.id
                          ? <Loader2 size={14} className="animate-spin" />
                          : <RotateCcw size={14} />
                        }
                      </button>
                      <button
                        onClick={() => toggleStatus(auto)}
                        disabled={toggling === auto.id}
                        title={auto.status === 'active' ? 'Pause' : 'Resume'}
                        className="text-white/30 hover:text-cyan-400 transition-colors p-1.5 rounded-lg hover:bg-cyan-400/5 disabled:opacity-40"
                      >
                        {toggling === auto.id
                          ? <Loader2 size={14} className="animate-spin" />
                          : auto.status === 'active' ? <Pause size={14} /> : <Play size={14} />
                        }
                      </button>
                      <button
                        onClick={() => handleDelete(auto)}
                        disabled={deleting === auto.id}
                        title="Delete"
                        className="text-white/20 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-400/5 disabled:opacity-40"
                      >
                        {deleting === auto.id
                          ? <Loader2 size={14} className="animate-spin" />
                          : <Trash2 size={14} />
                        }
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-panel rounded-2xl p-5">
            <h3 className="text-white font-medium mb-4">Templates</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {TEMPLATES.map(t => (
                <button
                  key={t.name}
                  onClick={() => applyTemplate(t)}
                  className="text-left glass-panel-hover rounded-xl p-3 transition-all"
                >
                  <span className="text-2xl block mb-2">{t.icon}</span>
                  <p className="text-white/80 text-sm font-medium">{t.name}</p>
                  <p className="text-white/40 text-xs mt-1">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-xl p-5">
            <p className="text-white/50 text-xs uppercase tracking-wider mb-3">How It Works</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { step: '1', title: 'Trigger', desc: 'Time-based, event-based, location-based, or condition-based triggers start your workflow', icon: '⚡' },
                { step: '2', title: 'Conditions', desc: 'Optional filters and conditions to control when the automation runs', icon: '🔍' },
                { step: '3', title: 'Actions', desc: 'NEXUS executes tasks, sends notifications, and creates summaries', icon: '✅' },
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
