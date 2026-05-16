'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global error:', error)
  }, [error])

  return (
    <html>
      <body style={{ background: '#000810', margin: 0 }}>
        <div className="min-h-screen flex items-center justify-center p-8" style={{ background: '#000810' }}>
          <div className="text-center max-w-md">
            <div className="text-red-400 text-6xl font-mono font-bold mb-4">ERR</div>
            <div className="text-red-400/60 text-xs font-mono tracking-widest uppercase mb-8">
              SYSTEM FAULT // NEXUS CORE EXCEPTION
            </div>
            <h1 className="text-white/90 text-xl font-semibold mb-2">Something went wrong</h1>
            <p className="text-white/40 text-sm mb-8">
              {error.message || 'An unexpected error occurred in the NEXUS system.'}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={reset}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-cyan-400 border border-cyan-400/30 hover:bg-cyan-400/10 transition-colors"
              >
                <RefreshCw size={14} /> Retry
              </button>
              <Link
                href="/dashboard"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white/70 border border-white/10 hover:bg-white/5 transition-colors"
              >
                <Home size={14} /> Dashboard
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
