import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function LandingPage() {
  const session = await getServerSession(authOptions)
  if (session) redirect('/dashboard')

  return (
    <main className="relative min-h-screen bg-nexus-darker overflow-hidden flex flex-col items-center justify-center">
      {/* Background Grid */}
      <div className="absolute inset-0 nexus-grid-bg opacity-40" />

      {/* Radial glow background */}
      <div className="absolute inset-0 bg-nexus-radial" />

      {/* Animated orb glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(0,212,255,0.06) 0%, rgba(124,58,237,0.04) 40%, transparent 70%)',
        }}
      />

      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 rounded-full border-2 border-cyan-400/30 animate-spin-slow" />
            <div className="absolute inset-2 rounded-full border border-violet-500/30 animate-spin-reverse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full glow-cyan"
                style={{
                  background: 'radial-gradient(circle, rgba(0,212,255,0.8) 0%, rgba(124,58,237,0.6) 60%, transparent 100%)',
                }}
              />
            </div>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-6xl md:text-7xl font-bold mb-4 tracking-tight">
          <span className="nexus-text-gradient">NEXUS</span>
        </h1>
        <p className="text-cyan-400/70 text-sm tracking-[0.3em] uppercase mb-6 font-mono">
          Neural EXtended Universal System
        </p>

        <p className="text-white/60 text-lg md:text-xl mb-12 max-w-2xl mx-auto leading-relaxed">
          Your AI-powered personal operating system. Manage your entire digital life,
          work, and future through unified intelligence.
        </p>

        {/* Feature chips */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {[
            'AI Chat', 'Voice Commands', 'Task Management', 'Smart Reminders',
            'Personal Memory', 'Automation Engine', 'Dev Tools', 'Cross-Platform'
          ].map((feature) => (
            <span key={feature} className="glass-panel text-xs text-cyan-400/70 px-3 py-1.5 rounded-full border border-cyan-400/20">
              {feature}
            </span>
          ))}
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/login" className="nexus-btn-primary text-center">
            Initialize NEXUS
          </Link>
          <Link href="/register" className="nexus-btn-secondary text-center">
            Create Account
          </Link>
        </div>

        {/* Status indicator */}
        <div className="mt-12 flex items-center justify-center gap-2 text-xs text-white/30">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span>All systems operational</span>
          <span className="mx-2">•</span>
          <span className="nexus-mono">v1.0.0</span>
        </div>
      </div>

      {/* Corner decorations */}
      <div className="absolute top-6 left-6 text-cyan-400/20 text-xs nexus-mono">
        SYS://NEXUS/BOOT
      </div>
      <div className="absolute top-6 right-6 text-cyan-400/20 text-xs nexus-mono">
        STATUS: ONLINE
      </div>
      <div className="absolute bottom-6 left-6 text-cyan-400/20 text-xs nexus-mono">
        v1.0.0-alpha
      </div>
      <div className="absolute bottom-6 right-6 text-cyan-400/20 text-xs nexus-mono">
        NEURAL LINK READY
      </div>
    </main>
  )
}
