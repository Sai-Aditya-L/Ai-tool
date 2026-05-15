'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[NEXUS Global Error]', error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          background: '#050510',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          flexDirection: 'column',
          gap: '16px',
          fontFamily: "'Space Grotesk', sans-serif",
          margin: 0,
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            border: '1px solid rgba(248,113,113,0.3)',
            background: 'rgba(248,113,113,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
          }}
        >
          ⚠
        </div>
        <h2 style={{ fontSize: 20, margin: 0, fontWeight: 600 }}>NEXUS — Critical Error</h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, margin: 0, maxWidth: 360, textAlign: 'center' }}>
          {error.message || 'A critical error occurred. Please try again.'}
        </p>
        {error.digest && (
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, fontFamily: 'monospace', margin: 0 }}>
            Error ID: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          style={{
            padding: '10px 24px',
            border: '1px solid rgba(0,212,255,0.4)',
            background: 'rgba(0,212,255,0.1)',
            color: '#00d4ff',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 14,
            fontFamily: 'inherit',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
