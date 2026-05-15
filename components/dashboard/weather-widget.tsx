'use client'

import { useState, useEffect } from 'react'
import { Cloud, Wind, Droplets, Thermometer, RefreshCw } from 'lucide-react'

interface WeatherData {
  city: string
  country: string
  current: {
    temperature: number
    feelsLike: number | null
    condition: string
    icon: string
    windspeed: number
    humidity: number | null
    isDay: boolean
  }
  forecast: Array<{
    date: string
    max: number
    min: number
    icon: string
    condition: string
    precipitation: number
  }>
}

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [city, setCity] = useState('London')
  const [editingCity, setEditingCity] = useState(false)
  const [cityInput, setCityInput] = useState('')

  const fetchWeather = async (cityName: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/weather?city=${encodeURIComponent(cityName)}`)
      const data = await res.json()
      if (data.error) { setError(data.error); setLoading(false); return }
      setWeather(data)
      setCity(data.city)
      if (typeof window !== 'undefined') {
        localStorage.setItem('nexus-weather-city', data.city)
      }
    } catch {
      setError('Weather unavailable')
    }
    setLoading(false)
  }

  useEffect(() => {
    const savedCity = typeof window !== 'undefined' ? localStorage.getItem('nexus-weather-city') : null
    const initialCity = savedCity || city
    setCityInput(initialCity)
    fetchWeather(initialCity)
    const interval = setInterval(() => fetchWeather(initialCity), 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const handleCitySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (cityInput.trim()) {
      fetchWeather(cityInput.trim())
      setEditingCity(false)
    }
  }

  const getDayName = (dateStr: string, i: number) => {
    if (i === 0) return 'Today'
    if (i === 1) return 'Tomorrow'
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' })
  }

  if (loading) {
    return (
      <div className="hud-panel hud-panel-inner rounded-xl p-5 flex items-center justify-center h-48">
        <div className="flex flex-col items-center gap-2">
          <Cloud size={24} className="text-cyan-400/40 animate-pulse" />
          <span className="hud-label text-xs">FETCHING WEATHER...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="hud-panel hud-panel-inner rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="hud-label text-xs">WEATHER</span>
          <button onClick={() => fetchWeather(city)} className="text-cyan-400/50 hover:text-cyan-400">
            <RefreshCw size={12} />
          </button>
        </div>
        <p className="text-white/40 text-xs">{error}</p>
        <form onSubmit={handleCitySubmit} className="mt-3 flex gap-2">
          <input
            value={cityInput}
            onChange={e => setCityInput(e.target.value)}
            placeholder="Enter city..."
            className="nexus-input text-xs py-1.5 flex-1"
          />
          <button type="submit" className="nexus-btn-primary text-xs px-3 py-1.5">Go</button>
        </form>
      </div>
    )
  }

  if (!weather) return null

  return (
    <div className="hud-panel hud-panel-inner rounded-xl p-5 relative overflow-hidden">
      {/* Scan line */}
      <div className="absolute left-0 right-0 h-px pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(0,229,255,0.4), transparent)', animation: 'hud-scan-v 8s linear infinite' }} />

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="hud-label text-xs mb-0.5">WEATHER SYS</div>
          {editingCity ? (
            <form onSubmit={handleCitySubmit} className="flex gap-1.5 mt-1">
              <input
                value={cityInput}
                onChange={e => setCityInput(e.target.value)}
                autoFocus
                className="bg-transparent border-b border-cyan-400/40 text-white text-sm outline-none w-28"
              />
              <button type="submit" className="text-cyan-400 text-xs">OK</button>
              <button type="button" onClick={() => setEditingCity(false)} className="text-white/30 text-xs">✕</button>
            </form>
          ) : (
            <button
              onClick={() => { setEditingCity(true); setCityInput(city) }}
              className="text-white font-semibold hover:text-cyan-400 transition-colors text-sm"
            >
              {weather.city}, {weather.country}
            </button>
          )}
        </div>
        <button onClick={() => fetchWeather(city)} className="text-white/20 hover:text-cyan-400 transition-colors">
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Current weather */}
      <div className="flex items-center gap-4 mb-4">
        <div className="text-5xl">{weather.current.icon}</div>
        <div>
          <div className="text-3xl font-bold hud-text-cyan">{weather.current.temperature}°C</div>
          <div className="text-white/50 text-xs">{weather.current.condition}</div>
          {weather.current.feelsLike !== null && (
            <div className="text-white/30 text-xs">Feels like {weather.current.feelsLike}°C</div>
          )}
        </div>
        <div className="ml-auto flex flex-col gap-1.5 text-xs">
          <div className="flex items-center gap-1.5 text-white/50">
            <Wind size={11} className="text-cyan-400/60" />
            <span>{weather.current.windspeed} km/h</span>
          </div>
          {weather.current.humidity !== null && (
            <div className="flex items-center gap-1.5 text-white/50">
              <Droplets size={11} className="text-cyan-400/60" />
              <span>{weather.current.humidity}%</span>
            </div>
          )}
        </div>
      </div>

      {/* 5-day forecast */}
      <div className="grid grid-cols-5 gap-1">
        {weather.forecast.map((day, i) => (
          <div key={day.date}
            className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-center ${i === 0 ? 'bg-cyan-400/8 border border-cyan-400/15' : 'bg-white/3'}`}>
            <span className="hud-label" style={{ fontSize: 8 }}>{getDayName(day.date, i)}</span>
            <span className="text-lg">{day.icon}</span>
            <span className="text-white/80 text-xs font-medium">{day.max}°</span>
            <span className="text-white/30 text-xs">{day.min}°</span>
            {day.precipitation > 0 && (
              <span style={{ fontSize: 8 }} className="text-blue-400/70">{day.precipitation}mm</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
