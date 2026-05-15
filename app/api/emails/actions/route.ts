import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface ActionItem {
  type: 'task' | 'reminder' | 'meeting' | 'bill'
  title: string
  dueDate?: string
  priority: 'high' | 'medium' | 'low'
  emailSubject?: string
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  try {
    const body = await req.json()
    const { actionItems } = body as { actionItems: ActionItem[] }

    if (!Array.isArray(actionItems) || actionItems.length === 0) {
      return NextResponse.json({ error: 'actionItems array is required' }, { status: 400 })
    }

    let created = 0

    for (const item of actionItems) {
      if (item.type === 'task') {
        await prisma.task.create({
          data: {
            userId: user.id,
            title: item.title,
            description: item.emailSubject ? `From email: ${item.emailSubject}` : undefined,
            priority: item.priority,
            dueDate: item.dueDate ? new Date(item.dueDate) : null,
          },
        })
        created++
      } else if (item.type === 'reminder' || item.type === 'meeting') {
        await prisma.reminder.create({
          data: {
            userId: user.id,
            title: item.title,
            description: item.emailSubject ? `From email: ${item.emailSubject}` : undefined,
            dueAt: item.dueDate ? new Date(item.dueDate) : new Date(Date.now() + 24 * 60 * 60 * 1000),
            priority: item.priority,
          },
        })
        created++
      }
    }

    return NextResponse.json({ created })
  } catch (error) {
    console.error('Email actions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
