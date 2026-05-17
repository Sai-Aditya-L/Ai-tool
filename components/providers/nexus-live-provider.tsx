'use client'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'

interface AgentRunInfo {
  id: string
  status: string
  task: string
  output?: string | null
}

interface LiveNotification {
  id: string
  title: string
  body: string
  type: string
  link?: string | null
  createdAt: string
}

interface ActiveFocusSession {
  id: string
  taskTitle?: string | null
  plannedMins: number
  createdAt: string
  type: string
}

interface NexusLiveState {
  unreadCount: number
  activeRun: AgentRunInfo | null
  activeFocus: ActiveFocusSession | null
  latestNotification: LiveNotification | null
  connected: boolean
}

const NexusLiveContext = createContext<NexusLiveState>({
  unreadCount: 0,
  activeRun: null,
  activeFocus: null,
  latestNotification: null,
  connected: false,
})

export function useNexusLive() {
  return useContext(NexusLiveContext)
}

export function NexusLiveProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const [state, setState] = useState<NexusLiveState>({
    unreadCount: 0,
    activeRun: null,
    activeFocus: null,
    latestNotification: null,
    connected: false,
  })
  const esRef = useRef<EventSource | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCount = useRef(0)

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) return

    function connect() {
      if (esRef.current) { esRef.current.close(); esRef.current = null }

      const es = new EventSource('/api/events/stream')
      esRef.current = es

      es.onopen = () => {
        retryCount.current = 0
        setState(s => ({ ...s, connected: true }))
      }

      es.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'init') {
            setState(s => ({
              ...s,
              unreadCount: msg.unreadCount ?? 0,
              activeRun: msg.activeRun ?? null,
              activeFocus: msg.activeFocus ?? null,
            }))
          } else if (msg.type === 'notification') {
            const notif = msg.notification
            setState(s => ({
              ...s,
              unreadCount: msg.unreadCount ?? s.unreadCount,
              latestNotification: notif,
            }))
            const icon = notif.type === 'alert' ? '⚠️' : notif.type === 'proactive_alert' ? '🛡️' : '🔔'
            toast(`${icon} ${notif.title}`, { duration: 5000, id: notif.id })
          } else if (msg.type === 'agent_run') {
            const run = msg.run
            setState(s => ({ ...s, activeRun: run }))
            if (run.status === 'completed') {
              toast.success(`Agent task complete: ${run.task.slice(0, 50)}`, { duration: 4000 })
            } else if (run.status === 'failed') {
              toast.error(`Agent task failed: ${run.task.slice(0, 50)}`, { duration: 4000 })
            }
          } else if (msg.type === 'agent_status') {
            setState(s => ({ ...s, activeRun: msg.run }))
          }
        } catch {}
      }

      es.onerror = () => {
        es.close()
        esRef.current = null
        setState(s => ({ ...s, connected: false }))
        const delay = Math.min(3000 * Math.pow(2, retryCount.current), 30000)
        retryCount.current++
        retryRef.current = setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      if (esRef.current) { esRef.current.close(); esRef.current = null }
      if (retryRef.current) clearTimeout(retryRef.current)
    }
  }, [status, session?.user?.email])

  return (
    <NexusLiveContext.Provider value={state}>
      {children}
    </NexusLiveContext.Provider>
  )
}
