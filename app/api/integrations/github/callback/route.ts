import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { oauthNonces } from '@/lib/oauth-nonces'

export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') // CSRF nonce
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${baseUrl}/integrations?error=github_denied`)
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/integrations?error=invalid_callback`)
  }

  if (!state) {
    return NextResponse.redirect(`${baseUrl}/integrations?error=missing_state`)
  }

  const nonceData = oauthNonces.get(state)
  if (!nonceData || nonceData.expiresAt < Date.now()) {
    return NextResponse.redirect(`${baseUrl}/integrations?error=invalid_state`)
  }
  oauthNonces.delete(state)

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${baseUrl}/api/integrations/github/callback`,
      }),
    })

    const tokenData = await tokenRes.json()

    if (!tokenData.access_token) {
      console.error('GitHub token exchange failed:', tokenData)
      return NextResponse.redirect(`${baseUrl}/integrations?error=oauth_failed`)
    }

    const accessToken: string = tokenData.access_token

    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    })
    const githubUser = await userRes.json()

    const user = await prisma.user.findUnique({ where: { id: nonceData.userId } })
    if (!user) {
      return NextResponse.redirect(`${baseUrl}/integrations?error=user_not_found`)
    }

    await prisma.integration.upsert({
      where: { userId_provider: { userId: user.id, provider: 'github' } },
      update: {
        status: 'connected',
        accessToken,
        metadata: JSON.stringify({
          login: githubUser.login,
          name: githubUser.name,
          avatar_url: githubUser.avatar_url,
          connectedAt: new Date().toISOString(),
        }),
      },
      create: {
        userId: user.id,
        provider: 'github',
        status: 'connected',
        accessToken,
        metadata: JSON.stringify({
          login: githubUser.login,
          name: githubUser.name,
          avatar_url: githubUser.avatar_url,
          connectedAt: new Date().toISOString(),
        }),
      },
    })

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'INTEGRATION_CONNECTED',
        entityType: 'integration',
        details: `Connected GitHub account: ${githubUser.login}`,
      },
    })

    return NextResponse.redirect(`${baseUrl}/integrations?success=github_connected`)
  } catch (err) {
    console.error('GitHub OAuth callback error:', err)
    return NextResponse.redirect(`${baseUrl}/integrations?error=oauth_failed`)
  }
}
