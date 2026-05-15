'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[NEXUS Dashboard Error]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-red-400/10 border border-red-400/20 flex items-center justify-center">
        <AlertTriangle size={28} className="text-red-400" />
      </div>
      <div>
        <h2 className="text-white font-semibold text-lg mb-2">Something went wrong</h2>
        <p className="text-white/40 text-sm max-w-sm mx-auto">
          {error.message || 'An unexpected error occurred in this section.'}
        </p>
        {error.digest && (
          <p className="text-white/20 text-xs mt-2 font-mono">Error ID: {error.digest}</p>
        )}
      </div>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="nexus-btn-primary flex items-center gap-2 text-sm"
        >
          <RefreshCw size={14} /> Try again
        </button>
        <a href="/dashboard" className="nexus-btn-secondary flex items-center gap-2 text-sm">
          <Home size={14} /> Dashboard
        </a>
      </div>
    </div>
  )
}
