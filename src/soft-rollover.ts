import { addCalendarDays, getCalendarDate } from './date-utils.js'

export function pendingDayLabel(dueAt: string | null, today: string, timeZone: string): 'De ayer' | 'Pendiente' | null {
  if (!dueAt) return null
  const dueDay = getCalendarDate(new Date(dueAt), timeZone)
  if (dueDay >= today) return null
  return dueDay === addCalendarDays(today, -1) ? 'De ayer' : 'Pendiente'
}

export function moveDueAtToToday(now: Date): string {
  return now.toISOString()
}
