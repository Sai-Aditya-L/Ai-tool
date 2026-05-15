'use client'

import { Toaster } from 'react-hot-toast'

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgba(10, 10, 26, 0.95)',
            color: '#fff',
            border: '1px solid rgba(0, 212, 255, 0.2)',
            backdropFilter: 'blur(10px)',
            fontFamily: "'Space Grotesk', sans-serif",
          },
          success: {
            iconTheme: {
              primary: '#00d4ff',
              secondary: '#050510',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#050510',
            },
          },
        }}
      />
    </>
  )
}
