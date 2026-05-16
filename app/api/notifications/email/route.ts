import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

// Email sending — uses nodemailer if SMTP configured, otherwise logs
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const smtpHost = process.env.SMTP_HOST
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS

  if (!smtpHost || !smtpUser || !smtpPass) {
    // Log instead of send when SMTP not configured
    console.log(`[EMAIL] To: ${to} | Subject: ${subject}`)
    return true
  }

  try {
    // Dynamically import nodemailer to avoid bundling it when not needed
    const nodemailer = await import('nodemailer').catch(() => null)
    if (!nodemailer) return false

    const transporter = nodemailer.default.createTransporter({
      host: smtpHost,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: smtpUser, pass: smtpPass },
    })

    await transporter.sendMail({
      from: process.env.SMTP_FROM || `NEXUS <${smtpUser}>`,
      to,
      subject,
      html,
    })
    return true
  } catch (err) {
    console.error('[EMAIL] Send failed:', err)
    return false
  }
}

// POST /api/notifications/email — send a notification email
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit(`email-notif:${session.user.email}`, 10, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, subject, content } = await req.json()
  if (!type || !subject) return NextResponse.json({ error: 'Missing type or subject' }, { status: 400 })

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #000810; color: #e2e8f0; border-radius: 12px;">
      <div style="margin-bottom: 24px;">
        <span style="color: #00e5ff; font-weight: bold; font-size: 18px; letter-spacing: 0.1em;">NEXUS</span>
        <span style="color: rgba(255,255,255,0.3); font-size: 10px; margin-left: 8px;">NEURAL EXTENDED UNIVERSAL SYSTEM</span>
      </div>
      <h2 style="color: #fff; margin: 0 0 16px;">${subject}</h2>
      <div style="color: rgba(255,255,255,0.7); line-height: 1.6;">${content || ''}</div>
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 12px; color: rgba(255,255,255,0.3);">
        This email was sent from your NEXUS system. <a href="${process.env.NEXTAUTH_URL}/settings" style="color: #00e5ff;">Manage notifications</a>
      </div>
    </div>
  `

  const sent = await sendEmail(user.email, subject, html)

  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: 'email_notification_sent',
      entityType: 'notification',
      entityId: user.id,
      metadata: JSON.stringify({ type, subject, sent }),
    },
  })

  return NextResponse.json({ success: sent, queued: !sent })
}
