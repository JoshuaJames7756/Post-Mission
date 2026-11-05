import { getCalendarDate } from './date-utils.js'
import { getLocalDateTimeValue } from './calendar-time.js'

type DisplayEvent = {
  allDay: boolean
  startDate: string | null
  endDate: string | null
  startAt: string | null
  endAt: string | null
}

export function eventOccursOnDate(event: DisplayEvent, date: string, timeZone: string) {
  if (event.allDay) return Boolean(event.startDate && event.startDate <= date && (event.endDate ?? event.startDate) >= date)
  if (!event.startAt || !event.endAt) return false
  const firstDate = getCalendarDate(new Date(event.startAt), timeZone)
  // Timed intervals exclude the ending instant, including exact midnight.
  const lastDate = getCalendarDate(new Date(Date.parse(event.endAt) - 1), timeZone)
  return firstDate <= date && lastDate >= date
}

export function eventTimelineRange(event: DisplayEvent, date: string, timeZone: string) {
  if (event.allDay || !event.startAt || !event.endAt || !eventOccursOnDate(event, date, timeZone)) return null
  const localStart = getLocalDateTimeValue(event.startAt, timeZone)
  const localEnd = getLocalDateTimeValue(event.endAt, timeZone)
  const start = localStart.slice(0, 10) < date ? 0 : Number(localStart.slice(11, 13)) * 60 + Number(localStart.slice(14, 16))
  const end = localEnd.slice(0, 10) > date ? 1440 : Number(localEnd.slice(11, 13)) * 60 + Number(localEnd.slice(14, 16))
  return end > start ? { start, end } : null
}
