'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [totpRequired, setTotpRequired] = useState(false)
  const [totpCode, setTotpCode] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        totp: totpCode,
        redirect: false,
      })

      if (result?.error === 'TOTP_REQUIRED') {
        setTotpRequired(true)
      } else if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('NEXUS online. Welcome back.')
        router.push('/dashboard')
        router.refresh()
      }
    } catch {
      toast.error('Connection failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSignIn() {
    setLoading(true)
    await signIn('google', { callbackUrl: '/dashboard' })
  }

  async function handleGithubSignIn() {
    setLoading(true)
    await signIn('github', { callbackUrl: '/dashboard' })
  }

  return (
    <div className="relative min-h-screen bg-nexus-darker flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 nexus-grid-bg opacity-30" />
      <div className="absolute inset-0 bg-nexus-radial" />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.05) 0%, rgba(124,58,237,0.03) 40%, transparent 70%)' }}
      />

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border border-cyan-400/30 animate-spin-slow" />
              <div className="absolute inset-1 rounded-full border border-violet-500/20 animate-spin-reverse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full"
                  style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.9) 0%, rgba(124,58,237,0.7) 60%, transparent 100%)' }}
                />
              </div>
            </div>
          </div>
          <h1 className="text-3xl font-bold nexus-text-gradient">NEXUS</h1>
          <p className="text-white/40 text-sm mt-1 tracking-widest uppercase font-mono">
            Neural Link Authentication
          </p>
        </div>

        {/* Form Card */}
        <div className="glass-panel rounded-2xl p-8">
          <h2 className="text-white font-semibold text-lg mb-6">Initialize Session</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!totpRequired ? (
              <>
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
                    placeholder="••••••••••••"
                    required
                    className="nexus-input"
                  />
                </div>
              </>
            ) : (
              <div>
                <p className="text-white/60 text-sm mb-4">
                  Enter the 6-digit code from your authenticator app
                </p>
                <label className="text-white/50 text-xs uppercase tracking-wider mb-1.5 block">
                  Authenticator Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  required
                  autoFocus
                  className="nexus-input tracking-widest text-center text-lg"
                />
                <button
                  type="button"
                  onClick={() => { setTotpRequired(false); setTotpCode('') }}
                  className="mt-3 text-white/40 text-xs hover:text-white/60 transition-colors"
                >
                  ← Back to email &amp; password
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="nexus-btn-primary w-full text-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                  Establishing Link...
                </span>
              ) : totpRequired ? (
                'VERIFY & LOGIN'
              ) : (
                'Initialize Neural Link'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-white/30 text-xs">OR</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* OAuth */}
          <div className="space-y-3">
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="nexus-btn-secondary w-full flex items-center justify-center gap-3"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>

            <button
              onClick={handleGithubSignIn}
              disabled={loading}
              className="nexus-btn-secondary w-full flex items-center justify-center gap-3"
            >
              <svg className="w-4 h-4" fill="white" viewBox="0 0 24 24">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
              Continue with GitHub
            </button>
          </div>

          <p className="text-center text-white/30 text-sm mt-6">
            No account?{' '}
            <Link href="/register" className="text-cyan-400 hover:text-cyan-300 transition-colors">
              Create neural profile
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-white/20 text-xs mt-6 nexus-mono">
          NEXUS v1.0 — Encrypted & Secure
        </p>
      </div>

      {/* Corners */}
      <div className="absolute top-4 left-4 text-cyan-400/20 text-xs nexus-mono">AUTH://PORTAL</div>
      <div className="absolute top-4 right-4 text-cyan-400/20 text-xs nexus-mono">SECURE CHANNEL</div>
    </div>
  )
}
