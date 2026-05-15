import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') // user email
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/integrations?error=github_denied`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/integrations?error=invalid_callback`)
  }

  try {
    // Exchange code for access token
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
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/integrations/github/callback`,
      }),
    })

    const tokenData = await tokenRes.json()

    if (!tokenData.access_token) {
      console.error('GitHub token exchange failed:', tokenData)
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/integrations?error=oauth_failed`)
    }

    const accessToken: string = tokenData.access_token

    // Fetch GitHub user info
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    })
    const githubUser = await userRes.json()

    // Find our user by email (state = email)
    const user = await prisma.user.findUnique({ where: { email: state } })
    if (!user) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/integrations?error=user_not_found`)
    }

    // Upsert integration record
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

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'INTEGRATION_CONNECTED',
        entityType: 'integration',
        details: `Connected GitHub account: ${githubUser.login}`,
      },
    })

    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/integrations?success=github_connected`)
  } catch (err) {
    console.error('GitHub OAuth callback error:', err)
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/integrations?error=oauth_failed`)
  }
}
