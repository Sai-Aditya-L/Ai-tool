import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { anthropic } from '@/lib/anthropic'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>

const TEXT_MIME_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'application/json',
  'text/csv',
  'text/x-markdown',
  'application/x-markdown',
])

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const files = await prisma.userFile.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ files })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const rl = rateLimit(`files:${user.id}`, 10, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File exceeds 5 MB limit' }, { status: 400 })
    }

    // Extract text content for supported types
    let content = ''
    if (file.type === 'application/pdf') {
      const buffer = Buffer.from(await file.arrayBuffer())
      const pdfData = await pdfParse(buffer)
      content = pdfData.text.substring(0, 10000)
    } else if (TEXT_MIME_TYPES.has(file.type) || file.type.startsWith('text/')) {
      const raw = await file.text()
      content = raw.slice(0, 10000)
    }

    // Generate a unique internal filename
    const generatedName = crypto.randomUUID().replace(/-/g, '')

    // Save record to DB (path stores extracted content; url left null)
    const record = await prisma.userFile.create({
      data: {
        userId: user.id,
        name: generatedName,
        originalName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        path: content, // repurposed to store extracted text
        url: null,
        summary: null,
      },
    })

    // Generate AI summary asynchronously (fire and forget approach with await for simplicity)
    let summary: string | null = null
    try {
      const promptContent = content
        ? `Summarize the following document content in 2-3 sentences:\n\nContent: ${content.substring(0, 6000)}`
        : `The file "${file.name}" (type: ${file.type}, size: ${file.size} bytes) is a binary/non-text file. Provide a 2-3 sentence description of what this type of file typically contains and how it might be used.`

      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 256,
        messages: [{ role: 'user', content: promptContent }],
      })

      const block = response.content[0]
      if (block.type === 'text') {
        summary = block.text.trim()
      }
    } catch {
      // AI summary is non-critical — proceed without it
    }

    // Store summary back
    const updated = await prisma.userFile.update({
      where: { id: record.id },
      data: { summary },
    })

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'FILE_UPLOADED',
        entityType: 'file',
        entityId: record.id,
        details: `Uploaded file: ${file.name}`,
      },
    })

    return NextResponse.json({ file: updated }, { status: 201 })
  } catch (error) {
    console.error('File upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
