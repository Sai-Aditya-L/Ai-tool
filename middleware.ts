import { getToken } from 'next-auth/jwt'
import { NextRequest, NextResponse } from 'next/server'

// Routes that require authentication
const PROTECTED_PREFIXES = ['/dashboard', '/chat', '/tasks', '/reminders', '/calendar',
  '/notes', '/memory', '/files', '/emails', '/agents', '/automations', '/settings',
  '/activity', '/integrations', '/connected-devices', '/notifications', '/voice',
  '/daily-summaries', '/goals', '/habits', '/trackers', '/travel', '/research',
  '/cybersecurity', '/knowledge-graph', '/trust-center', '/system', '/dev', '/media',
  '/home-control', '/market', '/news', '/tools', '/alerts', '/onboarding',
  '/simulate', '/computer-control', '/visual', '/plugins', '/observability', '/usage',
  '/mobile', '/workspaces',
]

// API routes that require authentication (prefix match)
const PROTECTED_API_PREFIXES = ['/api/tasks', '/api/notes', '/api/reminders', '/api/memory',
  '/api/chat', '/api/agents', '/api/calendar', '/api/emails', '/api/files', '/api/automations',
  '/api/dashboard', '/api/goals', '/api/habits', '/api/trackers', '/api/mode',
  '/api/world-state', '/api/system-health', '/api/export', '/api/history', '/api/simulate',
  '/api/computer-control', '/api/visual', '/api/plugins', '/api/webhooks', '/api/api-keys',
  '/api/agent-templates', '/api/workflow-templates', '/api/workspaces', '/api/knowledge-graph',
  '/api/usage', '/api/trust-center', '/api/alerts',
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Check if route needs protection
  const needsAuth =
    PROTECTED_PREFIXES.some(p => pathname.startsWith(p)) ||
    PROTECTED_API_PREFIXES.some(p => pathname.startsWith(p))

  if (!needsAuth) return NextResponse.next()

  // Validate JWT token
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

  if (!token) {
    // API routes: return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // Page routes: redirect to login
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Add security headers to all responses
  const response = NextResponse.next()
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'SAMEORIGIN')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  return response
}

export const config = {
  matcher: [
    // Match all routes except static files, _next, and public auth routes
    '/((?!_next/static|_next/image|favicon.ico|icon|manifest|sw.js|.*\\.png|.*\\.svg|.*\\.ico|api/auth).*)',
  ],
}
