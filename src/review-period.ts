import { addCalendarDays } from './date-utils.js'

export type ReviewPeriodType = 'daily' | 'weekly'

export function weekStart(date: string): string {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay()
  return addCalendarDays(date, -((day + 6) % 7))
}

export function periodStart(date: string, type: ReviewPeriodType): string {
  return type === 'weekly' ? weekStart(date) : date
}

export function movePeriod(start: string, type: ReviewPeriodType, offset: number): string {
  return addCalendarDays(start, offset * (type === 'weekly' ? 7 : 1))
}
