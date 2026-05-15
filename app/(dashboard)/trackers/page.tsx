'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { BarChart2, Plus, Trash2, X, DollarSign, Calendar, Tag, List, PieChart as PieChartIcon } from 'lucide-react'
import { cn, formatDate, formatRelativeTime } from '@/lib/utils'
import toast from 'react-hot-toast'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

interface Tracker {
  id: string
  type: string
  title: string
  description?: string
  status: string
  dueDate?: string
  amount?: number
  currency?: string
  tags?: string
  createdAt: string
}

const TRACKER_TYPES = ['bill', 'subscription', 'expense', 'package', 'habit', 'goal', 'job_application', 'custom']

const TYPE_COLORS: Record<string, string> = {
  bill: 'text-red-400 bg-red-400/10',
  subscription: 'text-orange-400 bg-orange-400/10',
  expense: 'text-yellow-400 bg-yellow-400/10',
  package: 'text-blue-400 bg-blue-400/10',
  habit: 'text-green-400 bg-green-400/10',
  goal: 'text-violet-400 bg-violet-400/10',
  job_application: 'text-cyan-400 bg-cyan-400/10',
  custom: 'text-white/50 bg-white/5',
}

const TYPE_ICONS: Record<string, string> = {
  bill: '💳', subscription: '🔄', expense: '💰', package: '📦',
  habit: '🎯', goal: '⭐', job_application: '💼', custom: '📌',
}

// NEXUS color palette for charts
const CHART_COLORS = [
  '#00d4ff', // cyan
  '#7c3aed', // violet
  '#4ade80', // green
  '#facc15', // yellow
  '#fb923c', // orange
  '#f472b6', // pink
  '#60a5fa', // blue
  '#f87171', // red
]

export default function TrackersPage() {
  const [trackers, setTrackers] = useState<Tracker[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [typeFilter, setTypeFilter] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'chart'>('list')
  const [form, setForm] = useState({
    type: 'subscription',
    title: '',
    description: '',
    amount: '',
    currency: 'USD',
    dueDate: '',
    tags: '',
  })

  useEffect(() => { fetchTrackers() }, [typeFilter])

  async function fetchTrackers() {
    setLoading(true)
    try {
      const params = typeFilter ? `?type=${typeFilter}` : ''
      const res = await fetch(`/api/trackers${params}`)
      const data = await res.json()
      setTrackers(data.trackers || [])
    } catch {
      toast.error('Failed to load trackers')
    } finally {
      setLoading(false)
    }
  }

  async function createTracker(e: React.FormEvent) {
    e.preventDefault()
    try {
      const res = await fetch('/api/trackers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amount: form.amount ? parseFloat(form.amount) : undefined,
          dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Tracker created')
      setForm({ type: 'subscription', title: '', description: '', amount: '', currency: 'USD', dueDate: '', tags: '' })
      setShowForm(false)
      fetchTrackers()
    } catch {
      toast.error('Failed to create tracker')
    }
  }

  async function updateStatus(id: string, status: string) {
    try {
      await fetch(`/api/trackers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      setTrackers(prev => prev.map(t => t.id === id ? { ...t, status } : t))
      toast.success('Tracker updated')
    } catch {
      toast.error('Failed to update tracker')
    }
  }

  async function deleteTracker(id: string) {
    if (!confirm('Delete this tracker?')) return
    try {
      await fetch(`/api/trackers/${id}`, { method: 'DELETE' })
      setTrackers(prev => prev.filter(t => t.id !== id))
      toast.success('Tracker deleted')
    } catch {
      toast.error('Failed to delete tracker')
    }
  }

  const totalMonthly = trackers
    .filter(t => t.type === 'subscription' && t.status === 'active' && t.amount)
    .reduce((sum, t) => sum + (t.amount || 0), 0)

  // Chart data: count by type
  const barData = TRACKER_TYPES
    .map(type => ({
      type: type.replace('_', ' '),
      count: trackers.filter(t => t.type === type).length,
    }))
    .filter(d => d.count > 0)

  // Pie data: amount by type (for trackers with amounts)
  const pieMap: Record<string, number> = {}
  trackers.forEach(t => {
    if (t.amount) {
      const key = t.type.replace('_', ' ')
      pieMap[key] = (pieMap[key] || 0) + t.amount
    }
  })
  const pieData = Object.entries(pieMap).map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }))

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Trackers" subtitle="Monitor bills, subscriptions, habits & goals" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-5xl mx-auto space-y-4">

          {/* Summary */}
          {totalMonthly > 0 && (
            <div className="glass-panel rounded-xl p-4 flex items-center gap-4">
              <DollarSign size={20} className="text-cyan-400" />
              <div>
                <p className="text-white/50 text-xs">Monthly Subscriptions</p>
                <p className="text-white font-bold text-xl">${totalMonthly.toFixed(2)}</p>
              </div>
            </div>
          )}

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowForm(!showForm)}
              className="nexus-btn-primary flex items-center gap-2 text-sm"
            >
              <Plus size={16} />
              New Tracker
            </button>

            {/* View mode toggle */}
            <div className="flex rounded-lg border border-white/10 overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs transition-all border-r border-white/10',
                  viewMode === 'list' ? 'bg-cyan-400/20 text-cyan-400' : 'text-white/50 hover:text-white/70 hover:bg-white/5'
                )}
              >
                <List size={13} />
                List
              </button>
              <button
                onClick={() => setViewMode('chart')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs transition-all',
                  viewMode === 'chart' ? 'bg-cyan-400/20 text-cyan-400' : 'text-white/50 hover:text-white/70 hover:bg-white/5'
                )}
              >
                <BarChart2 size={13} />
                Chart
              </button>
            </div>

            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setTypeFilter('')}
                className={cn('px-3 py-1.5 rounded-lg text-xs transition-all', !typeFilter ? 'bg-cyan-400/15 border border-cyan-400/30 text-cyan-400' : 'text-white/40 border border-white/5 hover:text-white/60')}
              >All</button>
              {TRACKER_TYPES.map(t => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={cn('px-3 py-1.5 rounded-lg text-xs transition-all capitalize', typeFilter === t ? 'bg-cyan-400/15 border border-cyan-400/30 text-cyan-400' : 'text-white/40 border border-white/5 hover:text-white/60')}
                >
                  {TYPE_ICONS[t]} {t.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          {showForm && (
            <div className="glass-panel rounded-2xl p-5">
              <h3 className="text-white font-medium mb-4">New Tracker</h3>
              <form onSubmit={createTracker} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="nexus-input"
                  >
                    {TRACKER_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                  </select>
                  <input
                    type="text"
                    placeholder="Title *"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    required
                    className="nexus-input"
                  />
                </div>
                <textarea
                  placeholder="Description (optional)"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="nexus-input resize-none"
                />
                <div className="grid grid-cols-3 gap-3">
                  <input
                    type="number"
                    placeholder="Amount"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    step="0.01"
                    className="nexus-input"
                  />
                  <select
                    value={form.currency}
                    onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                    className="nexus-input"
                  >
                    {['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                    className="nexus-input"
                    placeholder="Due/renewal date"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Tags (comma separated)"
                  value={form.tags}
                  onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                  className="nexus-input"
                />
                <div className="flex gap-2">
                  <button type="submit" className="nexus-btn-primary flex-1">Create Tracker</button>
                  <button type="button" onClick={() => setShowForm(false)} className="nexus-btn-secondary px-4"><X size={16} /></button>
                </div>
              </form>
            </div>
          )}

          {/* Chart View */}
          {viewMode === 'chart' && !loading && (
            <div className="space-y-4">
              {trackers.length === 0 ? (
                <div className="text-center py-16 glass-panel rounded-2xl">
                  <BarChart2 size={40} className="text-white/20 mx-auto mb-3" />
                  <p className="text-white/40 font-medium">No trackers to chart</p>
                </div>
              ) : (
                <>
                  {/* Bar Chart — count by type */}
                  <div className="glass-panel rounded-2xl p-5">
                    <h3 className="text-white/70 text-sm font-medium mb-4 flex items-center gap-2">
                      <BarChart2 size={15} className="text-cyan-400" />
                      Trackers by Type
                    </h3>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={barData} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                        <XAxis
                          dataKey="type"
                          tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            background: 'rgba(10,10,26,0.95)',
                            border: '1px solid rgba(0,212,255,0.2)',
                            borderRadius: '8px',
                            color: '#fff',
                            fontSize: 12,
                          }}
                          cursor={{ fill: 'rgba(0,212,255,0.05)' }}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {barData.map((_, idx) => (
                            <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Pie Chart — amounts by type */}
                  {pieData.length > 0 && (
                    <div className="glass-panel rounded-2xl p-5">
                      <h3 className="text-white/70 text-sm font-medium mb-4 flex items-center gap-2">
                        <PieChartIcon size={15} className="text-violet-400" />
                        Amount Distribution by Type
                      </h3>
                      <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            paddingAngle={3}
                            label={({ name, percent }: { name?: string; percent?: number }): string => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%` as string}
                            labelLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                          >
                            {pieData.map((_, idx) => (
                              <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              background: 'rgba(10,10,26,0.95)',
                              border: '1px solid rgba(0,212,255,0.2)',
                              borderRadius: '8px',
                              color: '#fff',
                              fontSize: 12,
                            }}
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            formatter={(value: any) => [`$${Number(value ?? 0).toFixed(2)}`, 'Amount']}
                          />
                          <Legend
                            wrapperStyle={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* List View */}
          {viewMode === 'list' && (
            loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
              </div>
            ) : trackers.length === 0 ? (
              <div className="text-center py-16 glass-panel rounded-2xl">
                <BarChart2 size={40} className="text-white/20 mx-auto mb-3" />
                <p className="text-white/40 font-medium">No trackers yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {trackers.map(tracker => (
                  <div key={tracker.id} className="glass-panel-hover rounded-xl p-4 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg">{TYPE_ICONS[tracker.type] || '📌'}</span>
                        <div className="min-w-0">
                          <p className="text-white/85 font-medium text-sm truncate">{tracker.title}</p>
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded capitalize', TYPE_COLORS[tracker.type] || TYPE_COLORS.custom)}>
                            {tracker.type.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {tracker.amount && (
                          <span className="text-cyan-400 text-sm font-mono font-medium">
                            {tracker.currency || '$'}{tracker.amount.toFixed(2)}
                          </span>
                        )}
                        <button
                          onClick={() => updateStatus(tracker.id, tracker.status === 'active' ? 'completed' : 'active')}
                          className={cn(
                            'text-xs px-2 py-1 rounded-full border transition-all',
                            tracker.status === 'active'
                              ? 'text-green-400 border-green-400/30 bg-green-400/5'
                              : 'text-white/30 border-white/10'
                          )}
                        >
                          {tracker.status}
                        </button>
                        <button onClick={() => deleteTracker(tracker.id)} className="text-white/20 hover:text-red-400 transition-colors p-1">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    {tracker.description && <p className="text-white/40 text-xs">{tracker.description}</p>}
                    <div className="flex items-center gap-3 mt-1">
                      {tracker.dueDate && (
                        <span className="text-white/35 text-xs flex items-center gap-1">
                          <Calendar size={10} />
                          {formatDate(tracker.dueDate)}
                        </span>
                      )}
                      {tracker.tags && (
                        <span className="text-white/35 text-xs flex items-center gap-1">
                          <Tag size={10} />
                          {tracker.tags}
                        </span>
                      )}
                      <span className="text-white/20 text-[10px] ml-auto">{formatRelativeTime(tracker.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
