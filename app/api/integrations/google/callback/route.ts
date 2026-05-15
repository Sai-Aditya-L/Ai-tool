import { NextRequest, NextResponse } from 'next/server'
import { getGoogleOAuthClient } from '@/lib/google'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') // userId
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/integrations?error=google_denied`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/integrations?error=invalid_callback`)
  }

  try {
    const oauth2Client = getGoogleOAuthClient()
    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.access_token) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/integrations?error=no_token`)
    }

    // Get user info
    oauth2Client.setCredentials(tokens)
    const { google } = await import('googleapis')
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const userInfo = await oauth2.userinfo.get()

    // Save integration
    await prisma.integration.upsert({
      where: { userId_provider: { userId: state, provider: 'google' } },
      update: {
        status: 'connected',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || undefined,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        scope: tokens.scope || null,
        metadata: JSON.stringify({
          email: userInfo.data.email,
          name: userInfo.data.name,
          picture: userInfo.data.picture,
          connectedAt: new Date().toISOString(),
        }),
      },
      create: {
        userId: state,
        provider: 'google',
        status: 'connected',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        scope: tokens.scope || null,
        metadata: JSON.stringify({
          email: userInfo.data.email,
          name: userInfo.data.name,
          picture: userInfo.data.picture,
          connectedAt: new Date().toISOString(),
        }),
      },
    })

    await prisma.activityLog.create({
      data: {
        userId: state,
        action: 'INTEGRATION_CONNECTED',
        entityType: 'integration',
        details: `Connected Google account: ${userInfo.data.email}`,
      },
    })

    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/integrations?success=google_connected`)
  } catch (err) {
    console.error('Google OAuth callback error:', err)
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/integrations?error=oauth_failed`)
  }
}
