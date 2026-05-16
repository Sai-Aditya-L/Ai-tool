import Link from 'next/link'

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-8"
      style={{ background: '#000810' }}
    >
      {/* HUD grid background */}
      <div className="fixed inset-0 hud-grid opacity-100 pointer-events-none" />

      <div className="relative z-10 text-center max-w-md">
        {/* Large 404 */}
        <div
          className="text-[120px] font-bold leading-none hud-text-cyan hud-text-glow mb-4"
          style={{ fontFamily: 'var(--font-mono, monospace)' }}
        >
          404
        </div>

        {/* Error label */}
        <div className="hud-label mb-4">SIGNAL LOST // ROUTE NOT FOUND</div>

        {/* Description */}
        <p className="text-white/50 text-sm mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          NEXUS could not establish a connection to this coordinate.
        </p>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="nexus-btn-primary flex items-center gap-2 px-6 py-2.5"
          >
            Return to Dashboard
          </Link>
          <Link
            href="/chat"
            className="px-6 py-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white/80 hover:border-white/20 transition-all text-sm"
          >
            Ask NEXUS
          </Link>
        </div>
      </div>
    </div>
  )
}
