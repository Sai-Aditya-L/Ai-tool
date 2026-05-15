import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  // Dynamically import pdf-parse to avoid Next.js build issues
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string; numpages: number }>
  const data = await pdfParse(buffer)

  const MAX_CHARS = 40000
  const truncated = data.text.length > MAX_CHARS
  const text = data.text.slice(0, MAX_CHARS).trim()

  return NextResponse.json({
    text,
    pages: data.numpages,
    filename: file.name,
    truncated,
    wordCount: text.split(/\s+/).length,
  })
}
