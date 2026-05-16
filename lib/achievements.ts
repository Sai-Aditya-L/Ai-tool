import { prisma } from '@/lib/prisma'

interface AchievementDef {
  type: string
  name: string
  desc: string
  icon: string
}

async function award(userId: string, def: AchievementDef): Promise<boolean> {
  try {
    await prisma.achievement.upsert({
      where: { userId_type: { userId, type: def.type } },
      create: { userId, ...def },
      update: {},
    })
    return true
  } catch {
    return false
  }
}

export async function checkAndAwardAchievements(userId: string): Promise<void> {
  try {
    const [taskCount, completedTaskCount, noteCount, memoryCount, agentRunCount, goalCount, meetingCount, focusCount] =
      await Promise.all([
        prisma.task.count({ where: { userId } }),
        prisma.task.count({ where: { userId, status: 'completed' } }),
        prisma.note.count({ where: { userId } }),
        prisma.memory.count({ where: { userId } }),
        prisma.agentRun.count({ where: { userId } }).catch(() => 0),
        prisma.goal.count({ where: { userId, status: 'completed' } }).catch(() => 0),
        prisma.meeting.count({ where: { userId } }).catch(() => 0),
        prisma.focusSession.count({ where: { userId, completed: true } }).catch(() => 0),
      ])

    const promises: Promise<boolean>[] = []

    if (taskCount >= 1)
      promises.push(award(userId, { type: 'first_task', name: 'Task Master', desc: 'Create your first task', icon: '✅' }))
    if (completedTaskCount >= 50)
      promises.push(award(userId, { type: 'tasks_50', name: 'Productivity Pro', desc: 'Complete 50 tasks', icon: '🚀' }))
    if (noteCount >= 10)
      promises.push(award(userId, { type: 'notes_10', name: 'Note Taker', desc: 'Created 10 notes', icon: '📝' }))
    if (noteCount >= 50)
      promises.push(award(userId, { type: 'notes_50', name: 'Knowledge Base', desc: 'Created 50 notes', icon: '📚' }))
    if (memoryCount >= 25)
      promises.push(award(userId, { type: 'memory_25', name: 'Mind Palace', desc: 'Stored 25 memories', icon: '🧩' }))
    if (agentRunCount >= 1)
      promises.push(award(userId, { type: 'first_agent', name: 'Agent Commander', desc: 'Deployed your first AI agent', icon: '🤖' }))
    if (goalCount >= 1)
      promises.push(award(userId, { type: 'goals_complete', name: 'Goal Crusher', desc: 'Completed your first goal', icon: '🏆' }))
    if (meetingCount >= 1)
      promises.push(award(userId, { type: 'first_meeting', name: 'Meeting Pro', desc: 'Logged your first meeting', icon: '📅' }))
    if (focusCount >= 1)
      promises.push(award(userId, { type: 'first_focus', name: 'First Focus', desc: 'Completed your first focus session', icon: '🎯' }))
    if (focusCount >= 10)
      promises.push(award(userId, { type: 'focus_10', name: 'Deep Thinker', desc: '10 focus sessions completed', icon: '🧠' }))
    if (focusCount >= 50)
      promises.push(award(userId, { type: 'focus_50', name: 'Flow Master', desc: '50 focus sessions completed', icon: '⚡' }))

    await Promise.all(promises)
  } catch {
    // Never let achievement checks break the main operation
  }
}
