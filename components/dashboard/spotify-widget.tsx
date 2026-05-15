'use client'

import { useState, useEffect, useCallback } from 'react'
import { Play, Pause, SkipForward, Music, ExternalLink } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

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

export function SpotifyWidget() {
  const [data, setData] = useState<NowPlayingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [controlling, setControlling] = useState(false)

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
    fetchNowPlaying()
    const interval = setInterval(fetchNowPlaying, 10_000)
    return () => clearInterval(interval)
  }, [fetchNowPlaying])

  const control = async (action: string) => {
    if (controlling) return
    setControlling(true)
    try {
      await fetch('/api/spotify/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      // Refresh after short delay for state to settle
      setTimeout(fetchNowPlaying, 500)
    } catch {
      // ignore
    }
    setControlling(false)
  }

  const progressPct =
    data?.track && data.track.duration > 0
      ? Math.min(100, (data.track.progress / data.track.duration) * 100)
      : 0

  return (
    <div className="hud-stat-card rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Music size={12} className="text-green-400" />
          <span className="hud-label text-xs">SPOTIFY</span>
        </div>
        <Link href="/media" className="text-white/20 hover:text-green-400 transition-colors">
          <ExternalLink size={11} />
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="hud-label text-xs">LOADING...</span>
        </div>
      ) : !data?.connected ? (
        <div className="space-y-2">
          <p className="text-white/40 text-xs">Spotify not connected</p>
          <Link
            href="/api/spotify/auth"
            className="inline-flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 transition-colors border border-green-400/30 rounded-lg px-3 py-1.5"
          >
            <Music size={11} />
            Connect Spotify
          </Link>
        </div>
      ) : !data.playing || !data.track ? (
        <div className="flex items-center gap-2 py-1">
          <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center flex-shrink-0">
            <Music size={14} className="text-white/20" />
          </div>
          <span className="text-white/30 text-xs">Nothing playing</span>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Track info */}
          <div className="flex items-center gap-3">
            {data.track.albumArt ? (
              <Image
                src={data.track.albumArt}
                alt={data.track.album}
                width={40}
                height={40}
                className="rounded flex-shrink-0"
                unoptimized
              />
            ) : (
              <div className="w-10 h-10 rounded bg-green-400/10 flex items-center justify-center flex-shrink-0">
                <Music size={16} className="text-green-400/50" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{data.track.name}</p>
              <p className="text-white/50 text-xs truncate">{data.track.artists}</p>
            </div>
            {/* Controls */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => control(data.playing ? 'pause' : 'play')}
                disabled={controlling}
                className="w-7 h-7 rounded-full bg-green-400/10 hover:bg-green-400/20 flex items-center justify-center text-green-400 transition-colors disabled:opacity-50"
              >
                {data.playing ? <Pause size={12} /> : <Play size={12} />}
              </button>
              <button
                onClick={() => control('next')}
                disabled={controlling}
                className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors disabled:opacity-50"
              >
                <SkipForward size={12} />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-400 rounded-full transition-all duration-1000"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
