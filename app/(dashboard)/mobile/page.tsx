'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import {
  Smartphone,
  Monitor,
  Bell,
  BellOff,
  BellRing,
  Download,
  CheckCircle,
  Lock,
  Wifi,
  WifiOff,
  RefreshCw,
  Share2,
  ExternalLink,
  Keyboard,
  Layers,
} from 'lucide-react'
import Link from 'next/link'

// ─── Types ───────────────────────────────────────────────────────────────────

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepBadge({ n }: { n: number }) {
  return (
    <span className="w-6 h-6 rounded-full bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center text-cyan-400 text-xs font-bold flex-shrink-0">
      {n}
    </span>
  )
}

function SectionHeading({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="text-cyan-400/70">{icon}</div>
      <h2 className="hud-label text-sm uppercase tracking-widest text-cyan-400/80">{label}</h2>
      <div className="flex-1 h-px bg-cyan-400/10" />
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MobilePage() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState(false)
  const [installOutcome, setInstallOutcome] = useState<'accepted' | 'dismissed' | null>(null)
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default')

  useEffect(() => {
    // Detect if already running as installed PWA
    if (typeof window !== 'undefined') {
      setIsStandalone(window.matchMedia('(display-mode: standalone)').matches)
    }

    // Capture install prompt
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Check notification permission
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission)
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!installPrompt) return
    await installPrompt.prompt()
    const result = await installPrompt.userChoice
    setInstallOutcome(result.outcome)
    if (result.outcome === 'accepted') {
      setInstallPrompt(null)
      setIsStandalone(true)
    }
  }

  async function handleRequestNotifications() {
    if (!('Notification' in window)) return
    const perm = await Notification.requestPermission()
    setNotifPermission(perm)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="MOBILE & DEVICES"
        subtitle="Cross-platform access and PWA installation"
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-10">

          {/* ══════════════════════════════════════════════════════════════════
              SECTION 1 — Install NEXUS
          ══════════════════════════════════════════════════════════════════ */}
          <section>
            <SectionHeading icon={<Download size={16} />} label="Install NEXUS" />

            {/* PWA Install Prompt Card */}
            <div className="hud-stat-card rounded-xl p-5 mb-4 border border-cyan-400/20">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center">
                    <Download size={20} className="text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">Install NEXUS App</p>
                    <p className="text-white/40 text-xs mt-0.5">Add to your home screen for the best experience</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {isStandalone || installOutcome === 'accepted' ? (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-400/10 border border-green-400/20 text-green-400 text-xs font-medium">
                      <CheckCircle size={13} />
                      Already installed
                    </span>
                  ) : installPrompt ? (
                    <button
                      onClick={handleInstall}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400 text-black text-xs font-bold uppercase tracking-wider hover:bg-cyan-300 transition-colors"
                    >
                      <Download size={13} />
                      Install App
                    </button>
                  ) : (
                    <div className="text-right">
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 text-xs">
                        Not available
                      </span>
                      <p className="text-white/25 text-[10px] mt-1 max-w-[180px] leading-tight">
                        Use Chrome on Android or Safari on iOS to install
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {installOutcome === 'dismissed' && (
                <p className="text-white/30 text-xs mt-3 border-t border-white/5 pt-3">
                  You dismissed the install prompt. Refresh the page to try again.
                </p>
              )}
            </div>

            {/* Platform Install Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* iOS Card */}
              <div className="hud-stat-card rounded-xl p-5 border border-rose-400/15" style={{ background: 'rgba(244,63,94,0.03)' }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-rose-400/10 border border-rose-400/20 flex items-center justify-center">
                    <Smartphone size={18} className="text-rose-300" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">Install on iPhone / iPad</p>
                    <p className="text-white/40 text-xs">iOS 16.4+ recommended</p>
                  </div>
                </div>

                <ol className="space-y-3">
                  {[
                    <>Open NEXUS in <span className="text-rose-300 font-medium">Safari</span> (required — Chrome won&apos;t work on iOS)</>,
                    <>Tap the <span className="text-rose-300 font-medium">Share</span> button (the box with arrow pointing up)</>,
                    <>Scroll down and tap <span className="text-rose-300 font-medium">&ldquo;Add to Home Screen&rdquo;</span></>,
                    <>Tap <span className="text-rose-300 font-medium">Add</span> — NEXUS icon appears on your home screen</>,
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <StepBadge n={i + 1} />
                      <p className="text-white/60 text-xs leading-relaxed pt-0.5">{step}</p>
                    </li>
                  ))}
                </ol>

                <div className="mt-4 pt-4 border-t border-rose-400/10">
                  <p className="text-white/30 text-[10px] flex items-start gap-1.5">
                    <BellRing size={11} className="text-rose-300/50 flex-shrink-0 mt-0.5" />
                    Supports push notifications after installation on iOS 16.4+
                  </p>
                </div>
              </div>

              {/* Android Card */}
              <div className="hud-stat-card rounded-xl p-5 border border-green-400/15" style={{ background: 'rgba(74,222,128,0.03)' }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-green-400/10 border border-green-400/20 flex items-center justify-center">
                    <Smartphone size={18} className="text-green-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">Install on Android</p>
                    <p className="text-white/40 text-xs">Chrome on Android</p>
                  </div>
                </div>

                <ol className="space-y-3">
                  {[
                    <>Open NEXUS in <span className="text-green-400 font-medium">Chrome</span> on Android</>,
                    <>Tap the <span className="text-green-400 font-medium">three-dot menu</span> (&#8942;) in the top right</>,
                    <>Tap <span className="text-green-400 font-medium">&ldquo;Add to Home Screen&rdquo;</span> or <span className="text-green-400 font-medium">&ldquo;Install App&rdquo;</span></>,
                    <>Tap <span className="text-green-400 font-medium">Install</span> — NEXUS appears in your app drawer</>,
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <StepBadge n={i + 1} />
                      <p className="text-white/60 text-xs leading-relaxed pt-0.5">{step}</p>
                    </li>
                  ))}
                </ol>

                <div className="mt-4 pt-4 border-t border-green-400/10">
                  <p className="text-white/30 text-[10px] flex items-start gap-1.5">
                    <ExternalLink size={11} className="text-green-400/50 flex-shrink-0 mt-0.5" />
                    Or click the Install button in Chrome&apos;s address bar
                  </p>
                </div>
              </div>

            </div>
          </section>

          {/* ══════════════════════════════════════════════════════════════════
              SECTION 2 — PWA Capabilities
          ══════════════════════════════════════════════════════════════════ */}
          <section>
            <SectionHeading icon={<Layers size={16} />} label="PWA Capabilities" />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  icon: <WifiOff size={20} />,
                  label: 'Offline Shell',
                  desc: 'Dashboard and navigation work without internet',
                  color: 'text-cyan-400',
                  bg: 'bg-cyan-400/10',
                  border: 'border-cyan-400/15',
                  emoji: '⚡',
                },
                {
                  icon: <Bell size={20} />,
                  label: 'Push Notifications',
                  desc: 'Reminders and alerts even when app is closed',
                  color: 'text-violet-400',
                  bg: 'bg-violet-400/10',
                  border: 'border-violet-400/15',
                  emoji: '🔔',
                },
                {
                  icon: <Smartphone size={20} />,
                  label: 'Home Screen Icon',
                  desc: 'Launch like a native app from your home screen',
                  color: 'text-green-400',
                  bg: 'bg-green-400/10',
                  border: 'border-green-400/15',
                  emoji: '📱',
                },
                {
                  icon: <RefreshCw size={20} />,
                  label: 'Auto Sync',
                  desc: 'Data syncs automatically when connection restored',
                  color: 'text-amber-400',
                  bg: 'bg-amber-400/10',
                  border: 'border-amber-400/15',
                  emoji: '🔄',
                },
              ].map(({ icon, label, desc, color, bg, border, emoji }) => (
                <div key={label} className={`hud-stat-card rounded-xl p-5 border ${border}`}>
                  <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3 ${color}`}>
                    {icon}
                  </div>
                  <p className="text-white/80 text-sm font-semibold mb-1">
                    <span className="mr-1.5">{emoji}</span>{label}
                  </p>
                  <p className="text-white/40 text-xs leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ══════════════════════════════════════════════════════════════════
              SECTION 3 — Keyboard Shortcuts
          ══════════════════════════════════════════════════════════════════ */}
          <section>
            <SectionHeading icon={<Keyboard size={16} />} label="Keyboard Shortcuts" />

            <div className="hud-stat-card rounded-xl p-5">
              <p className="text-white/30 text-xs mb-5 flex items-center gap-2">
                <Monitor size={12} className="text-cyan-400/40" />
                Desktop reference — full keyboard control
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Navigation */}
                <div>
                  <p className="hud-label text-xs uppercase tracking-widest text-cyan-400/60 mb-3">Navigation</p>
                  <div className="space-y-2">
                    {[
                      { keys: ['G', 'D'], action: 'Dashboard' },
                      { keys: ['G', 'C'], action: 'Chat' },
                      { keys: ['G', 'T'], action: 'Tasks' },
                      { keys: ['G', 'A'], action: 'Agents' },
                      { keys: ['G', 'V'], action: 'Voice' },
                    ].map(({ keys, action }) => (
                      <div key={action} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          {keys.map((k, i) => (
                            <span key={i} className="flex items-center gap-1">
                              <kbd className="px-2 py-0.5 rounded border border-white/15 bg-white/5 text-white/60 text-[10px] font-mono">
                                {k}
                              </kbd>
                              {i < keys.length - 1 && (
                                <span className="text-white/20 text-[10px]">then</span>
                              )}
                            </span>
                          ))}
                        </div>
                        <span className="text-white/40 text-xs text-right">{action}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div>
                  <p className="hud-label text-xs uppercase tracking-widest text-cyan-400/60 mb-3">Actions</p>
                  <div className="space-y-2">
                    {[
                      { keys: ['⌘K', 'Ctrl+K'], action: 'Command palette (coming soon)' },
                      { keys: ['⌘/', 'Ctrl+/'], action: 'AI Chat' },
                      { keys: ['N'], action: 'New item (context-dependent)' },
                      { keys: ['Esc'], action: 'Close panel' },
                    ].map(({ keys, action }) => (
                      <div key={action} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <kbd className="px-2 py-0.5 rounded border border-white/15 bg-white/5 text-white/60 text-[10px] font-mono whitespace-nowrap">
                            {keys[0]}
                          </kbd>
                        </div>
                        <span className="text-white/40 text-xs text-right leading-tight">{action}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Voice */}
                <div>
                  <p className="hud-label text-xs uppercase tracking-widest text-cyan-400/60 mb-3">Voice</p>
                  <div className="space-y-2">
                    {[
                      { keys: ['Space (hold)'], action: 'Push to talk (in Voice Center)' },
                      { keys: ['V'], action: 'Open Voice Center' },
                    ].map(({ keys, action }) => (
                      <div key={action} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <kbd className="px-2 py-0.5 rounded border border-white/15 bg-white/5 text-white/60 text-[10px] font-mono whitespace-nowrap">
                            {keys[0]}
                          </kbd>
                        </div>
                        <span className="text-white/40 text-xs text-right leading-tight">{action}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════════════════════════════
              SECTION 4 — Cross-Device Sync
          ══════════════════════════════════════════════════════════════════ */}
          <section>
            <SectionHeading icon={<RefreshCw size={16} />} label="Cross-Device Sync" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  icon: <Wifi size={18} />,
                  title: 'Real-time sync',
                  desc: 'All changes saved instantly to the server — always up to date across every device.',
                  color: 'text-cyan-400',
                  border: 'border-cyan-400/15',
                },
                {
                  icon: <Share2 size={18} />,
                  title: 'Continue anywhere',
                  desc: 'Start a task on desktop, complete it on phone. Your context travels with you.',
                  color: 'text-violet-400',
                  border: 'border-violet-400/15',
                },
                {
                  icon: <BellRing size={18} />,
                  title: 'Push notifications',
                  desc: 'Enable in Settings → Notifications for mobile alerts on reminders and task updates.',
                  color: 'text-amber-400',
                  border: 'border-amber-400/15',
                },
                {
                  icon: <WifiOff size={18} />,
                  title: 'Offline support',
                  desc: 'Core features work offline and queue changes locally, syncing when reconnected.',
                  color: 'text-green-400',
                  border: 'border-green-400/15',
                },
              ].map(({ icon, title, desc, color, border }) => (
                <div key={title} className={`hud-stat-card rounded-xl p-5 border ${border} flex gap-4`}>
                  <div className={`flex-shrink-0 mt-0.5 ${color}`}>{icon}</div>
                  <div>
                    <p className="text-white/80 text-sm font-semibold mb-1">{title}</p>
                    <p className="text-white/40 text-xs leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ══════════════════════════════════════════════════════════════════
              SECTION 5 — Native Apps Roadmap
          ══════════════════════════════════════════════════════════════════ */}
          <section>
            <SectionHeading icon={<Smartphone size={16} />} label="Native Apps — Coming Soon" />

            <div className="hud-stat-card rounded-xl p-5 border border-amber-400/20" style={{ background: 'rgba(251,191,36,0.02)' }}>
              <div className="flex items-start gap-3 mb-5 p-4 rounded-xl border border-amber-400/15 bg-amber-400/5">
                <div className="w-8 h-8 rounded-lg bg-amber-400/15 border border-amber-400/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Smartphone size={16} className="text-amber-400" />
                </div>
                <div>
                  <p className="text-amber-400 text-sm font-semibold mb-1">Native iOS &amp; Android Apps</p>
                  <p className="text-white/40 text-xs leading-relaxed">
                    Native iOS and Android apps are planned for a future release and will unlock additional capabilities:
                  </p>
                </div>
              </div>

              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  'True background wake-word detection',
                  'Siri / Google Assistant integration',
                  'Home screen widgets (next event, tasks)',
                  'Apple Watch / Wear OS companion apps',
                  'Native file system access',
                  'Background sync and location-based reminders',
                  'Shortcuts app integration (iOS)',
                  'Android widgets and quick tiles',
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-2.5 text-xs text-white/40 py-1.5 px-2 rounded-lg hover:bg-amber-400/5 transition-colors">
                    <Lock size={12} className="text-amber-400/50 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* ══════════════════════════════════════════════════════════════════
              SECTION 6 — Push Notifications Setup
          ══════════════════════════════════════════════════════════════════ */}
          <section>
            <SectionHeading icon={<Bell size={16} />} label="Push Notifications Setup" />

            <div className="hud-stat-card rounded-xl p-5 border border-violet-400/15">
              <div className="flex items-start justify-between gap-6 flex-wrap">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-violet-400/10 border border-violet-400/20 flex items-center justify-center flex-shrink-0">
                    {notifPermission === 'granted' ? (
                      <BellRing size={20} className="text-green-400" />
                    ) : notifPermission === 'denied' ? (
                      <BellOff size={20} className="text-red-400" />
                    ) : (
                      <Bell size={20} className="text-violet-400" />
                    )}
                  </div>

                  <div>
                    <p className="text-white/80 text-sm font-semibold mb-1">
                      Notification Permission
                    </p>

                    {notifPermission === 'granted' && (
                      <div>
                        <span className="flex items-center gap-1.5 text-green-400 text-xs font-medium">
                          <CheckCircle size={13} />
                          Notifications Enabled
                        </span>
                        <p className="text-white/30 text-xs mt-1.5 leading-relaxed">
                          You&apos;ll receive alerts for reminders, tasks, and agent updates.
                        </p>
                      </div>
                    )}

                    {notifPermission === 'denied' && (
                      <div>
                        <span className="flex items-center gap-1.5 text-red-400 text-xs font-medium">
                          <BellOff size={13} />
                          Notifications Blocked
                        </span>
                        <p className="text-white/30 text-xs mt-1.5 leading-relaxed max-w-sm">
                          To re-enable, click the lock / info icon in your browser&apos;s address bar
                          and set Notifications to &ldquo;Allow&rdquo;, then reload the page.
                        </p>
                      </div>
                    )}

                    {notifPermission === 'default' && (
                      <p className="text-white/40 text-xs leading-relaxed max-w-sm">
                        Allow notifications to receive reminders and alerts even when NEXUS is in the background.
                      </p>
                    )}
                  </div>
                </div>

                {notifPermission === 'default' && (
                  <button
                    onClick={handleRequestNotifications}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/20 border border-violet-400/30 text-violet-300 text-xs font-bold uppercase tracking-wider hover:bg-violet-500/30 hover:border-violet-400/50 transition-all"
                  >
                    <Bell size={13} />
                    Enable Notifications
                  </button>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                <p className="text-white/25 text-xs">
                  Manage notification types and schedules in your preferences.
                </p>
                <Link
                  href="/notifications"
                  className="flex items-center gap-1.5 text-violet-400/70 hover:text-violet-400 text-xs transition-colors"
                >
                  Notification Preferences
                  <ExternalLink size={11} />
                </Link>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}
