import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

const SUPPORTED_TYPES = ['application/pdf', 'text/plain', 'text/markdown', 'text/csv', 'text/x-markdown']
const MAX_BYTES = 20 * 1024 * 1024 // 20MB

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit(`doc-extract:${session.user.email}`, 10, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large (max 20MB)' }, { status: 400 })
  }

  const mime = file.type || 'application/octet-stream'
  const isPdf = mime === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  const isText = SUPPORTED_TYPES.some(t => mime.startsWith(t)) || file.name.match(/\.(txt|md|csv|log)$/i)

  if (!isPdf && !isText) {
    return NextResponse.json({ error: 'Unsupported file type. Supported: PDF, TXT, MD, CSV' }, { status: 400 })
  }

  try {
    let extractedText: string
    let pageCount: number | undefined
    let docType: string

    if (isPdf) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdf = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string; numpages: number }>
      const buffer = Buffer.from(await file.arrayBuffer())
      const data = await pdf(buffer)
      extractedText = data.text
      pageCount = data.numpages
      docType = 'pdf'
    } else {
      extractedText = await file.text()
      docType = 'text'
    }

    // Save to DB (fire-and-forget)
    const user = await prisma.user.findUnique({ where: { email: session.user.email! }, select: { id: true } })
    if (user) {
      prisma.userFile.create({
        data: {
          userId: user.id,
          name: file.name.replace(/\s+/g, '_'),
          originalName: file.name,
          mimeType: mime,
          size: file.size,
          content: extractedText.slice(0, 50000),
        },
      }).catch(() => {})
    }

    return NextResponse.json({
      text: extractedText,
      ...(pageCount !== undefined ? { pageCount } : {}),
      wordCount: extractedText.split(/\s+/).filter(Boolean).length,
      filename: file.name,
      type: docType,
    })
  } catch (err) {
    console.error('Document extract error:', err)
    return NextResponse.json({ error: 'Failed to extract text from document' }, { status: 500 })
  }
}
