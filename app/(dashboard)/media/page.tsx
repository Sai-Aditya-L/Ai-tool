'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import {
  Music,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'

interface TrackInfo {
  id: string
  name: string
  artists: string
  album: string
  albumArt: string | null
  duration: number
  progress: number
}

interface NowPlayingData {
  connected?: boolean
  playing?: boolean
  track?: TrackInfo
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

export default function MediaPage() {
  const searchParams = useSearchParams()
  const [data, setData] = useState<NowPlayingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [controlling, setControlling] = useState(false)
  const [volume, setVolume] = useState(50)

  const fetchNowPlaying = useCallback(async () => {
    try {
      const res = await fetch('/api/spotify/now-playing')
      const json = await res.json()
      setData(json)
    } catch {
      // silently fail
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // Handle success/error from OAuth callback
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    if (success === 'spotify_connected') toast.success('Spotify connected!')
    else if (error === 'spotify_denied') toast.error('Spotify connection denied')
    else if (error) toast.error('Failed to connect Spotify')
  }, [searchParams])

  useEffect(() => {
    fetchNowPlaying()
    const interval = setInterval(() => {
      if (data?.playing) fetchNowPlaying()
    }, 5_000)
    return () => clearInterval(interval)
  }, [fetchNowPlaying, data?.playing])

  const control = async (action: string, extraData?: Record<string, unknown>) => {
    if (controlling) return
    setControlling(true)
    try {
      const res = await fetch('/api/spotify/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extraData }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Spotify control failed')
      }
      setTimeout(fetchNowPlaying, 500)
    } catch {
      toast.error('Connection error')
    }
    setControlling(false)
  }

  const handleVolumeChange = async (val: number) => {
    setVolume(val)
    await control('volume', { volume: val })
  }

  const progressPct =
    data?.track && data.track.duration > 0
      ? Math.min(100, (data.track.progress / data.track.duration) * 100)
      : 0

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="MEDIA CENTER" subtitle="Spotify playback control" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <Music size={32} className="text-green-400/40 animate-pulse" />
              <span className="hud-label text-xs">LOADING SPOTIFY...</span>
            </div>
          </div>
        ) : !data?.connected ? (
          /* Not connected — setup panel */
          <div className="max-w-lg mx-auto">
            <div className="hud-stat-card rounded-xl p-8 flex flex-col items-center gap-6 text-center">
              <div className="w-20 h-20 rounded-full bg-green-400/10 flex items-center justify-center">
                <Music size={40} className="text-green-400/60" />
              </div>
              <div>
                <h2 className="text-white text-xl font-semibold mb-2">Connect Spotify</h2>
                <p className="text-white/50 text-sm leading-relaxed">
                  Link your Spotify account to control playback, view now-playing info, and manage volume right from NEXUS.
                </p>
              </div>

              <Link
                href="/api/spotify/auth"
                className="nexus-btn-primary flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-medium"
              >
                <Music size={16} />
                Connect Spotify
              </Link>

              <div className="w-full border-t border-white/10 pt-4">
                <p className="text-white/30 text-xs mb-3">Setup requirements</p>
                <div className="space-y-2 text-left">
                  {[
                    'SPOTIFY_CLIENT_ID — from Spotify Developer Dashboard',
                    'SPOTIFY_CLIENT_SECRET — from Spotify Developer Dashboard',
                    `Redirect URI: ${typeof window !== 'undefined' ? window.location.origin : ''}/api/spotify/callback`,
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-white/40 text-xs">
                      <span className="text-green-400/60 mt-0.5">›</span>
                      <code className="font-mono">{item}</code>
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <a
                    href="https://developer.spotify.com/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-green-400/70 hover:text-green-400 text-xs transition-colors"
                  >
                    Open Spotify Developer Dashboard
                    <ExternalLink size={10} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Connected — now-playing + controls */
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Now Playing Card */}
            <div className="hud-stat-card rounded-xl p-8">
              <div className="flex flex-col sm:flex-row items-center gap-8">
                {/* Album Art */}
                <div className="flex-shrink-0">
                  {data.track?.albumArt ? (
                    <Image
                      src={data.track.albumArt}
                      alt={data.track.album}
                      width={200}
                      height={200}
                      className="rounded-xl shadow-2xl shadow-green-400/20"
                      unoptimized
                    />
                  ) : (
                    <div className="w-48 h-48 rounded-xl bg-green-400/5 border border-green-400/10 flex items-center justify-center">
                      <Music size={64} className="text-green-400/20" />
                    </div>
                  )}
                </div>

                {/* Track Info */}
                <div className="flex-1 min-w-0 flex flex-col gap-4 w-full">
                  {data.playing && data.track ? (
                    <>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                          <span className="hud-label text-xs text-green-400">NOW PLAYING</span>
                        </div>
                        <h2 className="text-white text-2xl font-bold truncate">{data.track.name}</h2>
                        <p className="text-white/60 text-base truncate mt-1">{data.track.artists}</p>
                        <p className="text-white/30 text-sm truncate mt-0.5">{data.track.album}</p>
                      </div>

                      {/* Progress */}
                      <div className="space-y-1.5">
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-400 rounded-full transition-all duration-1000"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-white/30 text-xs font-mono">
                          <span>{formatMs(data.track.progress)}</span>
                          <span>{formatMs(data.track.duration)}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-8">
                      <Music size={32} className="text-white/20" />
                      <p className="text-white/40 text-sm">Nothing playing</p>
                      <p className="text-white/20 text-xs">Start playing something on Spotify</p>
                    </div>
                  )}

                  {/* Controls */}
                  <div className="flex items-center justify-center gap-4">
                    <button
                      onClick={() => control('prev')}
                      disabled={controlling}
                      className="w-11 h-11 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all disabled:opacity-40"
                    >
                      <SkipBack size={18} />
                    </button>
                    <button
                      onClick={() => control(data.playing ? 'pause' : 'play')}
                      disabled={controlling}
                      className="w-14 h-14 rounded-full bg-green-400/15 hover:bg-green-400/25 border border-green-400/30 flex items-center justify-center text-green-400 transition-all disabled:opacity-40"
                    >
                      {data.playing ? <Pause size={22} /> : <Play size={22} />}
                    </button>
                    <button
                      onClick={() => control('next')}
                      disabled={controlling}
                      className="w-11 h-11 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all disabled:opacity-40"
                    >
                      <SkipForward size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Volume Card */}
            <div className="hud-stat-card rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Volume2 size={14} className="text-green-400/70" />
                <span className="hud-label text-xs">VOLUME</span>
                <span className="ml-auto text-white/40 text-xs font-mono">{volume}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={volume}
                onChange={e => handleVolumeChange(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, rgba(74,222,128,0.8) 0%, rgba(74,222,128,0.8) ${volume}%, rgba(255,255,255,0.1) ${volume}%, rgba(255,255,255,0.1) 100%)`,
                }}
              />
            </div>

            {/* Refresh */}
            <div className="flex justify-end">
              <button
                onClick={fetchNowPlaying}
                className="flex items-center gap-2 text-white/30 hover:text-white/60 text-xs transition-colors"
              >
                <RefreshCw size={12} />
                Refresh
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
