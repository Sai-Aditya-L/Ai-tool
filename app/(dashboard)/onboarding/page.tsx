'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ChevronRight, ChevronLeft, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Prefs {
  preferredName: string
  workRole: string
  voiceEnabled: boolean
  memoryEnabled: boolean
  notificationsOn: boolean
  currentMode: string
  timezone: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MODES = [
  { id: 'personal', label: 'Personal', desc: 'Day-to-day life' },
  { id: 'work', label: 'Work', desc: 'Professional tasks' },
  { id: 'research', label: 'Research', desc: 'Deep learning' },
  { id: 'creative', label: 'Creative', desc: 'Artistic projects' },
  { id: 'fitness', label: 'Fitness', desc: 'Health & wellness' },
  { id: 'travel', label: 'Travel', desc: 'Exploration mode' },
  { id: 'finance', label: 'Finance', desc: 'Money & budgets' },
  { id: 'focus', label: 'Focus', desc: 'Deep work mode' },
]

const QUICK_GOALS = [
  { id: 'work', title: 'Stay on top of work tasks', category: 'career' },
  { id: 'coding', title: 'Improve my coding skills', category: 'learning' },
  { id: 'finances', title: 'Track my finances', category: 'financial' },
  { id: 'fitness', title: 'Manage health & fitness', category: 'fitness' },
  { id: 'travel', title: 'Plan travel', category: 'travel' },
  { id: 'learn', title: 'Learn something new', category: 'learning' },
  { id: 'projects', title: 'Personal projects', category: 'project' },
]

const TIPS = [
  'Ask NEXUS anything in the chat',
  'Press Space in voice mode to speak',
  'Say "Hey NEXUS" to activate wake word',
  'Deploy named agents for complex tasks',
  'Check your daily briefing each morning',
]

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({
  value,
  onChange,
  label,
  desc,
}: {
  value: boolean
  onChange: (v: boolean) => void
  label: string
  desc?: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-white/5 last:border-0">
      <div>
        <div className="text-sm text-white/80">{label}</div>
        {desc && <div className="text-xs text-white/35 mt-0.5">{desc}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={cn(
          'relative w-11 h-6 rounded-full border transition-all flex-shrink-0',
          value
            ? 'bg-cyan-400/30 border-cyan-400/50'
            : 'bg-white/5 border-white/15'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 w-5 h-5 rounded-full transition-all',
            value ? 'left-[calc(100%-1.375rem)] bg-cyan-400' : 'left-0.5 bg-white/30'
          )}
        />
      </button>
    </div>
  )
}

// ─── Progress dots ────────────────────────────────────────────────────────────

function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2 justify-center mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'rounded-full transition-all duration-300',
            i === step
              ? 'w-6 h-2 bg-cyan-400'
              : i < step
              ? 'w-2 h-2 bg-cyan-400/50'
              : 'w-2 h-2 bg-white/15'
          )}
        />
      ))}
    </div>
  )
}

// ─── Step 1: Welcome + Name ───────────────────────────────────────────────────

function Step1({
  prefs,
  onChange,
}: {
  prefs: Prefs
  onChange: (p: Partial<Prefs>) => void
}) {
  return (
    <div className="flex flex-col items-center gap-6">
      {/* Logo orb */}
      <div className="relative">
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center"
          style={{
            background: 'radial-gradient(circle, rgba(0,229,255,0.25) 0%, rgba(0,229,255,0.05) 60%, transparent 100%)',
            border: '1px solid rgba(0,229,255,0.3)',
            boxShadow: '0 0 60px rgba(0,229,255,0.2), inset 0 0 30px rgba(0,229,255,0.08)',
          }}
        >
          <span
            className="text-2xl font-bold nexus-mono"
            style={{ color: '#00e5ff', letterSpacing: '0.15em', textShadow: '0 0 20px #00e5ff' }}
          >
            NX
          </span>
        </div>
        {/* Pulsing ring */}
        <div
          className="absolute inset-0 rounded-full animate-ping opacity-10"
          style={{ border: '2px solid #00e5ff', animationDuration: '3s' }}
        />
      </div>

      <div className="text-center">
        <h1 className="text-3xl font-bold hud-text-cyan" style={{ letterSpacing: '0.08em' }}>
          Welcome to NEXUS
        </h1>
        <p className="text-white/40 text-sm mt-2">Your personal AI operating system</p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-4 mt-2">
        <div>
          <label className="text-xs text-white/40 mb-1.5 block">What should I call you?</label>
          <input
            type="text"
            value={prefs.preferredName}
            onChange={e => onChange({ preferredName: e.target.value })}
            placeholder="Your name"
            className="w-full bg-white/5 border border-cyan-400/20 rounded-xl px-4 py-3 text-white/90 placeholder-white/20 outline-none focus:border-cyan-400/50 transition-all text-sm"
            autoFocus
          />
        </div>
        <div>
          <label className="text-xs text-white/40 mb-1.5 block">
            What is your work role?{' '}
            <span className="text-white/25">(optional)</span>
          </label>
          <input
            type="text"
            value={prefs.workRole}
            onChange={e => onChange({ workRole: e.target.value })}
            placeholder="e.g. Software Engineer, Designer…"
            className="w-full bg-white/5 border border-cyan-400/20 rounded-xl px-4 py-3 text-white/90 placeholder-white/20 outline-none focus:border-cyan-400/50 transition-all text-sm"
          />
        </div>
      </div>
    </div>
  )
}

// ─── Step 2: Preferences ──────────────────────────────────────────────────────

function Step2({
  prefs,
  onChange,
}: {
  prefs: Prefs
  onChange: (p: Partial<Prefs>) => void
}) {
  return (
    <div className="flex flex-col gap-6 w-full max-w-sm mx-auto">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white/90">How do you want NEXUS to work?</h2>
        <p className="text-white/35 text-sm mt-1">Configure your experience</p>
      </div>

      {/* Toggles */}
      <div className="hud-stat-card rounded-xl px-5 py-2">
        <Toggle
          value={prefs.voiceEnabled}
          onChange={v => onChange({ voiceEnabled: v })}
          label="Voice responses"
          desc="Enable text-to-speech for NEXUS replies"
        />
        <Toggle
          value={prefs.memoryEnabled}
          onChange={v => onChange({ memoryEnabled: v })}
          label="Proactive memory"
          desc="NEXUS remembers context across sessions"
        />
        <Toggle
          value={prefs.notificationsOn}
          onChange={v => onChange({ notificationsOn: v })}
          label="Browser notifications"
          desc="Get alerts for reminders and updates"
        />
      </div>

      {/* Mode selector */}
      <div>
        <label className="text-xs text-white/40 mb-2 block">Starting mode</label>
        <div className="grid grid-cols-4 gap-2">
          {MODES.map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange({ currentMode: m.id })}
              className={cn(
                'flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border text-center transition-all',
                prefs.currentMode === m.id
                  ? 'bg-cyan-400/15 border-cyan-400/40 text-cyan-400'
                  : 'bg-white/3 border-white/8 text-white/40 hover:border-white/20 hover:text-white/60'
              )}
            >
              <span className="text-[11px] font-semibold">{m.label}</span>
              <span className="text-[9px] opacity-60 leading-none">{m.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Timezone */}
      <div>
        <label className="text-xs text-white/40 mb-1.5 block">Timezone</label>
        <input
          type="text"
          value={prefs.timezone}
          onChange={e => onChange({ timezone: e.target.value })}
          placeholder="e.g. America/New_York"
          className="w-full bg-white/5 border border-cyan-400/20 rounded-xl px-4 py-2.5 text-white/80 placeholder-white/20 outline-none focus:border-cyan-400/50 transition-all text-sm"
        />
      </div>
    </div>
  )
}

// ─── Step 3: Quick Goals ──────────────────────────────────────────────────────

function Step3({
  selected,
  onToggle,
  onSkip,
}: {
  selected: Set<string>
  onToggle: (id: string) => void
  onSkip: () => void
}) {
  return (
    <div className="flex flex-col gap-5 w-full max-w-sm mx-auto">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white/90">What are your main goals right now?</h2>
        <p className="text-white/35 text-sm mt-1">Select any that apply — you can always change these later</p>
      </div>

      <div className="flex flex-col gap-2">
        {QUICK_GOALS.map(goal => {
          const checked = selected.has(goal.id)
          return (
            <button
              key={goal.id}
              type="button"
              onClick={() => onToggle(goal.id)}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all',
                checked
                  ? 'bg-cyan-400/10 border-cyan-400/35 text-white/90'
                  : 'bg-white/3 border-white/8 text-white/50 hover:border-white/20 hover:text-white/70'
              )}
            >
              <div
                className={cn(
                  'w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all',
                  checked
                    ? 'bg-cyan-400/25 border-cyan-400/60'
                    : 'border-white/20'
                )}
              >
                {checked && <Check size={11} className="text-cyan-400" />}
              </div>
              <span className="text-sm">{goal.title}</span>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={onSkip}
        className="text-xs text-white/30 hover:text-white/50 transition-colors text-center"
      >
        Skip this step →
      </button>
    </div>
  )
}

// ─── Step 4: Ready ────────────────────────────────────────────────────────────

function Step4({ preferredName }: { preferredName: string }) {
  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-sm mx-auto text-center">
      {/* Success orb */}
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center"
        style={{
          background: 'radial-gradient(circle, rgba(0,229,255,0.3) 0%, rgba(0,229,255,0.05) 70%, transparent 100%)',
          border: '1px solid rgba(0,229,255,0.4)',
          boxShadow: '0 0 50px rgba(0,229,255,0.25)',
        }}
      >
        <Check size={32} className="text-cyan-400" />
      </div>

      <div>
        <h2 className="text-2xl font-bold hud-text-cyan" style={{ letterSpacing: '0.05em' }}>
          NEXUS is ready
          {preferredName ? `, ${preferredName}` : ''}
        </h2>
        <p className="text-white/40 text-sm mt-2">Your AI operating system is configured and ready to go.</p>
      </div>

      {/* Tips */}
      <div className="w-full hud-stat-card rounded-xl p-4 text-left">
        <div className="text-xs font-semibold text-white/40 mb-3 nexus-mono uppercase tracking-wider">
          Quick tips
        </div>
        <div className="flex flex-col gap-2.5">
          {TIPS.map((tip, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-cyan-400/15 border border-cyan-400/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[9px] text-cyan-400 font-bold">{i + 1}</span>
              </div>
              <span className="text-xs text-white/60 leading-snug">{tip}</span>
            </div>
          ))}
        </div>
      </div>
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

  const [prefs, setPrefs] = useState<Prefs>({
    preferredName: '',
    workRole: '',
    voiceEnabled: true,
    memoryEnabled: true,
    notificationsOn: true,
    currentMode: 'personal',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  })
  const [selectedGoals, setSelectedGoals] = useState<Set<string>>(new Set())

  // Check if onboarding already done
  useEffect(() => {
    if (sessionStatus === 'loading') return
    if (!session) {
      router.replace('/login')
      return
    }

    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        if (data.preferences?.onboardingDone) {
          router.replace('/dashboard')
        } else {
          setCheckingDone(false)
          if (data.preferences?.preferredName) {
            setPrefs(prev => ({
              ...prev,
              preferredName: data.preferences.preferredName || '',
              workRole: data.preferences.workRole || '',
              voiceEnabled: data.preferences.voiceEnabled ?? true,
              memoryEnabled: data.preferences.memoryEnabled ?? true,
              notificationsOn: data.preferences.notificationsOn ?? true,
              currentMode: data.preferences.currentMode || 'personal',
              timezone: data.preferences.timezone || prev.timezone,
            }))
          } else {
            setCheckingDone(false)
          }
        }
      })
      .catch(() => setCheckingDone(false))
  }, [session, sessionStatus, router])

  function updatePrefs(partial: Partial<Prefs>) {
    setPrefs(prev => ({ ...prev, ...partial }))
  }

  function toggleGoal(id: string) {
    setSelectedGoals(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleFinishStep3(skip = false) {
    // Create selected goals
    if (!skip && selectedGoals.size > 0) {
      const goalItems = QUICK_GOALS.filter(g => selectedGoals.has(g.id))
      for (const g of goalItems) {
        await fetch('/api/goals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: g.title, category: g.category }),
        })
      }
    }
    setStep(3)
  }

  async function handleComplete() {
    if (submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferredName: prefs.preferredName || 'User',
          workRole: prefs.workRole || undefined,
          timezone: prefs.timezone,
          currentMode: prefs.currentMode,
          notificationsOn: prefs.notificationsOn,
          voiceEnabled: prefs.voiceEnabled,
          memoryEnabled: prefs.memoryEnabled,
        }),
      })

      if (!res.ok) throw new Error()
      router.replace('/dashboard')
    } catch {
      toast.error('Failed to save preferences. Please try again.')
      setSubmitting(false)
    }
  }

  // Continue from step 0→1→2 saves prefs on step 3 completion
  async function handleNext() {
    if (step === 0) {
      if (!prefs.preferredName.trim()) {
        toast.error('Please enter your name')
        return
      }
      setStep(1)
    } else if (step === 1) {
      setStep(2)
    } else if (step === 2) {
      await handleFinishStep3(false)
    } else if (step === 3) {
      await handleComplete()
    }
  }

  if (checkingDone || sessionStatus === 'loading') {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#000810' }}>
        <div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
      </div>
    )
  }

  const isLastStep = step === 3

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center px-4"
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
        className="relative z-10 w-full max-w-md"
        style={{
          background: 'rgba(0, 8, 20, 0.85)',
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

        {/* Step dots */}
        <StepDots step={step} total={4} />

        {/* Step content */}
        <div className="min-h-[320px] flex flex-col justify-center">
          {step === 0 && <Step1 prefs={prefs} onChange={updatePrefs} />}
          {step === 1 && <Step2 prefs={prefs} onChange={updatePrefs} />}
          {step === 2 && (
            <Step3
              selected={selectedGoals}
              onToggle={toggleGoal}
              onSkip={() => handleFinishStep3(true)}
            />
          )}
          {step === 3 && <Step4 preferredName={prefs.preferredName} />}
        </div>

        {/* Navigation */}
        <div className={cn('flex gap-3 mt-8', step > 0 ? 'justify-between' : 'justify-end')}>
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(s => s - 1)}
              disabled={submitting}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/10 text-white/40 text-sm hover:text-white/70 hover:border-white/20 transition-all disabled:opacity-30"
            >
              <ChevronLeft size={14} />
              Back
            </button>
          )}

          <button
            type="button"
            onClick={handleNext}
            disabled={submitting}
            className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-cyan-400/20 text-cyan-400 border border-cyan-400/35 text-sm font-semibold hover:bg-cyan-400/30 transition-all disabled:opacity-40 ml-auto"
            style={{ boxShadow: '0 0 20px rgba(0,229,255,0.1)' }}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-cyan-400/40 border-t-cyan-400 rounded-full animate-spin" />
                Setting up…
              </span>
            ) : isLastStep ? (
              <>
                Enter NEXUS
                <ChevronRight size={14} />
              </>
            ) : (
              <>
                Continue
                <ChevronRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* NEXUS label */}
      <div className="relative z-10 mt-6 text-white/15 text-xs nexus-mono tracking-[0.2em]">
        NEXUS · PERSONAL AI OS
      </div>
    </div>
  )
}
