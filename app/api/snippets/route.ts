import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function getAuthUser(req?: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null
  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  return user
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''
  const language = searchParams.get('language') || ''

  const snippets = await prisma.snippet.findMany({
    where: {
      userId: user.id,
      ...(language && { language }),
      ...(search && {
        OR: [
          { title: { contains: search } },
          { code: { contains: search } },
          { tags: { contains: search } },
        ],
      }),
    },
    orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
  })

  return NextResponse.json({ snippets })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, language = 'text', code, tags = '[]' } = body

  if (!title || typeof title !== 'string' || title.length > 200) {
    return NextResponse.json({ error: 'Title is required and must be at most 200 characters' }, { status: 400 })
  }
  if (!code || typeof code !== 'string' || code.length > 100000) {
    return NextResponse.json({ error: 'Code is required and must be at most 100000 characters' }, { status: 400 })
  }
  if (typeof language !== 'string' || language.length > 50) {
    return NextResponse.json({ error: 'Language must be at most 50 characters' }, { status: 400 })
  }

  const snippet = await prisma.snippet.create({
    data: {
      userId: user.id,
      title: title.trim(),
      language,
      code,
      tags: typeof tags === 'string' ? tags : JSON.stringify(tags),
    },
  })

  return NextResponse.json({ snippet }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, title, language, code, tags, pinned } = body

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const existing = await prisma.snippet.findFirst({ where: { id, userId: user.id } })
  if (!existing) return NextResponse.json({ error: 'Snippet not found' }, { status: 404 })

  if (title !== undefined && (typeof title !== 'string' || title.length > 200)) {
    return NextResponse.json({ error: 'Title must be at most 200 characters' }, { status: 400 })
  }
  if (code !== undefined && (typeof code !== 'string' || code.length > 100000)) {
    return NextResponse.json({ error: 'Code must be at most 100000 characters' }, { status: 400 })
  }
  if (language !== undefined && (typeof language !== 'string' || language.length > 50)) {
    return NextResponse.json({ error: 'Language must be at most 50 characters' }, { status: 400 })
  }

  const snippet = await prisma.snippet.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(language !== undefined && { language }),
      ...(code !== undefined && { code }),
      ...(tags !== undefined && { tags: typeof tags === 'string' ? tags : JSON.stringify(tags) }),
      ...(pinned !== undefined && { pinned: Boolean(pinned) }),
    },
  })

  return NextResponse.json({ snippet })
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'id query param is required' }, { status: 400 })

  const existing = await prisma.snippet.findFirst({ where: { id, userId: user.id } })
  if (!existing) return NextResponse.json({ error: 'Snippet not found' }, { status: 404 })

  await prisma.snippet.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
