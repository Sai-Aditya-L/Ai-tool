import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  return (
    <div className="flex h-screen bg-nexus-darker overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 nexus-grid-bg opacity-20 pointer-events-none" />
      <div className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 20% 50%, rgba(0,212,255,0.03) 0%, transparent 60%), radial-gradient(ellipse at 80% 50%, rgba(124,58,237,0.03) 0%, transparent 60%)',
        }}
      />

      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden relative z-10">
        {children}
      </main>
    </div>
  )
}
