'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
      <AlertTriangle size={40} className="text-red-400 mb-4" />
      <h2 className="text-white/90 text-lg font-semibold mb-2">Page Error</h2>
      <p className="text-white/40 text-sm mb-6 max-w-sm">
        {error.message || 'This page encountered an error. Your data is safe.'}
      </p>
      <button
        onClick={reset}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-cyan-400 border border-cyan-400/30 hover:bg-cyan-400/10 transition-colors"
      >
        <RefreshCw size={14} /> Try Again
      </button>
    </div>
  )
}
