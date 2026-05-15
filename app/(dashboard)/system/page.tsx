'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Header } from '@/components/layout/header'
import { Cpu, MemoryStick, Server, Activity } from 'lucide-react'

// Dynamic imports for recharts to avoid SSR issues
const LineChart = dynamic(() => import('recharts').then(m => ({ default: m.LineChart })), { ssr: false })
const Line = dynamic(() => import('recharts').then(m => ({ default: m.Line })), { ssr: false })
const XAxis = dynamic(() => import('recharts').then(m => ({ default: m.XAxis })), { ssr: false })
const YAxis = dynamic(() => import('recharts').then(m => ({ default: m.YAxis })), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then(m => ({ default: m.Tooltip })), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then(m => ({ default: m.ResponsiveContainer })), { ssr: false })

interface SystemStats {
  cpu: {
    avg: number
    cores: number[]
    count: number
    model: string
  }
  memory: {
    total: number
    used: number
    free: number
    percent: number
  }
  load: {
    '1m': string
    '5m': string
    '15m': string
  }
  uptime: number
  platform: string
  hostname: string
  arch: string
  timestamp: number
}

interface HistoryPoint {
  time: number
  cpu: number
  mem: number
}

function formatBytes(bytes: number): string {
  return (bytes / 1024 ** 3).toFixed(1) + ' GB'
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${days}d ${hours}h ${minutes}m`
}

function getCpuColor(pct: number): string {
  if (pct >= 80) return 'bg-red-400'
  if (pct >= 60) return 'bg-yellow-400'
  return 'bg-cyan-400'
}

export default function SystemMonitorPage() {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    let es: EventSource

    function connect() {
      es = new EventSource('/api/system')

      es.onopen = () => setConnected(true)

      es.onmessage = (e) => {
        const data: SystemStats = JSON.parse(e.data)
        setStats(data)
        setHistory(prev => [
          ...prev.slice(-29),
          { time: Date.now(), cpu: data.cpu.avg, mem: data.memory.percent },
        ])
      }

      es.onerror = () => {
        setConnected(false)
        es.close()
        // Reconnect after 3s
        setTimeout(connect, 3000)
      }
    }

    connect()
    return () => es?.close()
  }, [])

  const chartData = history.map((h, i) => ({
    idx: i,
    cpu: h.cpu,
    mem: h.mem,
  }))

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="SYSTEM MONITOR" subtitle="Real-time hardware telemetry" />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-[1400px] mx-auto space-y-4">

          {/* Connection status */}
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'} ${connected ? 'animate-pulse' : ''}`} />
            <span className="hud-label">{connected ? 'LIVE // STREAMING' : 'RECONNECTING...'}</span>
          </div>

          {/* Top row stats - 4 cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

            {/* CPU avg */}
            <div className="hud-stat-card rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="hud-label">CPU Usage</div>
                <div className="w-8 h-8 rounded-lg bg-cyan-400/10 flex items-center justify-center">
                  <Cpu size={14} className="text-cyan-400" />
                </div>
              </div>
              <div className="text-3xl font-bold hud-value mb-1">
                {stats ? `${stats.cpu.avg}%` : '--'}
              </div>
              <div className="text-white/40 text-xs">{stats ? `${stats.cpu.count} cores` : 'Loading...'}</div>
            </div>

            {/* Memory */}
            <div className="hud-stat-card rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="hud-label">Memory</div>
                <div className="w-8 h-8 rounded-lg bg-violet-400/10 flex items-center justify-center">
                  <MemoryStick size={14} className="text-violet-400" />
                </div>
              </div>
              <div className="text-3xl font-bold text-violet-400 mb-1" style={{ textShadow: '0 0 8px rgba(167,139,250,0.6)' }}>
                {stats ? `${stats.memory.percent}%` : '--'}
              </div>
              <div className="text-white/40 text-xs">
                {stats ? `${formatBytes(stats.memory.used)} / ${formatBytes(stats.memory.total)}` : 'Loading...'}
              </div>
            </div>

            {/* Uptime */}
            <div className="hud-stat-card rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="hud-label">Uptime</div>
                <div className="w-8 h-8 rounded-lg bg-green-400/10 flex items-center justify-center">
                  <Activity size={14} className="text-green-400" />
                </div>
              </div>
              <div className="text-xl font-bold text-green-400 mb-1" style={{ textShadow: '0 0 8px rgba(74,222,128,0.6)' }}>
                {stats ? formatUptime(stats.uptime) : '--'}
              </div>
              <div className="text-white/40 text-xs">System online</div>
            </div>

            {/* Load average */}
            <div className="hud-stat-card rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="hud-label">Load Average</div>
                <div className="w-8 h-8 rounded-lg bg-orange-400/10 flex items-center justify-center">
                  <Server size={14} className="text-orange-400" />
                </div>
              </div>
              <div className="text-2xl font-bold text-orange-400 mb-1" style={{ textShadow: '0 0 8px rgba(251,146,60,0.6)' }}>
                {stats ? stats.load['1m'] : '--'}
              </div>
              <div className="text-white/40 text-xs">
                {stats ? `5m: ${stats.load['5m']} · 15m: ${stats.load['15m']}` : 'Loading...'}
              </div>
            </div>
          </div>

          {/* CPU cores + Memory breakdown row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* CPU Cores grid */}
            <div className="hud-stat-card rounded-xl p-5">
              <div className="hud-label mb-4">CPU Cores</div>
              {stats ? (
                <div className="grid grid-cols-2 gap-3">
                  {stats.cpu.cores.map((pct, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-white/40 text-xs nexus-mono">Core {i}</span>
                        <span className="text-xs hud-value">{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${getCpuColor(pct)}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-24">
                  <div className="w-6 h-6 border border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Memory breakdown */}
            <div className="hud-stat-card rounded-xl p-5">
              <div className="hud-label mb-4">Memory Breakdown</div>
              {stats ? (
                <div className="space-y-4">
                  {/* Progress bar */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white/50 text-xs">Used</span>
                      <span className="hud-value text-xs">{formatBytes(stats.memory.used)}</span>
                    </div>
                    <div className="h-3 rounded-full bg-white/5 overflow-hidden relative">
                      <div
                        className="h-full rounded-full bg-violet-400 transition-all duration-700"
                        style={{ width: `${stats.memory.percent}%`, boxShadow: '0 0 8px rgba(167,139,250,0.5)' }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <div className="text-center">
                      <div className="hud-label mb-1">Total</div>
                      <div className="text-white/80 text-sm font-semibold nexus-mono">{formatBytes(stats.memory.total)}</div>
                    </div>
                    <div className="text-center">
                      <div className="hud-label mb-1" style={{ color: 'rgba(167,139,250,0.7)' }}>Used</div>
                      <div className="text-violet-400 text-sm font-semibold nexus-mono">{formatBytes(stats.memory.used)}</div>
                    </div>
                    <div className="text-center">
                      <div className="hud-label mb-1" style={{ color: 'rgba(74,222,128,0.7)' }}>Free</div>
                      <div className="text-green-400 text-sm font-semibold nexus-mono">{formatBytes(stats.memory.free)}</div>
                    </div>
                  </div>

                  <div className="pt-1">
                    <div className="flex items-center gap-2 text-xs text-white/30">
                      <div className="w-3 h-1 rounded bg-violet-400" />
                      <span>{stats.memory.percent}% utilized</span>
                      <div className="w-3 h-1 rounded bg-white/10 ml-2" />
                      <span>{100 - stats.memory.percent}% available</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-24">
                  <div className="w-6 h-6 border border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>

          {/* CPU History chart */}
          <div className="hud-stat-card rounded-xl p-5">
            <div className="hud-label mb-4">CPU &amp; Memory History (last 30 samples · 2s interval)</div>
            {history.length > 1 ? (
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                    <XAxis dataKey="idx" hide />
                    <YAxis domain={[0, 100]} tick={{ fill: 'rgba(0,229,255,0.3)', fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(0,4,12,0.95)',
                        border: '1px solid rgba(0,229,255,0.2)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: 'rgba(255,255,255,0.4)' }}
                      formatter={(value: unknown, name: unknown) => [`${value}%`, name === 'cpu' ? 'CPU' : 'Memory']}
                    />
                    <Line
                      type="monotone"
                      dataKey="cpu"
                      stroke="#00e5ff"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="mem"
                      stroke="#a78bfa"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[180px] gap-3">
                <div className="w-5 h-5 border border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                <span className="text-white/30 text-sm">Collecting data...</span>
              </div>
            )}
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-2 text-xs text-white/40">
                <div className="w-4 h-0.5 bg-cyan-400 rounded" style={{ boxShadow: '0 0 4px #00e5ff' }} />
                <span>CPU</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/40">
                <div className="w-4 h-0.5 bg-violet-400 rounded" style={{ boxShadow: '0 0 4px rgba(167,139,250,0.8)' }} />
                <span>Memory</span>
              </div>
            </div>
          </div>

          {/* System info */}
          <div className="hud-stat-card rounded-xl p-5">
            <div className="hud-label mb-4">System Information</div>
            {stats ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="hud-label mb-1">Platform</div>
                  <div className="text-white/80 text-sm nexus-mono">{stats.platform}</div>
                </div>
                <div>
                  <div className="hud-label mb-1">Hostname</div>
                  <div className="text-white/80 text-sm nexus-mono truncate">{stats.hostname}</div>
                </div>
                <div>
                  <div className="hud-label mb-1">Architecture</div>
                  <div className="text-white/80 text-sm nexus-mono">{stats.arch}</div>
                </div>
                <div>
                  <div className="hud-label mb-1">CPU Model</div>
                  <div className="text-white/80 text-sm nexus-mono truncate" title={stats.cpu.model}>{stats.cpu.model}</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-12">
                <div className="w-5 h-5 border border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
