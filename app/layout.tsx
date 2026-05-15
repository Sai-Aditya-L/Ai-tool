import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/components/providers/auth-provider'
import { ToastProvider } from '@/components/providers/toast-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'NEXUS — Neural EXtended Universal System',
    template: '%s | NEXUS',
  },
  description: 'Your AI-powered personal operating system. Manage your life, work, and digital ecosystem with unprecedented intelligence.',
  keywords: ['AI assistant', 'personal OS', 'productivity', 'task management', 'AI automation'],
  authors: [{ name: 'NEXUS AI' }],
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    type: 'website',
    title: 'NEXUS — Neural EXtended Universal System',
    description: 'Your AI-powered personal operating system',
    siteName: 'NEXUS',
  },
}

export const viewport: Viewport = {
  themeColor: '#050510',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${inter.className} bg-nexus-darker text-white antialiased`}>
        <AuthProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
