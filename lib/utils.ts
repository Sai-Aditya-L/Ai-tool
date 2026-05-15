import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, isToday, isTomorrow, isPast } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isToday(d)) return `Today at ${format(d, 'h:mm a')}`
  if (isTomorrow(d)) return `Tomorrow at ${format(d, 'h:mm a')}`
  return format(d, 'MMM d, yyyy h:mm a')
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return formatDistanceToNow(d, { addSuffix: true })
}

export function isOverdue(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date
  return isPast(d)
}

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'urgent': return 'text-red-400 border-red-400/30 bg-red-400/10'
    case 'high': return 'text-orange-400 border-orange-400/30 bg-orange-400/10'
    case 'medium': return 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10'
    case 'low': return 'text-green-400 border-green-400/30 bg-green-400/10'
    default: return 'text-gray-400 border-gray-400/30 bg-gray-400/10'
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'completed': return 'text-green-400 border-green-400/30 bg-green-400/10'
    case 'in_progress': return 'text-blue-400 border-blue-400/30 bg-blue-400/10'
    case 'pending': return 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10'
    case 'cancelled': return 'text-gray-400 border-gray-400/30 bg-gray-400/10'
    case 'overdue': return 'text-red-400 border-red-400/30 bg-red-400/10'
    case 'connected': return 'text-green-400 border-green-400/30 bg-green-400/10'
    case 'disconnected': return 'text-gray-400 border-gray-400/30 bg-gray-400/10'
    case 'error': return 'text-red-400 border-red-400/30 bg-red-400/10'
    default: return 'text-gray-400 border-gray-400/30 bg-gray-400/10'
  }
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15)
}

export function parseTags(tagsString: string | null | undefined): string[] {
  if (!tagsString) return []
  return tagsString.split(',').map(t => t.trim()).filter(Boolean)
}

export function formatTags(tags: string[]): string {
  return tags.join(',')
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}
