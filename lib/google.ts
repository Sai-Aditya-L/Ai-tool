import { google } from 'googleapis'
import { prisma } from './prisma'
import { createOAuthNonce } from './oauth-nonces'

export function getGoogleOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/integrations/google/callback`
  )
}

export function getGoogleAuthUrl(userId: string) {
  const oauth2Client = getGoogleOAuthClient()
  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ]
  const nonce = createOAuthNonce(userId)
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
    state: nonce,
  })
}

export async function getGoogleClientForUser(userId: string) {
  const integration = await prisma.integration.findFirst({
    where: { userId, provider: 'google', status: 'connected' },
  })
  if (!integration?.accessToken) return null

  const oauth2Client = getGoogleOAuthClient()
  oauth2Client.setCredentials({
    access_token: integration.accessToken,
    refresh_token: integration.refreshToken || undefined,
    expiry_date: integration.expiresAt?.getTime(),
  })

  // Auto-refresh token if expired
  oauth2Client.on('tokens', async (tokens) => {
    await prisma.integration.update({
      where: { userId_provider: { userId, provider: 'google' } },
      data: {
        accessToken: tokens.access_token || integration.accessToken,
        ...(tokens.refresh_token && { refreshToken: tokens.refresh_token }),
        ...(tokens.expiry_date && { expiresAt: new Date(tokens.expiry_date) }),
      },
    })
  })

  return oauth2Client
}

export async function getGmailClient(userId: string) {
  const auth = await getGoogleClientForUser(userId)
  if (!auth) return null
  return google.gmail({ version: 'v1', auth })
}

export async function getCalendarClient(userId: string) {
  const auth = await getGoogleClientForUser(userId)
  if (!auth) return null
  return google.calendar({ version: 'v3', auth })
}

export async function listEmails(userId: string, options: {
  maxResults?: number
  query?: string
  labelIds?: string[]
  pageToken?: string
} = {}) {
  const gmail = await getGmailClient(userId)
  if (!gmail) throw new Error('Google not connected')

  const { maxResults = 20, query = '', labelIds = ['INBOX'], pageToken } = options

  const list = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
    q: query,
    labelIds,
    pageToken,
  })

  const messages = list.data.messages || []
  const nextPageToken = list.data.nextPageToken

  const emails = await Promise.all(
    messages.slice(0, maxResults).map(async (msg) => {
      try {
        const full = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'metadata',
          metadataHeaders: ['From', 'To', 'Subject', 'Date'],
        })
        const headers = full.data.payload?.headers || []
        const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || ''
        const from = getHeader('From')
        const fromMatch = from.match(/^(.+?)\s*<(.+?)>$/)
        return {
          id: msg.id!,
          threadId: full.data.threadId || '',
          from: fromMatch ? fromMatch[2] : from,
          fromName: fromMatch ? fromMatch[1].replace(/"/g, '') : from,
          to: getHeader('To'),
          subject: getHeader('Subject') || '(no subject)',
          snippet: full.data.snippet || '',
          labels: full.data.labelIds || [],
          isRead: !(full.data.labelIds || []).includes('UNREAD'),
          isStarred: (full.data.labelIds || []).includes('STARRED'),
          isImportant: (full.data.labelIds || []).includes('IMPORTANT'),
          receivedAt: new Date(parseInt(full.data.internalDate || '0')).toISOString(),
        }
      } catch {
        return null
      }
    })
  )

  return {
    emails: emails.filter(Boolean),
    nextPageToken,
  }
}

export async function getEmailBody(userId: string, messageId: string): Promise<string> {
  const gmail = await getGmailClient(userId)
  if (!gmail) throw new Error('Google not connected')

  const full = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  })

  function extractBody(payload: any): string {
    if (!payload) return ''
    if (payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf8')
    }
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf8')
        }
        if (part.mimeType === 'text/html' && part.body?.data) {
          const html = Buffer.from(part.body.data, 'base64').toString('utf8')
          return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        }
        const nested = extractBody(part)
        if (nested) return nested
      }
    }
    return ''
  }

  return extractBody(full.data.payload).substring(0, 3000)
}

export async function createDraft(userId: string, options: {
  to: string
  subject: string
  body: string
  replyToMessageId?: string
}) {
  const gmail = await getGmailClient(userId)
  if (!gmail) throw new Error('Google not connected')

  const messageParts = [
    `To: ${options.to}`,
    `Subject: ${options.subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    options.body,
  ]

  const raw = Buffer.from(messageParts.join('\r\n')).toString('base64url')
  const draft = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: {
      message: {
        raw,
        ...(options.replyToMessageId && { threadId: options.replyToMessageId }),
      },
    },
  })

  return draft.data
}

export async function markEmailRead(userId: string, messageId: string) {
  const gmail = await getGmailClient(userId)
  if (!gmail) throw new Error('Google not connected')
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: { removeLabelIds: ['UNREAD'] },
  })
}

export async function listCalendarEvents(userId: string, options: {
  maxResults?: number
  timeMin?: Date
  timeMax?: Date
  calendarId?: string
} = {}) {
  const calendar = await getCalendarClient(userId)
  if (!calendar) throw new Error('Google Calendar not connected')

  const now = new Date()
  const { maxResults = 20, timeMin = now, timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), calendarId = 'primary' } = options

  const response = await calendar.events.list({
    calendarId,
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  })

  return (response.data.items || []).map(event => ({
    id: event.id!,
    title: event.summary || '(no title)',
    description: event.description || '',
    location: event.location || '',
    startTime: event.start?.dateTime || event.start?.date || '',
    endTime: event.end?.dateTime || event.end?.date || '',
    allDay: !event.start?.dateTime,
    attendees: (event.attendees || []).map(a => a.email).join(', '),
    meetLink: event.hangoutLink || '',
    status: event.status || 'confirmed',
    organizer: event.organizer?.email || '',
  }))
}

export async function createCalendarEvent(userId: string, options: {
  title: string
  description?: string
  location?: string
  startTime: string
  endTime: string
  attendees?: string[]
  calendarId?: string
}) {
  const calendar = await getCalendarClient(userId)
  if (!calendar) throw new Error('Google Calendar not connected')

  const event = await calendar.events.insert({
    calendarId: options.calendarId || 'primary',
    requestBody: {
      summary: options.title,
      description: options.description,
      location: options.location,
      start: { dateTime: options.startTime, timeZone: 'UTC' },
      end: { dateTime: options.endTime, timeZone: 'UTC' },
      attendees: (options.attendees || []).map(email => ({ email })),
    },
  })

  return event.data
}

export async function deleteCalendarEvent(userId: string, eventId: string, calendarId = 'primary') {
  const calendar = await getCalendarClient(userId)
  if (!calendar) throw new Error('Google Calendar not connected')
  await calendar.events.delete({ calendarId, eventId })
}

export async function isGoogleConnected(userId: string): Promise<boolean> {
  const integration = await prisma.integration.findFirst({
    where: { userId, provider: 'google', status: 'connected' },
  })
  return !!integration?.accessToken
}
