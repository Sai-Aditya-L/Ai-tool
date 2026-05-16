'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Header } from '@/components/layout/header'
import {
  Zap, DollarSign, ArrowDown, ArrowUp, AlertTriangle,
  BarChart2, Bot, MessageSquare, Languages, Cpu, FlaskConical
} from 'lucide-react'

// Dynamic imports for recharts to avoid SSR issues
const BarChart = dynamic(() => import('recharts').then(m => ({ default: m.BarChart })), { ssr: false })
const Bar = dynamic(() => import('recharts').then(m => ({ default: m.Bar })), { ssr: false })
const XAxis = dynamic(() => import('recharts').then(m => ({ default: m.XAxis })), { ssr: false })
const YAxis = dynamic(() => import('recharts').then(m => ({ default: m.YAxis })), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then(m => ({ default: m.Tooltip })), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then(m => ({ default: m.ResponsiveContainer })), { ssr: false })

interface UsageRecord {
  id: string
  model: string
  inputTokens: number
  outputTokens: number
  estimatedCost: number
  taskType: string | null
  feature: string | null
  createdAt: string
}

interface UsageStats {
  totalRequests: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCost: number
  byModel: { model: string; requests: number; inputTokens: number; outputTokens: number; cost: number }[]
  byFeature: { feature: string; requests: number; cost: number }[]
  byDay: { date: string; requests: number; cost: number }[]
  recent: UsageRecord[]
}

interface BudgetInfo {
  monthlyBudget: number
  currentMonthCost: number
  percentUsed: number
  warning: boolean
}

const TASK_ROUTER_INFO = [
  { taskType: 'simple', model: 'Claude Haiku', speed: 'Fast', costTier: 'Low' },
  { taskType: 'chat', model: 'Claude Sonnet', speed: 'Standard', costTier: 'Medium' },
  { taskType: 'coding', model: 'Claude Sonnet', speed: 'Standard', costTier: 'Medium' },
  { taskType: 'vision', model: 'Claude Sonnet', speed: 'Standard', costTier: 'Medium' },
  { taskType: 'planning', model: 'Claude Sonnet', speed: 'Standard', costTier: 'Medium' },
  { taskType: 'research', model: 'Claude Sonnet', speed: 'Standard', costTier: 'Medium' },
  { taskType: 'translation', model: 'Claude Haiku', speed: 'Fast', costTier: 'Low' },
  { taskType: 'agent', model: 'Claude Sonnet', speed: 'Standard', costTier: 'Medium' },
  { taskType: 'orchestration', model: 'Claude Sonnet', speed: 'Standard', costTier: 'Medium' },
]

function getModelColor(model: string) {
  if (model.includes('haiku')) return 'text-green-400'
  if (model.includes('sonnet')) return 'text-cyan-400'
  return 'text-white/60'
}

function getModelBadgeStyle(model: string) {
  if (model.includes('haiku')) return { color: '#4ade80', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)' }
  if (model.includes('sonnet')) return { color: '#22d3ee', background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)' }
  return { color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }
}

function getFeatureIcon(feature: string) {
  switch (feature) {
    case 'chat': return <MessageSquare size={14} />
    case 'agent': return <Bot size={14} />
    case 'translate': return <Languages size={14} />
    case 'simulate': return <FlaskConical size={14} />
    default: return <Zap size={14} />
  }
}

function formatCost(cost: number) {
  if (cost < 0.001) return `$${(cost * 1000).toFixed(4)}m`
  return `$${cost.toFixed(4)}`
}

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function getShortDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function UsageDashboardPage() {
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [budget, setBudget] = useState<BudgetInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [budgetInput, setBudgetInput] = useState('')
  const [savingBudget, setSavingBudget] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [usageRes, budgetRes] = await Promise.all([
        fetch('/api/usage'),
        fetch('/api/usage/budget'),
      ])
      const [usageData, budgetData] = await Promise.all([
        usageRes.json(),
        budgetRes.json(),
      ])
      setStats(usageData)
      setBudget(budgetData)
      setBudgetInput(budgetData.monthlyBudget?.toString() ?? '10')
    } catch (err) {
      console.error('Failed to fetch usage data', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSetBudget = async () => {
    const val = parseFloat(budgetInput)
    if (isNaN(val) || val < 0) return
    setSavingBudget(true)
    try {
      await fetch('/api/usage/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthlyBudget: val }),
      })
      await fetchData()
    } finally {
      setSavingBudget(false)
    }
  }

  const chartData = stats?.byDay.map(d => ({
    date: getShortDate(d.date),
    cost: parseFloat(d.cost.toFixed(6)),
    requests: d.requests,
  })) ?? []

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="AI USAGE" subtitle="Token consumption, cost tracking & model performance" />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-[1400px] mx-auto space-y-5">

          {/* Budget alert banner */}
          {budget?.warning && (
            <div
              className="flex items-center gap-3 rounded-xl p-4"
              style={{
                background: 'rgba(251,146,60,0.1)',
                border: '1px solid rgba(251,146,60,0.3)',
              }}
            >
              <AlertTriangle size={18} className="text-orange-400 flex-shrink-0" />
              <div>
                <span className="text-orange-400 font-semibold text-sm">
                  BUDGET WARNING — Usage at {budget.percentUsed.toFixed(1)}% of monthly budget
                </span>
                <p className="text-white/50 text-xs mt-0.5">
                  ${budget.currentMonthCost.toFixed(4)} used of ${budget.monthlyBudget.toFixed(2)} budget this month
                </p>
              </div>
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Requests */}
            <div className="hud-stat-card rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="hud-label">Total Requests</div>
                <div className="w-8 h-8 rounded-lg bg-cyan-400/10 flex items-center justify-center">
                  <Zap size={14} className="text-cyan-400" />
                </div>
              </div>
              <div className="text-3xl font-bold hud-value mb-1">
                {loading ? '--' : formatNumber(stats?.totalRequests ?? 0)}
              </div>
              <div className="text-white/40 text-xs">All time</div>
            </div>

            {/* Input Tokens */}
            <div className="hud-stat-card rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="hud-label">Input Tokens</div>
                <div className="w-8 h-8 rounded-lg bg-violet-400/10 flex items-center justify-center">
                  <ArrowDown size={14} className="text-violet-400" />
                </div>
              </div>
              <div className="text-3xl font-bold text-violet-400 mb-1" style={{ textShadow: '0 0 8px rgba(167,139,250,0.6)' }}>
                {loading ? '--' : formatNumber(stats?.totalInputTokens ?? 0)}
              </div>
              <div className="text-white/40 text-xs">Prompt tokens consumed</div>
            </div>

            {/* Output Tokens */}
            <div className="hud-stat-card rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="hud-label">Output Tokens</div>
                <div className="w-8 h-8 rounded-lg bg-blue-400/10 flex items-center justify-center">
                  <ArrowUp size={14} className="text-blue-400" />
                </div>
              </div>
              <div className="text-3xl font-bold text-blue-400 mb-1" style={{ textShadow: '0 0 8px rgba(96,165,250,0.6)' }}>
                {loading ? '--' : formatNumber(stats?.totalOutputTokens ?? 0)}
              </div>
              <div className="text-white/40 text-xs">Response tokens generated</div>
            </div>

            {/* Estimated Cost */}
            <div className="hud-stat-card rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="hud-label">Estimated Cost</div>
                <div className="w-8 h-8 rounded-lg bg-amber-400/10 flex items-center justify-center">
                  <DollarSign size={14} className="text-amber-400" />
                </div>
              </div>
              <div className="text-3xl font-bold text-amber-400 mb-1" style={{ textShadow: '0 0 8px rgba(251,191,36,0.6)' }}>
                {loading ? '--' : `$${(stats?.totalCost ?? 0).toFixed(4)}`}
              </div>
              <div className="text-white/40 text-xs">USD (all time)</div>
            </div>
          </div>

          {/* Usage history chart + Budget control */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Chart */}
            <div className="lg:col-span-2 hud-stat-card rounded-xl p-5">
              <div className="hud-label mb-4">DAILY COST — LAST 30 DAYS</div>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <XAxis
                      dataKey="date"
                      tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `$${v}`}
                      width={50}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(0,4,12,0.95)',
                        border: '1px solid rgba(251,191,36,0.3)',
                        borderRadius: 8,
                        color: 'rgba(255,255,255,0.8)',
                        fontSize: 12,
                      }}
                      formatter={(value) => [`$${Number(value).toFixed(6)}`, 'Cost']}
                    />
                    <Bar dataKey="cost" fill="#fbbf24" radius={[3, 3, 0, 0]} opacity={0.85} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-white/20 text-sm">
                  No usage data yet
                </div>
              )}
            </div>

            {/* Budget control */}
            <div className="hud-stat-card rounded-xl p-5 flex flex-col gap-4">
              <div className="hud-label">MONTHLY BUDGET</div>

              {budget && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white/40 text-xs">This month</span>
                      <span className="text-amber-400 text-xs font-bold">
                        ${budget.currentMonthCost.toFixed(4)} / ${budget.monthlyBudget.toFixed(2)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          budget.percentUsed >= 90 ? 'bg-red-400' :
                          budget.percentUsed >= 80 ? 'bg-orange-400' : 'bg-amber-400'
                        }`}
                        style={{ width: `${Math.min(budget.percentUsed, 100)}%` }}
                      />
                    </div>
                    <div className="text-white/30 text-xs mt-1">{budget.percentUsed.toFixed(1)}% used</div>
                  </div>

                  <div>
                    <div className="hud-label mb-2 text-xs">SET BUDGET (USD/month)</div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={budgetInput}
                        onChange={(e) => setBudgetInput(e.target.value)}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-400/50"
                        placeholder="10"
                      />
                      <button
                        onClick={handleSetBudget}
                        disabled={savingBudget}
                        className="px-3 py-2 rounded-lg text-xs font-bold text-amber-400 border border-amber-400/30 hover:bg-amber-400/10 transition-colors disabled:opacity-50"
                      >
                        {savingBudget ? '...' : 'SET'}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {!budget && <div className="text-white/20 text-sm">Loading...</div>}
            </div>
          </div>

          {/* By Model + By Feature */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* By Model */}
            <div className="hud-stat-card rounded-xl p-5">
              <div className="hud-label mb-4">BY MODEL</div>
              {stats?.byModel.length ? (
                <div className="space-y-3">
                  {stats.byModel.map((m) => (
                    <div key={m.model} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span
                          className="text-xs font-mono px-2 py-0.5 rounded"
                          style={getModelBadgeStyle(m.model)}
                        >
                          {m.model.includes('haiku') ? 'Haiku (Fast)' : 'Sonnet (Standard)'}
                        </span>
                        <span className="text-amber-400 text-xs font-bold">{formatCost(m.cost)}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-white/40">
                        <span>{m.requests} reqs</span>
                        <span>{formatNumber(m.inputTokens)} in</span>
                        <span>{formatNumber(m.outputTokens)} out</span>
                      </div>
                      <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getModelColor(m.model).replace('text-', 'bg-')}`}
                          style={{ width: `${Math.min((m.requests / (stats.totalRequests || 1)) * 100, 100)}%`, opacity: 0.7 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-white/20 text-sm">No data yet</div>
              )}
            </div>

            {/* By Feature */}
            <div className="hud-stat-card rounded-xl p-5">
              <div className="hud-label mb-4">BY FEATURE</div>
              {stats?.byFeature.length ? (
                <div className="space-y-2">
                  {stats.byFeature
                    .sort((a, b) => b.cost - a.cost)
                    .map((f) => (
                      <div key={f.feature} className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center text-white/40 flex-shrink-0">
                          {getFeatureIcon(f.feature)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-white/70 text-xs capitalize">{f.feature}</span>
                            <span className="text-amber-400 text-xs">{formatCost(f.cost)}</span>
                          </div>
                          <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-violet-400/60"
                              style={{
                                width: `${Math.min((f.cost / ((stats.totalCost || 0.0001))) * 100, 100)}%`,
                              }}
                            />
                          </div>
                          <div className="text-white/30 text-xs mt-0.5">{f.requests} requests</div>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-white/20 text-sm">No data yet</div>
              )}
            </div>
          </div>

          {/* Model Router Info Panel */}
          <div className="hud-stat-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Cpu size={16} className="text-cyan-400" />
              <div className="hud-label">MODEL ROUTER — TASK ROUTING MAP</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left py-2 pr-4 text-white/30 font-normal uppercase tracking-wider">Task Type</th>
                    <th className="text-left py-2 pr-4 text-white/30 font-normal uppercase tracking-wider">Model</th>
                    <th className="text-left py-2 pr-4 text-white/30 font-normal uppercase tracking-wider">Speed</th>
                    <th className="text-left py-2 text-white/30 font-normal uppercase tracking-wider">Cost Tier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {TASK_ROUTER_INFO.map((row) => (
                    <tr key={row.taskType}>
                      <td className="py-2 pr-4">
                        <span className="font-mono text-white/70 capitalize">{row.taskType}</span>
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className="px-2 py-0.5 rounded text-xs"
                          style={getModelBadgeStyle(row.model.toLowerCase())}
                        >
                          {row.model}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        <span className={`${row.speed === 'Fast' ? 'text-green-400' : 'text-cyan-400'}`}>
                          {row.speed}
                        </span>
                      </td>
                      <td className="py-2">
                        <span className={`${row.costTier === 'Low' ? 'text-green-400' : 'text-amber-400'}`}>
                          {row.costTier}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Usage Table */}
          <div className="hud-stat-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 size={16} className="text-amber-400" />
              <div className="hud-label">RECENT API CALLS</div>
            </div>
            {stats?.recent.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left py-2 pr-3 text-white/30 font-normal uppercase tracking-wider">Time</th>
                      <th className="text-left py-2 pr-3 text-white/30 font-normal uppercase tracking-wider">Feature</th>
                      <th className="text-left py-2 pr-3 text-white/30 font-normal uppercase tracking-wider">Model</th>
                      <th className="text-right py-2 pr-3 text-white/30 font-normal uppercase tracking-wider">In</th>
                      <th className="text-right py-2 pr-3 text-white/30 font-normal uppercase tracking-wider">Out</th>
                      <th className="text-right py-2 text-white/30 font-normal uppercase tracking-wider">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {stats.recent.map((r) => (
                      <tr key={r.id} className="hover:bg-white/2 transition-colors">
                        <td className="py-2 pr-3 text-white/40 font-mono whitespace-nowrap">
                          {new Date(r.createdAt).toLocaleString(undefined, {
                            month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </td>
                        <td className="py-2 pr-3">
                          <span className="text-violet-400 capitalize">{r.feature ?? r.taskType ?? '—'}</span>
                        </td>
                        <td className="py-2 pr-3">
                          <span
                            className="px-1.5 py-0.5 rounded text-xs"
                            style={getModelBadgeStyle(r.model)}
                          >
                            {r.model.includes('haiku') ? 'Haiku' : r.model.includes('sonnet') ? 'Sonnet' : r.model}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-right text-white/50 font-mono">{formatNumber(r.inputTokens)}</td>
                        <td className="py-2 pr-3 text-right text-white/50 font-mono">{formatNumber(r.outputTokens)}</td>
                        <td className="py-2 text-right text-amber-400 font-mono">{formatCost(r.estimatedCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-white/20 text-sm text-center py-8">
                No usage recorded yet. API calls will appear here automatically.
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
