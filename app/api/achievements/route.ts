import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function getAuthUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null
  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  return user
}

const ACHIEVEMENT_CATALOG = [
  { type: 'first_task', name: 'Task Master', desc: 'Create your first task', icon: '✅' },
  { type: 'tasks_50', name: 'Productivity Pro', desc: 'Complete 50 tasks', icon: '🚀' },
  { type: 'first_focus', name: 'First Focus', desc: 'Complete your first focus session', icon: '🎯' },
  { type: 'focus_10', name: 'Deep Thinker', desc: '10 focus sessions completed', icon: '🧠' },
  { type: 'focus_50', name: 'Flow Master', desc: '50 focus sessions completed', icon: '⚡' },
  { type: 'streak_7', name: 'Week Warrior', desc: '7-day habit streak', icon: '🔥' },
  { type: 'streak_30', name: 'Month Master', desc: '30-day habit streak', icon: '💎' },
  { type: 'notes_10', name: 'Note Taker', desc: 'Created 10 notes', icon: '📝' },
  { type: 'notes_50', name: 'Knowledge Base', desc: 'Created 50 notes', icon: '📚' },
  { type: 'first_agent', name: 'Agent Commander', desc: 'Deployed your first AI agent', icon: '🤖' },
  { type: 'memory_25', name: 'Mind Palace', desc: 'Stored 25 memories', icon: '🧩' },
  { type: 'goals_complete', name: 'Goal Crusher', desc: 'Completed your first goal', icon: '🏆' },
  { type: 'connected_google', name: 'Connected', desc: 'Connected Google account', icon: '🔗' },
  { type: 'first_meeting', name: 'Meeting Pro', desc: 'Logged your first meeting', icon: '📅' },
]

async function maybeAwardAchievement(
  userId: string,
  type: string,
  name: string,
  desc: string,
  icon: string
) {
  return prisma.achievement.upsert({
    where: { userId_type: { userId, type } },
    create: { userId, type, name, desc, icon },
    update: {},
  })
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const earned = await prisma.achievement.findMany({
    where: { userId: user.id },
    orderBy: { earnedAt: 'desc' },
  })

  const earnedTypes = new Set(earned.map((a) => a.type))
  const locked = ACHIEVEMENT_CATALOG.filter((a) => !earnedTypes.has(a.type))

  return NextResponse.json({
    earned,
    locked,
    total: ACHIEVEMENT_CATALOG.length,
    earnedCount: earned.length,
  })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const check = searchParams.get('check')

  if (check !== '1') {
    return NextResponse.json({ error: 'Use ?check=1' }, { status: 400 })
  }

  const newlyEarned: (typeof earned[0])[] = []
  type Achievement = Awaited<ReturnType<typeof prisma.achievement.upsert>>
  const earned: Achievement[] = []

  async function tryAward(type: string, name: string, desc: string, icon: string) {
    const before = await prisma.achievement.findUnique({
      where: { userId_type: { userId: user!.id, type } },
    })
    const result = await maybeAwardAchievement(user!.id, type, name, desc, icon)
    if (!before) {
      earned.push(result)
    }
  }

  // Tasks
  const taskCount = await prisma.task.count({ where: { userId: user.id } })
  if (taskCount >= 1) await tryAward('first_task', 'Task Master', 'Create your first task', '✅')

  const completedTaskCount = await prisma.task.count({ where: { userId: user.id, status: 'completed' } })
  if (completedTaskCount >= 50) await tryAward('tasks_50', 'Productivity Pro', 'Complete 50 tasks', '🚀')

  // Focus sessions
  const focusCount = await prisma.focusSession.count({ where: { userId: user.id, completed: true } })
  if (focusCount >= 1) await tryAward('first_focus', 'First Focus', 'Complete your first focus session', '🎯')
  if (focusCount >= 10) await tryAward('focus_10', 'Deep Thinker', '10 focus sessions completed', '🧠')
  if (focusCount >= 50) await tryAward('focus_50', 'Flow Master', '50 focus sessions completed', '⚡')

  // Notes
  const noteCount = await prisma.note.count({ where: { userId: user.id } })
  if (noteCount >= 10) await tryAward('notes_10', 'Note Taker', 'Created 10 notes', '📝')
  if (noteCount >= 50) await tryAward('notes_50', 'Knowledge Base', 'Created 50 notes', '📚')

  // Memories
  const memoryCount = await prisma.memory.count({ where: { userId: user.id } })
  if (memoryCount >= 25) await tryAward('memory_25', 'Mind Palace', 'Stored 25 memories', '🧩')

  // Agents
  const agentCount = await prisma.agentRun.count({ where: { userId: user.id } })
  if (agentCount >= 1) await tryAward('first_agent', 'Agent Commander', 'Deployed your first AI agent', '🤖')

  // Goals
  const completedGoalCount = await prisma.goal.count({ where: { userId: user.id, status: 'completed' } })
  if (completedGoalCount >= 1) await tryAward('goals_complete', 'Goal Crusher', 'Completed your first goal', '🏆')

  // Meetings
  const meetingCount = await prisma.meeting.count({ where: { userId: user.id } })
  if (meetingCount >= 1) await tryAward('first_meeting', 'Meeting Pro', 'Logged your first meeting', '📅')

  // Google connected
  const googleIntegration = await prisma.integration.findFirst({
    where: { userId: user.id, provider: 'google', status: 'connected' },
  })
  if (googleIntegration) await tryAward('connected_google', 'Connected', 'Connected Google account', '🔗')

  // Habit streak check — find max streak across all habits
  const habits = await prisma.habit.findMany({
    where: { userId: user.id, status: 'active' },
    include: { entries: { where: { completed: true }, orderBy: { date: 'desc' } } },
  })

  let maxStreak = 0
  for (const habit of habits) {
    if (habit.entries.length === 0) continue
    let streak = 0
    const checkDay = new Date()
    checkDay.setHours(0, 0, 0, 0)
    const dateSet = new Set(habit.entries.map((e) => e.date))
    while (true) {
      const key = checkDay.toISOString().slice(0, 10)
      if (dateSet.has(key)) {
        streak++
        checkDay.setDate(checkDay.getDate() - 1)
      } else {
        break
      }
    }
    if (streak > maxStreak) maxStreak = streak
  }

  if (maxStreak >= 7) await tryAward('streak_7', 'Week Warrior', '7-day habit streak', '🔥')
  if (maxStreak >= 30) await tryAward('streak_30', 'Month Master', '30-day habit streak', '💎')

  return NextResponse.json({ newlyEarned: earned })
}
