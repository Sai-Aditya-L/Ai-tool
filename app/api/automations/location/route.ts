import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const locationTriggerSchema = z.object({
  triggerId: z.string().max(100).optional(),
  triggerName: z.string().min(1).max(200),
  event: z.enum(['arrive', 'depart']), // strict enum — prevents log injection
  location: z.string().min(1).max(200),
  action: z.string().min(1).max(500),
})

// POST: Handle a location event (called from browser when geofence is triggered)
// Body: { triggerId, triggerName, event: 'arrive'|'depart', location: string, action: string }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parseResult = locationTriggerSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
  }
  const { triggerId, triggerName, event, location, action } = parseResult.data

  // Log to activity log
  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: `location_trigger_${event}`,
      entityType: 'automation',
      entityId: triggerId ?? 'location',
      metadata: JSON.stringify({ triggerName, event, location, action }),
    },
  })

  // Return success - in a real system, this would execute the action
  return NextResponse.json({
    success: true,
    message: `Location trigger processed successfully.`,
    details: { event, location: location.slice(0, 100), action: action.slice(0, 200) },
  })
}
