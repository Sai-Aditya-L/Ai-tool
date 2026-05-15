'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { Home, Lightbulb, Power, RefreshCw, Settings, ToggleLeft, ToggleRight, Thermometer, Wifi, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface HAEntity {
  entity_id: string
  state: string
  attributes: {
    friendly_name?: string
    brightness?: number
    color_temp?: number
    temperature?: number
    current_temperature?: number
    unit_of_measurement?: string
  }
}

interface HAStatus {
  connected: boolean
  entities?: HAEntity[]
  error?: string
}

export default function HomeControlPage() {
  const [status, setStatus] = useState<HAStatus>({ connected: false })
  const [loading, setLoading] = useState(true)
  const [showSetup, setShowSetup] = useState(false)
  const [haUrl, setHaUrl] = useState('')
  const [haToken, setHaToken] = useState('')
  const [configuring, setConfiguring] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  const loadEntities = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/homeassistant')
      const data = await res.json()
      setStatus(data)
      if (!data.connected) setShowSetup(true)
    } catch {
      setStatus({ connected: false, error: 'Failed to connect' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadEntities() }, [loadEntities])

  async function configure() {
    if (!haUrl || !haToken) { toast.error('URL and token required'); return }
    setConfiguring(true)
    try {
      const res = await fetch('/api/integrations/homeassistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'configure', url: haUrl, token: haToken }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Configuration failed')
      toast.success('Home Assistant connected!')
      setShowSetup(false)
      loadEntities()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to connect')
    } finally {
      setConfiguring(false)
    }
  }

  async function toggleEntity(entity: HAEntity) {
    setToggling(entity.entity_id)
    const domain = entity.entity_id.split('.')[0]
    const isOn = entity.state === 'on'
    const service = domain === 'light'
      ? (isOn ? 'turn_off' : 'turn_on')
      : 'toggle'
    try {
      await fetch('/api/integrations/homeassistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'call', domain, service, entityId: entity.entity_id }),
      })
      await loadEntities()
    } catch {
      toast.error('Failed to control device')
    } finally {
      setToggling(null)
    }
  }

  async function allLightsOff() {
    const lights = (status.entities || []).filter(e => e.entity_id.startsWith('light.') && e.state === 'on')
    for (const light of lights) {
      await fetch('/api/integrations/homeassistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'call', domain: 'light', service: 'turn_off', entityId: light.entity_id }),
      })
    }
    toast.success('All lights off')
    loadEntities()
  }

  const lights = (status.entities || []).filter(e => e.entity_id.startsWith('light.'))
  const switches = (status.entities || []).filter(e => e.entity_id.startsWith('switch.'))
  const sensors = (status.entities || []).filter(e => e.entity_id.startsWith('sensor.'))
  const climates = (status.entities || []).filter(e => e.entity_id.startsWith('climate.'))

  const EntityCard = ({ entity }: { entity: HAEntity }) => {
    const isOn = entity.state === 'on'
    const isLight = entity.entity_id.startsWith('light.')
    const name = entity.attributes.friendly_name || entity.entity_id.replace(/_/g, ' ')
    const isToggling = toggling === entity.entity_id

    return (
      <div className={cn(
        'hud-stat-card rounded-xl p-4 flex items-center justify-between gap-3 transition-all',
        isOn ? 'border-cyan-400/20' : ''
      )}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
            isOn ? 'bg-cyan-400/20 text-cyan-400' : 'bg-white/5 text-white/30'
          )}>
            {isLight ? <Lightbulb size={16} /> : <Power size={16} />}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-white/80 truncate">{name}</p>
            <p className={cn('text-xs', isOn ? 'text-cyan-400' : 'text-white/30')}>
              {entity.state}
              {isLight && entity.attributes.brightness
                ? ` · ${Math.round((entity.attributes.brightness / 255) * 100)}%`
                : ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => toggleEntity(entity)}
          disabled={isToggling}
          className={cn(
            'flex-shrink-0 transition-all',
            isToggling ? 'opacity-50' : 'hover:scale-110'
          )}
        >
          {isOn
            ? <ToggleRight size={28} className="text-cyan-400" />
            : <ToggleLeft size={28} className="text-white/25" />}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="HOME CONTROL" subtitle="Smart home via Home Assistant" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Status bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {status.connected
              ? <Wifi size={14} className="text-cyan-400" />
              : <WifiOff size={14} className="text-white/30" />}
            <span className={cn('text-sm', status.connected ? 'text-cyan-400' : 'text-white/40')}>
              {status.connected
                ? `Home Assistant connected · ${status.entities?.length || 0} entities`
                : 'Not connected'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {status.connected && (
              <>
                {lights.some(l => l.state === 'on') && (
                  <button
                    onClick={allLightsOff}
                    className="text-xs px-3 py-1.5 rounded-lg border border-amber-400/20 text-amber-400/70 hover:bg-amber-400/10 transition-all"
                  >
                    All Lights Off
                  </button>
                )}
                <button
                  onClick={loadEntities}
                  className="p-1.5 rounded-lg text-white/30 hover:text-cyan-400 transition-colors"
                >
                  <RefreshCw size={14} />
                </button>
              </>
            )}
            <button
              onClick={() => setShowSetup(!showSetup)}
              className="p-1.5 rounded-lg text-white/30 hover:text-cyan-400 transition-colors"
            >
              <Settings size={14} />
            </button>
          </div>
        </div>

        {/* Setup panel */}
        {showSetup && (
          <div className="hud-stat-card rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Home size={14} className="text-cyan-400" />
              <h3 className="text-sm font-semibold hud-text-cyan">Home Assistant Setup</h3>
            </div>
            <p className="text-xs text-white/40">
              Enter your Home Assistant local URL and a Long-Lived Access Token (Profile → Security → Long-Lived Access Tokens).
            </p>
            <div className="space-y-3">
              <input
                type="url"
                placeholder="http://homeassistant.local:8123"
                value={haUrl}
                onChange={e => setHaUrl(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 placeholder-white/25 outline-none focus:border-cyan-400/40"
              />
              <input
                type="password"
                placeholder="Long-lived access token"
                value={haToken}
                onChange={e => setHaToken(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 placeholder-white/25 outline-none focus:border-cyan-400/40"
              />
              <button
                onClick={configure}
                disabled={configuring}
                className="w-full py-2 rounded-lg bg-cyan-400/15 text-cyan-400 text-sm font-medium hover:bg-cyan-400/25 transition-all disabled:opacity-50"
              >
                {configuring ? 'Connecting…' : 'Connect to Home Assistant'}
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-40">
            <div className="text-white/30 text-sm">Loading devices…</div>
          </div>
        )}

        {!loading && status.connected && (
          <>
            {lights.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb size={13} className="text-cyan-400/60" />
                  <h2 className="hud-label text-xs">LIGHTS ({lights.length})</h2>
                  <span className="ml-auto text-[10px] text-white/30">
                    {lights.filter(l => l.state === 'on').length} on
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {lights.map(e => <EntityCard key={e.entity_id} entity={e} />)}
                </div>
              </div>
            )}

            {switches.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Power size={13} className="text-amber-400/60" />
                  <h2 className="hud-label text-xs">SWITCHES ({switches.length})</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {switches.map(e => <EntityCard key={e.entity_id} entity={e} />)}
                </div>
              </div>
            )}

            {climates.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Thermometer size={13} className="text-orange-400/60" />
                  <h2 className="hud-label text-xs">CLIMATE ({climates.length})</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {climates.map(e => (
                    <div key={e.entity_id} className="hud-stat-card rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Thermometer size={14} className="text-orange-400/60" />
                        <span className="text-sm text-white/80">
                          {e.attributes.friendly_name || e.entity_id}
                        </span>
                      </div>
                      <p className="text-2xl font-bold hud-text-cyan">
                        {e.attributes.current_temperature ?? e.state}°
                      </p>
                      <p className="text-xs text-white/30 mt-1">Mode: {e.state}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sensors.length > 0 && (
              <div>
                <h2 className="hud-label text-xs mb-3">SENSORS ({sensors.length})</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {sensors.slice(0, 12).map(e => (
                    <div key={e.entity_id} className="hud-stat-card rounded-xl p-3">
                      <p className="text-[10px] text-white/30 truncate mb-1">
                        {e.attributes.friendly_name || e.entity_id}
                      </p>
                      <p className="text-lg font-bold hud-value">
                        {e.state}
                        <span className="text-xs text-white/30 ml-1 font-normal">
                          {e.attributes.unit_of_measurement}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {lights.length === 0 && switches.length === 0 && (
              <div className="text-center text-white/30 text-sm py-12">
                No controllable devices found. Make sure Home Assistant is running and accessible.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
