import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createOAuthNonce } from '@/lib/oauth-nonces'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (!process.env.GITHUB_CLIENT_ID) {
    return NextResponse.json(
      { error: 'GitHub OAuth not configured. Add GITHUB_CLIENT_ID to .env' },
      { status: 503 }
    )
  }

  const userId = (session.user as any).id as string

  // Generate a cryptographically random nonce tied to this user (10-minute TTL)
  const nonce = createOAuthNonce(userId)

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    redirect_uri: `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/api/integrations/github/callback`,
    scope: 'repo read:user user:email',
    state: nonce,
  })

  return NextResponse.redirect(`https://github.com/login/oauth/authorize?${params}`)
}
