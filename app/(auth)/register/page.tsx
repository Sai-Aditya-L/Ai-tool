'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { signIn } from 'next-auth/react'

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      toast.error('Access keys do not match')
      return
    }
    if (password.length < 8) {
      toast.error('Access key must be at least 8 characters')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Registration failed')
        return
      }

      toast.success('Neural profile created. Establishing link...')
      await signIn('credentials', {
        email,
        password,
        callbackUrl: '/dashboard',
      })
    } catch {
      toast.error('System error. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-nexus-darker flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 nexus-grid-bg opacity-30" />
      <div className="absolute inset-0 bg-nexus-radial" />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.05) 0%, rgba(0,212,255,0.03) 40%, transparent 70%)' }}
      />

      <div className="relative z-10 w-full max-w-md px-6 py-12">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border border-violet-500/30 animate-spin-slow" />
              <div className="absolute inset-1 rounded-full border border-cyan-400/20 animate-spin-reverse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full"
                  style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.9) 0%, rgba(0,212,255,0.7) 60%, transparent 100%)' }}
                />
              </div>
            </div>
          </div>
          <h1 className="text-3xl font-bold nexus-text-gradient">NEXUS</h1>
          <p className="text-white/40 text-sm mt-1 tracking-widest uppercase font-mono">
            Neural Profile Creation
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-8">
          <h2 className="text-white font-semibold text-lg mb-6">Initialize Neural Profile</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-white/50 text-xs uppercase tracking-wider mb-1.5 block">
                Display Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                className="nexus-input"
              />
            </div>

            <div>
              <label className="text-white/50 text-xs uppercase tracking-wider mb-1.5 block">
                Neural ID (Email)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="nexus-input"
              />
            </div>

            <div>
              <label className="text-white/50 text-xs uppercase tracking-wider mb-1.5 block">
                Access Key (Password)
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
                minLength={8}
                className="nexus-input"
              />
            </div>

            <div>
              <label className="text-white/50 text-xs uppercase tracking-wider mb-1.5 block">
                Confirm Access Key
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat password"
                required
                className="nexus-input"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="nexus-btn-primary w-full text-center disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                  Creating Profile...
                </span>
              ) : (
                'Create Neural Profile'
              )}
            </button>
          </form>

          <p className="text-center text-white/30 text-sm mt-6">
            Already have a profile?{' '}
            <Link href="/login" className="text-cyan-400 hover:text-cyan-300 transition-colors">
              Initialize link
            </Link>
          </p>
        </div>

        <p className="text-center text-white/20 text-xs mt-6 nexus-mono">
          NEXUS v1.0 — End-to-End Encrypted
        </p>
      </div>

      <div className="absolute top-4 left-4 text-cyan-400/20 text-xs nexus-mono">AUTH://REGISTER</div>
      <div className="absolute top-4 right-4 text-violet-400/20 text-xs nexus-mono">PROFILE INIT</div>
    </div>
  )
}
