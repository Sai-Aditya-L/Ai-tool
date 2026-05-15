'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { Plus, Trash2, Loader2, Download, CloudSun, Luggage, MapPin, DollarSign, X } from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Trip {
  id: string
  title: string
  description?: string
  status: string
  dueDate?: string
  amount?: number
  currency?: string
  data?: string
}

interface TripData {
  destination: string
  startDate: string
  endDate: string
  notes: string
}

interface Expense {
  id: string
  category: string
  amount: number
  note: string
  date: string
}

interface ExpenseData {
  expenses: Expense[]
}

interface WeatherDay {
  date: string
  maxTemp: number
  minTemp: number
  weatherCode: number
  precipSum: number
  weatherLabel: string
}

interface WeatherResult {
  city: string
  country: string
  current: {
    temp: number
    weatherLabel: string
    icon: string
  }
  forecast: WeatherDay[]
}

type TabId = 'trips' | 'packing' | 'weather' | 'budget'

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'trips', label: 'Trips', icon: <MapPin size={13} /> },
  { id: 'packing', label: 'Packing Lists', icon: <Luggage size={13} /> },
  { id: 'weather', label: 'Weather', icon: <CloudSun size={13} /> },
  { id: 'budget', label: 'Budget', icon: <DollarSign size={13} /> },
]

const TRIP_TYPES = ['Beach', 'Mountain', 'City', 'Business', 'Adventure']
const EXPENSE_CATEGORIES = ['Flight', 'Hotel', 'Food', 'Activities', 'Transport', 'Other']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseTripData(trip: Trip): TripData {
  try {
    return trip.data ? JSON.parse(trip.data) : { destination: trip.title, startDate: '', endDate: '', notes: trip.description || '' }
  } catch {
    return { destination: trip.title, startDate: '', endDate: '', notes: trip.description || '' }
  }
}

function parseExpenseData(trip: Trip): ExpenseData {
  try {
    const raw = trip.data ? JSON.parse(trip.data) : {}
    return { expenses: raw.expenses || [] }
  } catch {
    return { expenses: [] }
  }
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function TravelPage() {
  const [tab, setTab] = useState<TabId>('trips')

  return (
    <div className="flex flex-col h-full min-h-0">
      <Header title="TRAVEL" subtitle="Atlas travel planning workspace" />

      {/* Tab bar */}
      <div className="flex border-b border-cyan-400/10 px-4 pt-2 flex-shrink-0 bg-black/20">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs nexus-mono border-b-2 transition-all mr-1 ${
              tab === t.id
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        {tab === 'trips' && <TripsTab />}
        {tab === 'packing' && <PackingTab />}
        {tab === 'weather' && <WeatherTab />}
        {tab === 'budget' && <BudgetTab />}
      </div>
    </div>
  )
}

// ─── Trips Tab ────────────────────────────────────────────────────────────────

function TripsTab() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ destination: '', startDate: '', endDate: '', notes: '', budget: '' })

  const fetchTrips = useCallback(async () => {
    try {
      const res = await fetch('/api/trackers?type=travel')
      if (!res.ok) return
      const data = await res.json()
      setTrips(data.trackers || [])
    } catch {
      toast.error('Failed to load trips')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTrips() }, [fetchTrips])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.destination.trim()) return
    setSubmitting(true)
    try {
      const tripData: TripData = {
        destination: form.destination,
        startDate: form.startDate,
        endDate: form.endDate,
        notes: form.notes,
      }
      const res = await fetch('/api/trackers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'travel',
          title: form.destination,
          description: form.notes,
          status: 'active',
          dueDate: form.startDate || undefined,
          amount: form.budget ? parseFloat(form.budget) : undefined,
          currency: 'USD',
          data: JSON.stringify({ ...tripData, expenses: [] }),
        }),
      })
      if (!res.ok) throw new Error('Failed to create trip')
      toast.success('Trip created')
      setForm({ destination: '', startDate: '', endDate: '', notes: '', budget: '' })
      setShowForm(false)
      fetchTrips()
    } catch {
      toast.error('Failed to create trip')
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteTrip(id: string) {
    try {
      const res = await fetch(`/api/trackers/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Trip deleted')
      setTrips(prev => prev.filter(t => t.id !== id))
    } catch {
      toast.error('Failed to delete trip')
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white/60 nexus-mono">MY TRIPS</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-400 text-black text-xs font-semibold nexus-mono hover:bg-cyan-300 transition-colors"
        >
          <Plus size={12} />
          New Trip
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-xl border border-cyan-400/20 bg-cyan-400/3 p-5 space-y-4">
          <h3 className="text-xs font-semibold text-cyan-400 nexus-mono tracking-wider">NEW TRIP</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] text-white/40 nexus-mono block mb-1">Destination *</label>
              <input
                type="text"
                value={form.destination}
                onChange={e => setForm(f => ({ ...f, destination: e.target.value }))}
                placeholder="Where are you going?"
                required
                className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/3 text-white/80 text-sm placeholder-white/25 outline-none focus:border-cyan-400/40 transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-white/40 nexus-mono block mb-1">Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/3 text-white/80 text-sm outline-none focus:border-cyan-400/40 transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-white/40 nexus-mono block mb-1">End Date</label>
              <input
                type="date"
                value={form.endDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/3 text-white/80 text-sm outline-none focus:border-cyan-400/40 transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-white/40 nexus-mono block mb-1">Budget (USD)</label>
              <input
                type="number"
                value={form.budget}
                onChange={e => setForm(f => ({ ...f, budget: e.target.value }))}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/3 text-white/80 text-sm placeholder-white/25 outline-none focus:border-cyan-400/40 transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-white/40 nexus-mono block mb-1">Notes</label>
              <input
                type="text"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any notes..."
                className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/3 text-white/80 text-sm placeholder-white/25 outline-none focus:border-cyan-400/40 transition-colors"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-400 text-black text-xs font-semibold nexus-mono hover:bg-cyan-300 transition-colors disabled:opacity-40"
            >
              {submitting ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              Create Trip
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-white/10 text-white/50 text-xs nexus-mono hover:text-white/80 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin text-cyan-400/50" />
        </div>
      ) : trips.length === 0 ? (
        <div className="text-center py-16 text-white/30 text-sm nexus-mono">
          No trips yet — create your first trip above
        </div>
      ) : (
        <div className="space-y-3">
          {trips.map(trip => {
            const td = parseTripData(trip)
            return (
              <div key={trip.id} className="rounded-xl border border-white/8 bg-white/2 p-4 hover:border-cyan-400/20 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin size={13} className="text-cyan-400/60 flex-shrink-0" />
                      <h3 className="font-semibold text-white truncate">{td.destination}</h3>
                    </div>
                    {(td.startDate || td.endDate) && (
                      <div className="text-xs text-white/40 nexus-mono mb-1">
                        {td.startDate && new Date(td.startDate).toLocaleDateString()} {td.startDate && td.endDate && '→'} {td.endDate && new Date(td.endDate).toLocaleDateString()}
                      </div>
                    )}
                    {trip.amount && (
                      <div className="text-xs text-cyan-400/70 nexus-mono">Budget: ${trip.amount.toLocaleString()} {trip.currency || 'USD'}</div>
                    )}
                    {td.notes && <p className="text-sm text-white/40 mt-1 line-clamp-2">{td.notes}</p>}
                  </div>
                  <button onClick={() => deleteTrip(trip.id)} className="p-1.5 rounded text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-all flex-shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Packing Tab ──────────────────────────────────────────────────────────────

function PackingTab() {
  const [destination, setDestination] = useState('')
  const [tripType, setTripType] = useState('City')
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<{ label: string; checked: boolean }[]>([])

  async function generateList() {
    if (!destination.trim()) { toast.error('Enter a destination'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Generate a comprehensive packing list for a ${tripType.toLowerCase()} trip to ${destination}. Format as a plain list, one item per line, grouped by category (e.g., "Clothing:", "Toiletries:", "Electronics:", "Documents:", "Misc:"). Keep each item concise. Output only the list, no intro text.`,
          }],
        }),
      })
      if (!res.ok) throw new Error('Failed to generate list')
      const data = await res.json()
      const text: string = data.message || data.content || data.response || ''
      const parsed = text.split('\n').map(line => line.trim()).filter(Boolean).map(label => ({ label, checked: false }))
      setItems(parsed)
    } catch {
      toast.error('Failed to generate packing list')
    } finally {
      setLoading(false)
    }
  }

  function toggleItem(i: number) {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, checked: !item.checked } : item))
  }

  function exportList() {
    const text = `Packing List: ${tripType} trip to ${destination}\n\n` +
      items.map(item => `[${item.checked ? 'x' : ' '}] ${item.label}`).join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `packing-list-${destination}-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const checkedCount = items.filter(i => i.checked).length

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="rounded-xl border border-white/10 bg-white/2 p-5 space-y-4">
        <h2 className="text-xs font-semibold text-white/50 nexus-mono tracking-wider">GENERATE PACKING LIST</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-white/40 nexus-mono block mb-1">Destination</label>
            <input
              type="text"
              value={destination}
              onChange={e => setDestination(e.target.value)}
              placeholder="e.g. Tokyo, Japan"
              className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/3 text-white/80 text-sm placeholder-white/25 outline-none focus:border-cyan-400/40 transition-colors"
            />
          </div>
          <div>
            <label className="text-[10px] text-white/40 nexus-mono block mb-1">Trip Type</label>
            <select
              value={tripType}
              onChange={e => setTripType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-white/10 bg-[#000810] text-white/80 text-sm outline-none focus:border-cyan-400/40 transition-colors"
            >
              {TRIP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <button
          onClick={generateList}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-400 text-black text-xs font-semibold nexus-mono hover:bg-cyan-300 transition-colors disabled:opacity-40"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Luggage size={13} />}
          {loading ? 'Generating...' : 'Generate List'}
        </button>
      </div>

      {items.length > 0 && (
        <div className="rounded-xl border border-white/8 bg-white/2 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
            <span className="text-xs text-white/50 nexus-mono">
              {checkedCount}/{items.length} packed
            </span>
            <button onClick={exportList} className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-white/10 text-white/50 text-xs nexus-mono hover:text-white/80 hover:border-white/20 transition-all">
              <Download size={11} />
              Export
            </button>
          </div>
          <div className="p-4 space-y-1 max-h-[500px] overflow-y-auto">
            {items.map((item, i) => {
              const isHeader = item.label.endsWith(':') && !item.label.startsWith('-') && !item.label.startsWith('•') && !item.label.startsWith('*')
              if (isHeader) {
                return (
                  <div key={i} className="text-[10px] font-semibold text-cyan-400/70 nexus-mono tracking-wider mt-3 mb-1 first:mt-0">
                    {item.label}
                  </div>
                )
              }
              return (
                <label key={i} className="flex items-center gap-2.5 py-1.5 cursor-pointer group">
                  <div
                    onClick={() => toggleItem(i)}
                    className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all ${
                      item.checked ? 'bg-cyan-400 border-cyan-400' : 'border-white/20 group-hover:border-cyan-400/40'
                    }`}
                  >
                    {item.checked && <span className="text-black text-[9px] font-bold">✓</span>}
                  </div>
                  <span className={`text-sm transition-all ${item.checked ? 'text-white/30 line-through' : 'text-white/70'}`}>
                    {item.label.replace(/^[-•*]\s*/, '')}
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Weather Tab ──────────────────────────────────────────────────────────────

function WeatherTab() {
  const [cities, setCities] = useState<{ input: string; data: WeatherResult | null; loading: boolean; error: string | null }[]>([
    { input: '', data: null, loading: false, error: null }
  ])

  async function fetchWeather(idx: number) {
    const city = cities[idx].input.trim()
    if (!city) { toast.error('Enter a city name'); return }
    setCities(prev => prev.map((c, i) => i === idx ? { ...c, loading: true, error: null } : c))
    try {
      const res = await fetch(`/api/weather?city=${encodeURIComponent(city)}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'City not found')
      }
      const data = await res.json()
      setCities(prev => prev.map((c, i) => i === idx ? { ...c, data, loading: false } : c))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch weather'
      setCities(prev => prev.map((c, i) => i === idx ? { ...c, error: msg, loading: false } : c))
      toast.error(msg)
    }
  }

  function addCity() {
    if (cities.length >= 3) { toast.error('Maximum 3 cities'); return }
    setCities(prev => [...prev, { input: '', data: null, loading: false, error: null }])
  }

  function removeCity(idx: number) {
    setCities(prev => prev.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-white/50 nexus-mono tracking-wider">WEATHER COMPARISON</h2>
        {cities.length < 3 && (
          <button onClick={addCity} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-400/20 text-cyan-400/70 hover:text-cyan-400 hover:border-cyan-400/40 text-xs nexus-mono transition-all">
            <Plus size={12} />
            Add City
          </button>
        )}
      </div>

      <div className={`grid gap-4 ${cities.length === 1 ? 'max-w-md' : cities.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {cities.map((city, idx) => (
          <div key={idx} className="rounded-xl border border-white/8 bg-white/2 overflow-hidden">
            <div className="flex items-center gap-2 p-3 border-b border-white/8">
              <input
                type="text"
                value={city.input}
                onChange={e => setCities(prev => prev.map((c, i) => i === idx ? { ...c, input: e.target.value } : c))}
                onKeyDown={e => e.key === 'Enter' && fetchWeather(idx)}
                placeholder="Enter city..."
                className="flex-1 px-2 py-1.5 rounded border border-white/10 bg-white/3 text-white/80 text-sm placeholder-white/25 outline-none focus:border-cyan-400/40 transition-colors"
              />
              <button
                onClick={() => fetchWeather(idx)}
                disabled={city.loading}
                className="px-2.5 py-1.5 rounded bg-cyan-400 text-black text-xs font-semibold nexus-mono hover:bg-cyan-300 transition-colors disabled:opacity-40"
              >
                {city.loading ? <Loader2 size={11} className="animate-spin" /> : <CloudSun size={11} />}
              </button>
              {cities.length > 1 && (
                <button onClick={() => removeCity(idx)} className="p-1.5 rounded text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-all">
                  <X size={12} />
                </button>
              )}
            </div>

            {city.loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={18} className="animate-spin text-cyan-400/50" />
              </div>
            )}

            {city.error && !city.loading && (
              <div className="p-4 text-center text-red-400/70 text-xs nexus-mono">{city.error}</div>
            )}

            {!city.loading && !city.error && !city.data && (
              <div className="p-6 text-center text-white/25 text-xs nexus-mono">Enter a city and press Enter</div>
            )}

            {city.data && !city.loading && (
              <div className="p-4">
                <div className="text-center mb-4">
                  <div className="text-2xl mb-1">{city.data.current.icon}</div>
                  <div className="font-semibold text-white">{city.data.city}, {city.data.country}</div>
                  <div className="text-3xl font-bold text-cyan-400 nexus-mono mt-1">{Math.round(city.data.current.temp)}°C</div>
                  <div className="text-xs text-white/40 nexus-mono mt-0.5">{city.data.current.weatherLabel}</div>
                </div>
                <div className="space-y-1.5">
                  {(city.data.forecast || []).slice(0, 5).map((day, di) => (
                    <div key={di} className="flex items-center justify-between text-xs py-1 border-b border-white/5">
                      <span className="text-white/50 nexus-mono w-16">{new Date(day.date + 'T12:00').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                      <span className="text-white/30 flex-1 text-center text-[10px]">{day.weatherLabel}</span>
                      <span className="text-white/70 nexus-mono">
                        <span className="text-orange-400">{Math.round(day.maxTemp)}°</span>
                        <span className="text-white/30"> / </span>
                        <span className="text-cyan-400/70">{Math.round(day.minTemp)}°</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Budget Tab ───────────────────────────────────────────────────────────────

function BudgetTab() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [selectedTripId, setSelectedTripId] = useState<string>('')
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [tripsLoading, setTripsLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newExpense, setNewExpense] = useState({ category: 'Food', amount: '', note: '', date: new Date().toISOString().split('T')[0] })

  useEffect(() => {
    fetch('/api/trackers?type=travel')
      .then(r => r.json())
      .then(d => { setTrips(d.trackers || []); setTripsLoading(false) })
      .catch(() => setTripsLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedTripId) { setExpenses([]); return }
    const trip = trips.find(t => t.id === selectedTripId)
    if (!trip) return
    const parsed = parseExpenseData(trip)
    setExpenses(parsed.expenses)
  }, [selectedTripId, trips])

  const selectedTrip = trips.find(t => t.id === selectedTripId)

  async function saveExpenses(updated: Expense[]) {
    if (!selectedTripId || !selectedTrip) return
    setSaving(true)
    try {
      const existingData = selectedTrip.data ? JSON.parse(selectedTrip.data) : {}
      const newData = { ...existingData, expenses: updated }
      const res = await fetch(`/api/trackers/${selectedTripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: JSON.stringify(newData) }),
      })
      if (!res.ok) throw new Error()
      setTrips(prev => prev.map(t => t.id === selectedTripId ? { ...t, data: JSON.stringify(newData) } : t))
    } catch {
      toast.error('Failed to save expenses')
    } finally {
      setSaving(false)
    }
  }

  async function addExpense(e: React.FormEvent) {
    e.preventDefault()
    if (!newExpense.amount || parseFloat(newExpense.amount) <= 0) { toast.error('Enter a valid amount'); return }
    const expense: Expense = {
      id: Date.now().toString(),
      category: newExpense.category,
      amount: parseFloat(newExpense.amount),
      note: newExpense.note,
      date: newExpense.date,
    }
    const updated = [...expenses, expense]
    setExpenses(updated)
    await saveExpenses(updated)
    setNewExpense(prev => ({ ...prev, amount: '', note: '' }))
    toast.success('Expense added')
  }

  async function removeExpense(id: string) {
    const updated = expenses.filter(e => e.id !== id)
    setExpenses(updated)
    await saveExpenses(updated)
  }

  const total = expenses.reduce((s, e) => s + e.amount, 0)
  const budget = selectedTrip?.amount || 0
  const remaining = budget ? budget - total : null
  const byCategory = EXPENSE_CATEGORIES.map(cat => ({
    cat,
    amount: expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter(c => c.amount > 0)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Trip selector */}
      <div>
        <label className="text-[10px] text-white/40 nexus-mono block mb-1.5">Select Trip</label>
        {tripsLoading ? (
          <div className="flex items-center gap-2 text-white/40 text-xs"><Loader2 size={13} className="animate-spin" /> Loading trips...</div>
        ) : trips.length === 0 ? (
          <p className="text-sm text-white/30">No trips found. Create a trip in the Trips tab first.</p>
        ) : (
          <select
            value={selectedTripId}
            onChange={e => setSelectedTripId(e.target.value)}
            className="w-full max-w-xs px-3 py-2 rounded-lg border border-white/10 bg-[#000810] text-white/80 text-sm outline-none focus:border-cyan-400/40 transition-colors"
          >
            <option value="">— Select a trip —</option>
            {trips.map(t => {
              const td = parseTripData(t)
              return <option key={t.id} value={t.id}>{td.destination}</option>
            })}
          </select>
        )}
      </div>

      {selectedTripId && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/8 bg-white/2 p-4 text-center">
              <div className="text-xl font-bold text-cyan-400 nexus-mono">${total.toFixed(2)}</div>
              <div className="text-[10px] text-white/35 nexus-mono mt-0.5">SPENT</div>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/2 p-4 text-center">
              <div className="text-xl font-bold text-white/60 nexus-mono">{budget ? `$${budget.toFixed(2)}` : '—'}</div>
              <div className="text-[10px] text-white/35 nexus-mono mt-0.5">BUDGET</div>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/2 p-4 text-center">
              <div className={`text-xl font-bold nexus-mono ${remaining !== null ? (remaining < 0 ? 'text-red-400' : 'text-green-400') : 'text-white/40'}`}>
                {remaining !== null ? `$${Math.abs(remaining).toFixed(2)}` : '—'}
              </div>
              <div className="text-[10px] text-white/35 nexus-mono mt-0.5">{remaining !== null ? (remaining < 0 ? 'OVER BUDGET' : 'REMAINING') : 'REMAINING'}</div>
            </div>
          </div>

          {/* Budget bar */}
          {budget > 0 && (
            <div className="rounded-xl border border-white/8 bg-white/2 p-4">
              <div className="flex justify-between text-[10px] text-white/40 nexus-mono mb-2">
                <span>Budget usage</span>
                <span>{Math.min(100, Math.round((total / budget) * 100))}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/8 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (total / budget) * 100)}%`,
                    background: total > budget ? '#f72585' : total > budget * 0.8 ? '#f4a261' : '#00e5ff',
                  }}
                />
              </div>
            </div>
          )}

          {/* Category breakdown */}
          {byCategory.length > 0 && (
            <div className="rounded-xl border border-white/8 bg-white/2 p-4">
              <h3 className="text-[10px] text-white/40 nexus-mono tracking-wider mb-3">BY CATEGORY</h3>
              <div className="space-y-2">
                {byCategory.sort((a, b) => b.amount - a.amount).map(({ cat, amount }) => (
                  <div key={cat} className="flex items-center justify-between">
                    <span className="text-sm text-white/60">{cat}</span>
                    <span className="text-sm text-white/80 nexus-mono">${amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add expense form */}
          <form onSubmit={addExpense} className="rounded-xl border border-cyan-400/15 bg-cyan-400/2 p-4 space-y-3">
            <h3 className="text-xs font-semibold text-cyan-400/70 nexus-mono tracking-wider">ADD EXPENSE</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-white/40 nexus-mono block mb-1">Category</label>
                <select
                  value={newExpense.category}
                  onChange={e => setNewExpense(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-2.5 py-2 rounded-lg border border-white/10 bg-[#000810] text-white/80 text-sm outline-none focus:border-cyan-400/40 transition-colors"
                >
                  {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-white/40 nexus-mono block mb-1">Amount (USD)</label>
                <input
                  type="number"
                  value={newExpense.amount}
                  onChange={e => setNewExpense(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  className="w-full px-2.5 py-2 rounded-lg border border-white/10 bg-white/3 text-white/80 text-sm placeholder-white/25 outline-none focus:border-cyan-400/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/40 nexus-mono block mb-1">Date</label>
                <input
                  type="date"
                  value={newExpense.date}
                  onChange={e => setNewExpense(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-2.5 py-2 rounded-lg border border-white/10 bg-white/3 text-white/80 text-sm outline-none focus:border-cyan-400/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/40 nexus-mono block mb-1">Note</label>
                <input
                  type="text"
                  value={newExpense.note}
                  onChange={e => setNewExpense(f => ({ ...f, note: e.target.value }))}
                  placeholder="What was it for?"
                  className="w-full px-2.5 py-2 rounded-lg border border-white/10 bg-white/3 text-white/80 text-sm placeholder-white/25 outline-none focus:border-cyan-400/40 transition-colors"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-400 text-black text-xs font-semibold nexus-mono hover:bg-cyan-300 transition-colors disabled:opacity-40"
            >
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
              Add Expense
            </button>
          </form>

          {/* Expense list */}
          {expenses.length > 0 && (
            <div className="rounded-xl border border-white/8 bg-white/2 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/8 text-[10px] text-white/40 nexus-mono tracking-wider">EXPENSES ({expenses.length})</div>
              <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
                {[...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(exp => (
                  <div key={exp.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-white/40 nexus-mono flex-shrink-0">{exp.category}</span>
                      <span className="text-sm text-white/60 truncate">{exp.note || exp.category}</span>
                      <span className="text-[10px] text-white/25 nexus-mono flex-shrink-0">{new Date(exp.date + 'T12:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <span className="text-sm font-medium text-white/80 nexus-mono">${exp.amount.toFixed(2)}</span>
                      <button onClick={() => removeExpense(exp.id)} className="p-1 rounded text-white/15 hover:text-red-400 hover:bg-red-400/10 transition-all">
                        <X size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
