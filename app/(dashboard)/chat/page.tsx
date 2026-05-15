import { Header } from '@/components/layout/header'
import { ChatInterface } from '@/components/chat/chat-interface'

export default function ChatPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="AI Chat" subtitle="Neural link active — NEXUS ready" />
      <div className="flex-1 overflow-hidden">
        <ChatInterface />
      </div>
    </div>
  )
}
