import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST: Handle a location event (called from browser when geofence is triggered)
// Body: { triggerId, triggerName, event: 'arrive'|'depart', location: string, action: string }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { triggerId, triggerName, event, location, action } = body

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
    message: `Location trigger fired: ${event} at ${location}. Action: ${action}`,
  })
}
