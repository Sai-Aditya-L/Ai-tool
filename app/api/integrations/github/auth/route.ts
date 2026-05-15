import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

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

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/integrations/github/callback`,
    scope: 'repo read:user user:email',
    state: session.user.email,
  })

  return NextResponse.redirect(`https://github.com/login/oauth/authorize?${params}`)
}
