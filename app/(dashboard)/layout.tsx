'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Sun, Moon } from 'lucide-react'
import { Sidebar } from '@/components/layout/sidebar'
import { CommandPalette } from '@/components/ui/command-palette'
import { QuickCapture } from '@/components/ui/quick-capture'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const saved = (localStorage.getItem('nexus-theme') as 'dark' | 'light') || 'dark'
    setTheme(saved)
    document.documentElement.setAttribute('data-theme', saved)
  }, [])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('nexus-theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  return (
    <div
      className={`flex h-screen overflow-hidden${theme === 'light' ? ' light-mode' : ''}`}
      style={{ background: theme === 'light' ? '#f0f4f8' : '#000810' }}
    >
      {/* Holographic grid background */}
      <div className="fixed inset-0 hud-grid opacity-100 pointer-events-none" />

      {/* Radial glow overlays */}
      <div className="fixed inset-0 pointer-events-none" style={{
        background: [
          'radial-gradient(ellipse at 15% 50%, rgba(0,229,255,0.04) 0%, transparent 55%)',
          'radial-gradient(ellipse at 85% 20%, rgba(255,160,0,0.03) 0%, transparent 45%)',
          'radial-gradient(ellipse at 50% 100%, rgba(123,97,255,0.04) 0%, transparent 50%)',
        ].join(', ')
      }} />

      {/* Scanline overlay */}
      <div className="fixed inset-0 pointer-events-none" style={{
        background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 4px)',
        zIndex: 1,
      }} />

      {/* Corner accent lights */}
      <div className="fixed top-0 left-0 w-64 h-64 pointer-events-none" style={{
        background: 'radial-gradient(circle at top left, rgba(0,229,255,0.06), transparent 70%)',
        zIndex: 1,
      }} />
      <div className="fixed bottom-0 right-0 w-64 h-64 pointer-events-none" style={{
        background: 'radial-gradient(circle at bottom right, rgba(255,160,0,0.04), transparent 70%)',
        zIndex: 1,
      }} />

      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="flex-1 flex flex-col overflow-hidden"
        >
          {children}
        </motion.div>
      </main>

      <CommandPalette />

      {/* Theme toggle — fixed position, top-right */}
      <button
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        className="fixed top-4 right-4 z-40 w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        style={{
          background: 'rgba(0,229,255,0.08)',
          border: '1px solid rgba(0,229,255,0.18)',
        }}
      >
        {theme === 'dark' ? (
          <Sun size={15} className="text-cyan-400/70" />
        ) : (
          <Moon size={15} className="text-cyan-400/70" />
        )}
      </button>

      <QuickCapture />
    </div>
  )
}
