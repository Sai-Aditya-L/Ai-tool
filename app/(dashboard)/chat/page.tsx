import { Metadata } from 'next'
import { Suspense } from 'react'
import { Header } from '@/components/layout/header'
import { ChatInterface } from '@/components/chat/chat-interface'

export const metadata: Metadata = { title: 'AI Chat | NEXUS' }

export default function ChatPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="AI Chat" subtitle="Neural link active — NEXUS ready" />
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={null}>
          <ChatInterface />
        </Suspense>
      </div>
    </div>
  )
}
