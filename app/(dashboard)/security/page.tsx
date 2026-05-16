'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { Header } from '@/components/layout/header'
import {
  Shield,
  Lock,
  Unlock,
  Smartphone,
  Key,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle,
  Copy,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TwoFASetup {
  secret: string
  qrCode: string
  uri: string
}

// ─── 2FA Modal ────────────────────────────────────────────────────────────────

function TwoFAModal({
  setup,
  onVerify,
  onClose,
}: {
  setup: TwoFASetup
  onVerify: (token: string) => Promise<void>
  onClose: () => void
}) {
  const [token, setToken] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [verifying, setVerifying] = useState(false)

  async function handleVerify() {
    if (token.length !== 6) {
      toast.error('Please enter a 6-digit code')
      return
    }
    setVerifying(true)
    try {
      await onVerify(token)
    } finally {
      setVerifying(false)
    }
  }

  function copySecret() {
    navigator.clipboard.writeText(setup.secret).then(() => toast.success('Secret copied'))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-md rounded-2xl p-6"
        style={{
          background: 'rgba(0, 8, 20, 0.95)',
          border: '1px solid rgba(0, 229, 255, 0.2)',
          boxShadow: '0 0 60px rgba(0,229,255,0.1), 0 24px 60px rgba(0,0,0,0.6)',
        }}
      >
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.2)' }}
          >
            <Smartphone size={16} className="text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white/90">Set up Two-Factor Authentication</h3>
            <p className="text-xs text-white/35">Scan the QR code with your authenticator app</p>
          </div>
        </div>

        {/* QR Code */}
        <div className="flex justify-center mb-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={setup.qrCode}
            alt="2FA QR Code"
            className="rounded-xl"
            style={{ width: 180, height: 180, background: 'white', padding: '8px' }}
          />
        </div>

        {/* Manual entry secret */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-white/40">Manual entry secret</label>
            <button
              type="button"
              onClick={() => setShowSecret(s => !s)}
              className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors"
            >
              {showSecret ? <EyeOff size={11} /> : <Eye size={11} />}
              {showSecret ? 'Hide' : 'Show'}
            </button>
          </div>
          <div
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <span className="flex-1 text-xs font-mono text-white/60 break-all">
              {showSecret ? setup.secret : '•'.repeat(Math.min(setup.secret.length, 32))}
            </span>
            <button
              type="button"
              onClick={copySecret}
              className="flex-shrink-0 text-white/30 hover:text-cyan-400 transition-colors"
            >
              <Copy size={13} />
            </button>
          </div>
        </div>

        {/* Verification input */}
        <div className="mb-5">
          <label className="text-xs text-white/40 mb-1.5 block">Enter verification code</label>
          <input
            type="text"
            value={token}
            onChange={e => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6-digit code"
            maxLength={6}
            className="w-full bg-white/5 border border-cyan-400/20 rounded-xl px-4 py-3 text-white/90 placeholder-white/20 outline-none focus:border-cyan-400/50 transition-all text-sm text-center tracking-[0.3em] nexus-mono"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleVerify()}
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-white/40 text-sm hover:text-white/60 hover:border-white/20 transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleVerify}
            disabled={verifying || token.length !== 6}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
            style={{
              background: 'rgba(0,229,255,0.15)',
              color: '#00e5ff',
              border: '1px solid rgba(0,229,255,0.35)',
            }}
          >
            {verifying ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-cyan-400/40 border-t-cyan-400 rounded-full animate-spin" />
                Verifying…
              </span>
            ) : (
              'Verify & Enable'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Disable 2FA Modal ────────────────────────────────────────────────────────

function Disable2FAModal({
  onDisable,
  onClose,
}: {
  onDisable: (token: string) => Promise<void>
  onClose: () => void
}) {
  const [token, setToken] = useState('')
  const [disabling, setDisabling] = useState(false)

  async function handleDisable() {
    if (token.length !== 6) {
      toast.error('Please enter a 6-digit code')
      return
    }
    setDisabling(true)
    try {
      await onDisable(token)
    } finally {
      setDisabling(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-sm rounded-2xl p-6"
        style={{
          background: 'rgba(0, 8, 20, 0.95)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          boxShadow: '0 0 40px rgba(239,68,68,0.1), 0 24px 60px rgba(0,0,0,0.6)',
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle size={20} className="text-red-400 flex-shrink-0" />
          <h3 className="text-sm font-bold text-white/90">Disable Two-Factor Authentication</h3>
        </div>
        <p className="text-xs text-white/40 mb-4">
          Enter your current 2FA code to confirm. This will reduce your account security.
        </p>

        <input
          type="text"
          value={token}
          onChange={e => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="6-digit code"
          maxLength={6}
          className="w-full mb-4 bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white/90 placeholder-white/20 outline-none focus:border-red-400/50 transition-all text-sm text-center tracking-[0.3em] nexus-mono"
          autoFocus
          onKeyDown={e => e.key === 'Enter' && handleDisable()}
        />

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-white/40 text-sm hover:border-white/20 transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDisable}
            disabled={disabling || token.length !== 6}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-red-400 transition-all disabled:opacity-40"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)' }}
          >
            {disabling ? 'Disabling…' : 'Disable 2FA'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Checklist Item ───────────────────────────────────────────────────────────

function ChecklistItem({ checked, label, sublabel, href }: {
  checked: boolean
  label: string
  sublabel?: string
  href?: string
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-white/5 last:border-0">
      <div className="flex-shrink-0 mt-0.5">
        {checked ? (
          <CheckCircle size={16} className="text-cyan-400" />
        ) : (
          <div className="w-4 h-4 rounded-full border border-white/20 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-white/10" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm ${checked ? 'text-white/70' : 'text-white/40'}`}>{label}</div>
        {sublabel && <div className="text-xs text-white/25 mt-0.5">{sublabel}</div>}
      </div>
      {href && !checked && (
        <a href={href} className="flex-shrink-0 text-xs text-cyan-400/60 hover:text-cyan-400 transition-colors">
          Set up →
        </a>
      )}
    </div>
  )
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({ title, icon, children }: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div className="flex items-center gap-2.5 mb-4">
        {icon}
        <h2 className="text-sm font-semibold text-white/70 nexus-mono tracking-wider uppercase">{title}</h2>
      </div>
      {children}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SecurityPage() {
  const { data: session } = useSession()

  const [twoFAEnabled, setTwoFAEnabled] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [setup, setSetup] = useState<TwoFASetup | null>(null)
  const [showDisableModal, setShowDisableModal] = useState(false)
  const [googleConnected, setGoogleConnected] = useState(false)

  // Load 2FA status
  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/2fa?status=1')
      const data = await res.json()
      setTwoFAEnabled(data.enabled ?? false)
    } catch {
      // ignore
    } finally {
      setLoadingStatus(false)
    }
  }, [])

  // Detect Google connection from settings
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        // Check if any integration token exists
        setGoogleConnected(!!(data as Record<string, unknown>)?.googleAccessToken)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  // Enable 2FA flow
  async function handleEnable2FA() {
    try {
      const res = await fetch('/api/auth/2fa')
      if (!res.ok) throw new Error()
      const data: TwoFASetup = await res.json()
      setSetup(data)
    } catch {
      toast.error('Failed to initialize 2FA setup')
    }
  }

  async function handleVerify(token: string) {
    if (!setup) return
    const res = await fetch('/api/auth/2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: setup.secret, token }),
    })
    if (res.ok) {
      toast.success('2FA enabled!')
      setTwoFAEnabled(true)
      setSetup(null)
    } else {
      const data = await res.json()
      toast.error(data.error ?? 'Invalid code — please try again')
    }
  }

  async function handleDisable(token: string) {
    const res = await fetch('/api/auth/2fa', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    if (res.ok) {
      toast.success('2FA disabled')
      setTwoFAEnabled(false)
      setShowDisableModal(false)
    } else {
      const data = await res.json()
      toast.error(data.error ?? 'Invalid code — please try again')
    }
  }

  const userAgent =
    typeof navigator !== 'undefined'
      ? navigator.userAgent.slice(0, 60) + (navigator.userAgent.length > 60 ? '…' : '')
      : 'Unknown browser'

  const isCredentials = session?.user && !(session as unknown as Record<string, unknown>)?.googleAccessToken

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#000810' }}>
      <Header title="Security" subtitle="Account security & authentication" />

      <main className="flex-1 p-6 max-w-2xl mx-auto w-full">
        <div className="flex flex-col gap-5">

          {/* ─── Two-Factor Authentication ─────────────────────────────────── */}
          <SectionCard
            title="Two-Factor Authentication"
            icon={<Smartphone size={16} className="text-cyan-400" />}
          >
            {/* Status banner */}
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl mb-4"
              style={{
                background: twoFAEnabled
                  ? 'rgba(0,229,255,0.06)'
                  : 'rgba(239,68,68,0.06)',
                border: `1px solid ${twoFAEnabled ? 'rgba(0,229,255,0.2)' : 'rgba(239,68,68,0.2)'}`,
              }}
            >
              {twoFAEnabled ? (
                <Lock size={16} className="text-cyan-400 flex-shrink-0" />
              ) : (
                <Unlock size={16} className="text-red-400 flex-shrink-0" />
              )}
              <div className="flex-1">
                <div
                  className="text-xs font-bold nexus-mono tracking-wider"
                  style={{ color: twoFAEnabled ? '#00e5ff' : '#f87171' }}
                >
                  2FA {twoFAEnabled ? 'ENABLED' : 'DISABLED'}
                </div>
                <div className="text-xs text-white/35 mt-0.5">
                  {twoFAEnabled
                    ? 'Your account is protected with time-based one-time passwords'
                    : 'Add an extra layer of security to your account'}
                </div>
              </div>
            </div>

            {loadingStatus ? (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
              </div>
            ) : twoFAEnabled ? (
              <button
                type="button"
                onClick={() => setShowDisableModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-red-400 transition-all w-full justify-center"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
              >
                <Unlock size={14} />
                Disable 2FA
              </button>
            ) : (
              <button
                type="button"
                onClick={handleEnable2FA}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all w-full justify-center"
                style={{
                  background: 'rgba(0,229,255,0.1)',
                  color: '#00e5ff',
                  border: '1px solid rgba(0,229,255,0.3)',
                  boxShadow: '0 0 16px rgba(0,229,255,0.08)',
                }}
              >
                <Key size={14} />
                Enable 2FA
              </button>
            )}
          </SectionCard>

          {/* ─── Active Sessions ───────────────────────────────────────────── */}
          <SectionCard
            title="Active Sessions"
            icon={<Shield size={16} className="text-cyan-400" />}
          >
            <div
              className="flex items-start gap-3 p-3 rounded-xl mb-4"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.15)' }}
              >
                <Smartphone size={14} className="text-cyan-400/70" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm text-white/70">Current session</span>
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] nexus-mono font-bold"
                    style={{ background: 'rgba(0,229,255,0.1)', color: '#00e5ff', border: '1px solid rgba(0,229,255,0.2)' }}
                  >
                    THIS DEVICE
                  </span>
                </div>
                <div className="text-xs text-white/30 truncate">{userAgent}</div>
                <div className="text-xs text-white/20 mt-1">
                  {new Date().toLocaleString()}
                </div>
              </div>
            </div>

            <p className="text-xs text-white/25 mb-4">
              Full session management coming in a future update.
            </p>

            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-white/50 transition-all w-full justify-center"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              Sign out all sessions
            </button>
          </SectionCard>

          {/* ─── Security Checklist ────────────────────────────────────────── */}
          <SectionCard
            title="Security Checklist"
            icon={<CheckCircle size={16} className="text-cyan-400" />}
          >
            <ChecklistItem
              checked={!!isCredentials}
              label="Strong password"
              sublabel={isCredentials ? 'Using credentials authentication' : 'Using OAuth provider'}
            />
            <ChecklistItem
              checked={twoFAEnabled}
              label="Two-factor authentication enabled"
              sublabel={twoFAEnabled ? 'TOTP is active' : 'Enable 2FA for stronger security'}
            />
            <ChecklistItem
              checked={googleConnected}
              label="Email connected"
              sublabel={googleConnected ? 'Google account linked' : 'Connect Google to link Gmail'}
            />
            <ChecklistItem
              checked={false}
              label="API keys reviewed"
              sublabel="Review your active API keys"
              href="/plugins"
            />
          </SectionCard>

        </div>
      </main>

      {/* Modals */}
      {setup && (
        <TwoFAModal
          setup={setup}
          onVerify={handleVerify}
          onClose={() => setSetup(null)}
        />
      )}
      {showDisableModal && (
        <Disable2FAModal
          onDisable={handleDisable}
          onClose={() => setShowDisableModal(false)}
        />
      )}
    </div>
  )
}
