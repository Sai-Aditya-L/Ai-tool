'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/layout/header'
import {
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Bot,
  Brain,
  Zap,
  Link,
  Star,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormState {
  displayName: string
  personality: string
  timezone: string
  taskTitle: string
  taskPriority: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PERSONALITIES = [
  { id: 'professional', label: 'Professional', desc: 'Formal, precise, business-focused', icon: '💼' },
  { id: 'friendly', label: 'Friendly', desc: 'Warm, casual, approachable', icon: '😊' },
  { id: 'concise', label: 'Concise', desc: 'Brief, to-the-point, no fluff', icon: '⚡' },
  { id: 'detailed', label: 'Detailed', desc: 'Thorough, comprehensive, explanatory', icon: '📚' },
  { id: 'socratic', label: 'Socratic', desc: 'Asks questions, guides discovery', icon: '🤔' },
]

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
]

const SETUP_ITEMS = [
  'Personalize your AI assistant',
  'Connect your tools and services',
  'Create your first task',
  'Configure security settings',
]

// ─── Progress Bar ──────────────────────────────────────────────────────────────

function ProgressBar({ step, total }: { step: number; total: number }) {
  const pct = Math.round(((step + 1) / total) * 100)
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-white/30 nexus-mono tracking-wider">
          STEP {step + 1} OF {total}
        </span>
        <span className="text-xs text-cyan-400/60 nexus-mono">{pct}%</span>
      </div>
      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, rgba(0,229,255,0.6) 0%, rgba(0,229,255,0.9) 100%)',
            boxShadow: '0 0 8px rgba(0,229,255,0.4)',
          }}
        />
      </div>
      <div className="flex items-center justify-center gap-2 mt-3">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === step ? '1.5rem' : '0.5rem',
              height: '0.5rem',
              background:
                i === step
                  ? 'rgba(0,229,255,0.9)'
                  : i < step
                  ? 'rgba(0,229,255,0.4)'
                  : 'rgba(255,255,255,0.1)',
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Step 1: Welcome ───────────────────────────────────────────────────────────

function StepWelcome() {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      {/* Logo */}
      <div className="relative">
        <div
          className="w-28 h-28 rounded-full flex items-center justify-center"
          style={{
            background:
              'radial-gradient(circle, rgba(0,229,255,0.25) 0%, rgba(0,229,255,0.05) 60%, transparent 100%)',
            border: '1px solid rgba(0,229,255,0.3)',
            boxShadow: '0 0 60px rgba(0,229,255,0.2), inset 0 0 30px rgba(0,229,255,0.08)',
          }}
        >
          <Bot size={44} className="text-cyan-400" style={{ filter: 'drop-shadow(0 0 12px rgba(0,229,255,0.6))' }} />
        </div>
        <div
          className="absolute inset-0 rounded-full animate-ping opacity-10"
          style={{ border: '2px solid #00e5ff', animationDuration: '3s' }}
        />
      </div>

      <div>
        <h1 className="text-3xl font-bold text-cyan-400" style={{ letterSpacing: '0.08em', textShadow: '0 0 20px rgba(0,229,255,0.4)' }}>
          Welcome to NEXUS
        </h1>
        <p className="text-white/50 text-sm mt-2">
          Your neural AI operating system. Let's get you set up.
        </p>
      </div>

      <div className="w-full max-w-xs text-left">
        <p className="text-xs text-white/30 mb-3 nexus-mono tracking-wider">WHAT YOU'LL SET UP:</p>
        <div className="flex flex-col gap-2.5">
          {SETUP_ITEMS.map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <CheckCircle size={15} className="text-cyan-400 flex-shrink-0" style={{ filter: 'drop-shadow(0 0 6px rgba(0,229,255,0.5))' }} />
              <span className="text-sm text-white/60">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Step 2: Personalize ───────────────────────────────────────────────────────

function StepPersonalize({
  form,
  onChange,
}: {
  form: FormState
  onChange: (p: Partial<FormState>) => void
}) {
  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white/90">Personalize NEXUS</h2>
        <p className="text-white/35 text-sm mt-1">Make it yours</p>
      </div>

      {/* Display name */}
      <div>
        <label className="text-xs text-white/40 mb-1.5 block">What should NEXUS call you?</label>
        <input
          type="text"
          value={form.displayName}
          onChange={e => onChange({ displayName: e.target.value })}
          placeholder="Your name"
          className="w-full bg-white/5 border border-cyan-400/20 rounded-xl px-4 py-3 text-white/90 placeholder-white/20 outline-none focus:border-cyan-400/50 transition-all text-sm"
          autoFocus
        />
      </div>

      {/* Personality */}
      <div>
        <label className="text-xs text-white/40 mb-2 block">Choose your AI Personality</label>
        <div className="flex flex-col gap-2">
          {PERSONALITIES.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange({ personality: p.id })}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all"
              style={{
                background:
                  form.personality === p.id
                    ? 'rgba(0,229,255,0.08)'
                    : 'rgba(255,255,255,0.02)',
                borderColor:
                  form.personality === p.id
                    ? 'rgba(0,229,255,0.4)'
                    : 'rgba(255,255,255,0.08)',
              }}
            >
              <span className="text-lg">{p.icon}</span>
              <div>
                <div className="text-sm font-semibold text-white/80">{p.label}</div>
                <div className="text-xs text-white/35">{p.desc}</div>
              </div>
              {form.personality === p.id && (
                <CheckCircle size={15} className="text-cyan-400 ml-auto flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Timezone */}
      <div>
        <label className="text-xs text-white/40 mb-1.5 block">Your timezone</label>
        <select
          value={form.timezone}
          onChange={e => onChange({ timezone: e.target.value })}
          className="w-full bg-white/5 border border-cyan-400/20 rounded-xl px-4 py-3 text-white/80 outline-none focus:border-cyan-400/50 transition-all text-sm appearance-none"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        >
          {TIMEZONES.map(tz => (
            <option key={tz} value={tz} style={{ background: '#000d1a' }}>
              {tz}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

// ─── Step 3: Connect Services ──────────────────────────────────────────────────

function StepConnect({ session }: { session: ReturnType<typeof useSession>['data'] }) {
  const googleConnected = !!(session as Record<string, unknown> | null)?.googleAccessToken
  const githubConnected = !!(session as Record<string, unknown> | null)?.githubAccessToken

  const integrations = [
    {
      id: 'google',
      label: 'Google',
      desc: 'Connects Gmail + Calendar',
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
      ),
      connected: googleConnected,
      href: '/api/integrations/google/auth',
    },
    {
      id: 'github',
      label: 'GitHub',
      desc: 'Connects repositories + code review',
      icon: (
        <svg className="w-6 h-6 text-white/70" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
        </svg>
      ),
      connected: githubConnected,
      href: '/api/integrations/github/auth',
    },
  ]

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white/90">Connect your tools</h2>
        <p className="text-white/35 text-sm mt-1">Integrations can be added later from Settings</p>
      </div>

      <div className="flex flex-col gap-3">
        {integrations.map(integration => (
          <div
            key={integration.id}
            className="flex items-center gap-4 p-4 rounded-xl border"
            style={{
              background: 'rgba(255,255,255,0.02)',
              borderColor: integration.connected
                ? 'rgba(0,229,255,0.3)'
                : 'rgba(255,255,255,0.08)',
            }}
          >
            <div className="flex-shrink-0">{integration.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white/80">{integration.label}</div>
              <div className="text-xs text-white/35">{integration.desc}</div>
            </div>
            {integration.connected ? (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <CheckCircle size={14} className="text-cyan-400" />
                <span className="text-xs text-cyan-400">Connected</span>
              </div>
            ) : (
              <a
                href={integration.href}
                className="flex-shrink-0 px-3 py-1.5 rounded-lg border border-white/15 text-white/50 text-xs hover:border-white/30 hover:text-white/70 transition-all"
              >
                Connect
              </a>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-white/25 text-center">
        You can skip these and connect later
      </p>
    </div>
  )
}

// ─── Step 4: First Task ────────────────────────────────────────────────────────

function StepFirstTask({
  form,
  onChange,
  onSkip,
}: {
  form: FormState
  onChange: (p: Partial<FormState>) => void
  onSkip: () => void
}) {
  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white/90">Create your first task</h2>
        <p className="text-white/35 text-sm mt-1">Get started with something on your mind</p>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <label className="text-xs text-white/40 mb-1.5 block">Task title</label>
          <input
            type="text"
            value={form.taskTitle}
            onChange={e => onChange({ taskTitle: e.target.value })}
            placeholder="What do you need to get done?"
            className="w-full bg-white/5 border border-cyan-400/20 rounded-xl px-4 py-3 text-white/90 placeholder-white/20 outline-none focus:border-cyan-400/50 transition-all text-sm"
            autoFocus
          />
        </div>

        <div>
          <label className="text-xs text-white/40 mb-1.5 block">Priority</label>
          <select
            value={form.taskPriority}
            onChange={e => onChange({ taskPriority: e.target.value })}
            className="w-full border border-cyan-400/20 rounded-xl px-4 py-3 text-white/80 outline-none focus:border-cyan-400/50 transition-all text-sm appearance-none"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            <option value="low" style={{ background: '#000d1a' }}>Low</option>
            <option value="medium" style={{ background: '#000d1a' }}>Medium</option>
            <option value="high" style={{ background: '#000d1a' }}>High</option>
            <option value="urgent" style={{ background: '#000d1a' }}>Urgent</option>
          </select>
        </div>
      </div>

      <button
        type="button"
        onClick={onSkip}
        className="text-xs text-white/30 hover:text-white/50 transition-colors text-center"
      >
        Skip for now →
      </button>
    </div>
  )
}

// ─── Step 5: Done ─────────────────────────────────────────────────────────────

function StepDone({ form, googleConnected, githubConnected }: {
  form: FormState
  googleConnected: boolean
  githubConnected: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      {/* Animated checkmark */}
      <div className="relative">
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center"
          style={{
            background:
              'radial-gradient(circle, rgba(0,229,255,0.3) 0%, rgba(0,229,255,0.05) 70%, transparent 100%)',
            border: '1px solid rgba(0,229,255,0.4)',
            boxShadow: '0 0 50px rgba(0,229,255,0.3)',
          }}
        >
          <CheckCircle
            size={40}
            className="text-cyan-400"
            style={{ filter: 'drop-shadow(0 0 12px rgba(0,229,255,0.8))' }}
          />
        </div>
        <div
          className="absolute inset-0 rounded-full animate-ping opacity-15"
          style={{ border: '2px solid #00e5ff', animationDuration: '2s' }}
        />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-cyan-400" style={{ letterSpacing: '0.05em', textShadow: '0 0 20px rgba(0,229,255,0.4)' }}>
          NEXUS is ready
          {form.displayName ? `, ${form.displayName}` : ''}
        </h2>
        <p className="text-white/40 text-sm mt-2">
          Your AI operating system is configured and online.
        </p>
      </div>

      {/* Summary */}
      <div
        className="w-full text-left rounded-xl p-4"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="text-xs text-white/30 mb-3 nexus-mono tracking-wider">SETUP SUMMARY</div>
        <div className="flex flex-col gap-2.5">
          <SummaryRow
            icon={<Star size={13} className="text-cyan-400" />}
            label="Personality"
            value={PERSONALITIES.find(p => p.id === form.personality)?.label ?? 'Professional'}
          />
          <SummaryRow
            icon={<Zap size={13} className="text-cyan-400" />}
            label="Timezone"
            value={form.timezone}
          />
          <SummaryRow
            icon={<Link size={13} className="text-cyan-400" />}
            label="Google"
            value={googleConnected ? 'Connected' : 'Not connected'}
          />
          <SummaryRow
            icon={<Link size={13} className="text-cyan-400" />}
            label="GitHub"
            value={githubConnected ? 'Connected' : 'Not connected'}
          />
          {form.taskTitle && (
            <SummaryRow
              icon={<Brain size={13} className="text-cyan-400" />}
              label="First task"
              value={form.taskTitle}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      {icon}
      <span className="text-xs text-white/40">{label}:</span>
      <span className="text-xs text-white/70 ml-auto truncate max-w-[140px]">{value}</span>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const { data: session, status: sessionStatus } = useSession()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [checkingDone, setCheckingDone] = useState(true)
  const [skippedTask, setSkippedTask] = useState(false)

  const [form, setForm] = useState<FormState>({
    displayName: '',
    personality: 'professional',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    taskTitle: '',
    taskPriority: 'medium',
  })

  function updateForm(partial: Partial<FormState>) {
    setForm(prev => ({ ...prev, ...partial }))
  }

  // Pre-fill from session
  useEffect(() => {
    if (session?.user?.name) {
      setForm(prev => ({ ...prev, displayName: prev.displayName || session.user?.name || '' }))
    }
  }, [session])

  // Check if onboarding already done
  useEffect(() => {
    if (sessionStatus === 'loading') return
    if (!session) {
      router.replace('/login')
      return
    }
    fetch('/api/onboarding')
      .then(r => r.json())
      .then(data => {
        if (data.completed) {
          router.replace('/dashboard')
        } else {
          setCheckingDone(false)
        }
      })
      .catch(() => setCheckingDone(false))
  }, [session, sessionStatus, router])

  const googleConnected = !!(session as Record<string, unknown> | null)?.googleAccessToken
  const githubConnected = !!(session as Record<string, unknown> | null)?.githubAccessToken

  const TOTAL_STEPS = 5

  async function handleNext() {
    if (step === 0) {
      // Welcome → Personalize
      setStep(1)
    } else if (step === 1) {
      // Personalize → Connect — save preferences
      if (!form.displayName.trim()) {
        toast.error('Please enter your name')
        return
      }
      try {
        await fetch('/api/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assistantName: 'NEXUS',
            personalityMode: form.personality,
            timezone: form.timezone,
          }),
        })
      } catch {
        // Non-blocking
      }
      setStep(2)
    } else if (step === 2) {
      // Connect → First Task
      setStep(3)
    } else if (step === 3) {
      // First Task → Done — create task if provided
      if (!skippedTask && form.taskTitle.trim()) {
        try {
          await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: form.taskTitle.trim(),
              priority: form.taskPriority,
            }),
          })
        } catch {
          // Non-blocking
        }
      }
      setStep(4)
    } else if (step === 4) {
      // Done → Dashboard
      if (submitting) return
      setSubmitting(true)
      try {
        await fetch('/api/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ completed: true }),
        })
      } catch {
        // Non-blocking
      }
      router.push('/dashboard')
    }
  }

  function handleSkipTask() {
    setSkippedTask(true)
    setStep(4)
  }

  if (checkingDone || sessionStatus === 'loading') {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#000810' }}>
        <div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
      </div>
    )
  }

  const isLastStep = step === TOTAL_STEPS - 1

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center px-4 overflow-y-auto py-8"
      style={{
        background: '#000810',
        backgroundImage: [
          'radial-gradient(ellipse at 20% 30%, rgba(0,229,255,0.05) 0%, transparent 50%)',
          'radial-gradient(ellipse at 80% 70%, rgba(123,97,255,0.04) 0%, transparent 50%)',
        ].join(', '),
      }}
    >
      {/* Holographic grid */}
      <div className="fixed inset-0 hud-grid opacity-60 pointer-events-none" />

      {/* Scanlines */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.05) 3px, rgba(0,0,0,0.05) 4px)',
        }}
      />

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-lg my-auto"
        style={{
          background: 'rgba(0, 8, 20, 0.88)',
          border: '1px solid rgba(0, 229, 255, 0.15)',
          borderRadius: '1.5rem',
          padding: '2.5rem',
          boxShadow: '0 0 80px rgba(0,229,255,0.07), 0 24px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Corner accents */}
        <div
          className="absolute top-0 left-0 w-8 h-8 pointer-events-none"
          style={{
            borderTop: '2px solid rgba(0,229,255,0.5)',
            borderLeft: '2px solid rgba(0,229,255,0.5)',
            borderRadius: '1.5rem 0 0 0',
          }}
        />
        <div
          className="absolute bottom-0 right-0 w-8 h-8 pointer-events-none"
          style={{
            borderBottom: '2px solid rgba(0,229,255,0.5)',
            borderRight: '2px solid rgba(0,229,255,0.5)',
            borderRadius: '0 0 1.5rem 0',
          }}
        />

        {/* Progress */}
        <ProgressBar step={step} total={TOTAL_STEPS} />

        {/* Step content */}
        <div className="min-h-[340px] flex flex-col justify-center">
          {step === 0 && <StepWelcome />}
          {step === 1 && <StepPersonalize form={form} onChange={updateForm} />}
          {step === 2 && <StepConnect session={session} />}
          {step === 3 && (
            <StepFirstTask form={form} onChange={updateForm} onSkip={handleSkipTask} />
          )}
          {step === 4 && (
            <StepDone
              form={form}
              googleConnected={googleConnected}
              githubConnected={githubConnected}
            />
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-3 mt-8" style={{ justifyContent: step > 0 ? 'space-between' : 'flex-end' }}>
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(s => s - 1)}
              disabled={submitting}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/10 text-white/40 text-sm hover:text-white/70 hover:border-white/20 transition-all disabled:opacity-30"
            >
              <ArrowLeft size={14} />
              Back
            </button>
          )}

          <button
            type="button"
            onClick={handleNext}
            disabled={submitting}
            className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
            style={{
              background: 'rgba(0,229,255,0.15)',
              color: '#00e5ff',
              border: '1px solid rgba(0,229,255,0.35)',
              boxShadow: '0 0 20px rgba(0,229,255,0.1)',
            }}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-cyan-400/40 border-t-cyan-400 rounded-full animate-spin" />
                Loading…
              </span>
            ) : isLastStep ? (
              <>
                Open Dashboard
                <ArrowRight size={14} />
              </>
            ) : step === 0 ? (
              <>
                Get Started
                <ArrowRight size={14} />
              </>
            ) : step === 3 && form.taskTitle.trim() ? (
              <>
                Create Task
                <ArrowRight size={14} />
              </>
            ) : (
              <>
                Continue
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Label */}
      <div className="relative z-10 mt-6 text-white/15 text-xs nexus-mono tracking-[0.2em]">
        NEXUS · PERSONAL AI OS
      </div>
    </div>
  )
}
