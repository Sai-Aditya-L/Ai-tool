'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { Trophy, Lock, Star, Zap, CheckCircle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  earnedAt?: string
}

interface AchievementsData {
  earned: Achievement[]
  locked: Achievement[]
  total: number
  earnedCount: number
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

// ─── Achievement Card ──────────────────────────────────────────────────────────

interface AchievementCardProps {
  achievement: Achievement
  earned: boolean
}

function AchievementCard({ achievement, earned }: AchievementCardProps) {
  return (
    <div
      className={cn(
        'p-4 rounded-xl text-center transition-all',
        earned
          ? 'hover:scale-[1.02] cursor-default'
          : 'opacity-40 grayscale'
      )}
      style={earned ? {
        background: 'rgba(0,229,255,0.05)',
        border: '1px solid rgba(0,229,255,0.3)',
        boxShadow: '0 0 20px rgba(0,229,255,0.05)',
      } : {
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Icon */}
      <div className={cn(
        'text-3xl mb-2 mx-auto flex items-center justify-center w-12 h-12 rounded-full',
        earned
          ? 'bg-cyan-400/10 ring-1 ring-cyan-400/20'
          : 'bg-white/5'
      )}>
        {earned ? achievement.icon : '🔒'}
      </div>

      {/* Name */}
      <h3 className={cn(
        'font-semibold text-sm mb-1',
        earned ? 'text-white/90' : 'text-white/50'
      )}>
        {achievement.name}
      </h3>

      {/* Description */}
      <p className={cn(
        'text-xs leading-relaxed',
        earned ? 'text-white/50' : 'text-white/30'
      )}>
        {achievement.description}
      </p>

      {/* Date */}
      <div className="mt-3">
        {earned && achievement.earnedAt ? (
          <span className="text-cyan-400/60 text-[10px] nexus-mono flex items-center justify-center gap-1">
            <CheckCircle size={10} />
            Earned {daysAgo(achievement.earnedAt)}
          </span>
        ) : (
          <span className="text-white/20 text-[10px] nexus-mono">???</span>
        )}
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AchievementsPage() {
  const [data, setData] = useState<AchievementsData>({
    earned: [],
    locked: [],
    total: 14,
    earnedCount: 0,
  })
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)

  const fetchAchievements = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/achievements')
      if (!res.ok) throw new Error()
      const json = await res.json()
      setData({
        earned:      json.earned      ?? [],
        locked:      json.locked      ?? [],
        total:       json.total       ?? 14,
        earnedCount: json.earnedCount ?? (json.earned?.length ?? 0),
      })
    } catch {
      toast.error('Failed to load achievements')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAchievements()
  }, [fetchAchievements])

  async function handleScan() {
    setScanning(true)
    try {
      const res = await fetch('/api/achievements?check=1', { method: 'POST' })
      if (!res.ok) throw new Error()
      const json = await res.json()
      const newCount: number = json.newCount ?? json.newAchievements ?? 0
      if (newCount > 0) {
        toast.success(`${newCount} new achievement${newCount !== 1 ? 's' : ''} earned!`, { icon: '🏆' })
      } else {
        toast('All up to date', { icon: '✓' })
      }
      await fetchAchievements()
    } catch {
      toast.error('Scan failed')
    } finally {
      setScanning(false)
    }
  }

  const progressPct = data.total > 0 ? (data.earnedCount / data.total) * 100 : 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="ACHIEVEMENTS" subtitle="Your milestones & badges" />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* Stats bar + scan button */}
          <div className="glass-panel rounded-xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <Trophy size={20} className="text-cyan-400" />
                <div>
                  <p className="text-white/90 font-semibold">
                    Earned{' '}
                    <span className="nexus-mono text-cyan-400">{data.earnedCount}</span>
                    {' '}/{' '}
                    <span className="nexus-mono text-white/50">{data.total}</span>
                  </p>
                  <p className="text-white/30 text-xs">Total achievements</p>
                </div>
              </div>

              <button
                onClick={handleScan}
                disabled={scanning || loading}
                className={cn(
                  'nexus-btn-primary flex items-center gap-2 text-sm',
                  (scanning || loading) && 'opacity-60 cursor-not-allowed'
                )}
              >
                <RefreshCw size={14} className={scanning ? 'animate-spin' : ''} />
                {scanning ? 'Scanning…' : 'SCAN FOR NEW ACHIEVEMENTS'}
              </button>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${progressPct}%`,
                  background: 'linear-gradient(90deg, #00e5ff, #7b61ff)',
                  boxShadow: '0 0 12px rgba(0,229,255,0.4)',
                }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-white/30 text-[10px] nexus-mono">0%</span>
              <span className="text-cyan-400/60 text-[10px] nexus-mono">{Math.round(progressPct)}% complete</span>
              <span className="text-white/30 text-[10px] nexus-mono">100%</span>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Earned Section */}
              {data.earned.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Star size={14} className="text-cyan-400" />
                    <h2 className="text-white/70 text-xs font-medium uppercase tracking-widest">
                      Earned ({data.earned.length})
                    </h2>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {data.earned.map(achievement => (
                      <AchievementCard
                        key={achievement.id}
                        achievement={achievement}
                        earned
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Locked Section */}
              {data.locked.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Lock size={14} className="text-white/30" />
                    <h2 className="text-white/40 text-xs font-medium uppercase tracking-widest">
                      Locked ({data.locked.length})
                    </h2>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {data.locked.map(achievement => (
                      <AchievementCard
                        key={achievement.id}
                        achievement={achievement}
                        earned={false}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {data.earned.length === 0 && data.locked.length === 0 && (
                <div className="text-center py-16 glass-panel rounded-2xl">
                  <Trophy size={48} className="text-white/20 mx-auto mb-4" />
                  <p className="text-white/40 font-medium">No achievements yet</p>
                  <p className="text-white/25 text-sm mt-1">Click "Scan for New Achievements" to check your progress</p>
                  <button
                    onClick={handleScan}
                    disabled={scanning}
                    className="nexus-btn-primary flex items-center gap-2 text-sm mx-auto mt-5"
                  >
                    <Zap size={14} />
                    Scan Now
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
