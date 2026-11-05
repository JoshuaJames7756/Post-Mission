import { getLocalDateTimeValue, getOffsetMinutesAt, getZonedDateTimeOptions } from './calendar-time.js'
import { addCalendarDays } from './date-utils.js'

type TimedEvent = {
  title: string
  description: string | null
  category: string
  color: 'sage' | 'amber' | 'navy' | 'slate'
  goalId: string | null
  allDay: boolean
  startDate?: string | null
  endDate?: string | null
  startAt: string | null
  endAt: string | null
  timeZone: string | null
  status: 'scheduled' | 'completed' | 'cancelled'
}

export function scheduleAllDayEventInput(event: TimedEvent, date: string, displayZone: string, targetMinute: number) {
  if (!event.allDay || event.status !== 'scheduled' || event.startDate !== date || event.endDate !== date) throw new Error('event_not_schedulable')
  if (targetMinute < 0 || targetMinute > 1380 || targetMinute % 15 !== 0) throw new Error('invalid_target_time')
  const startLocal = `${date}T${String(Math.floor(targetMinute / 60)).padStart(2, '0')}:${String(targetMinute % 60).padStart(2, '0')}`
  const startOptions = getZonedDateTimeOptions(startLocal, displayZone)
  if (!startOptions.length) throw new Error('nonexistent_target_time')
  const start = startOptions[0]!.instant
  const end = new Date(Date.parse(start) + 60 * 60_000).toISOString()
  return eventInputWithInstants(event, displayZone, start, end)
}

export function movableEventRange(event: TimedEvent, date: string, displayZone: string) {
  if (event.allDay || event.status !== 'scheduled' || !event.startAt || !event.endAt) return null
  const startMs = Date.parse(event.startAt)
  const endMs = Date.parse(event.endAt)
  const durationMinutes = (endMs - startMs) / 60_000
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) return null
  const startLocal = getLocalDateTimeValue(event.startAt, displayZone)
  const endLocal = getLocalDateTimeValue(new Date(endMs - 1).toISOString(), displayZone)
  if (!startLocal.startsWith(`${date}T`) || !endLocal.startsWith(`${date}T`)) return null
  const startMinute = Number(startLocal.slice(11, 13)) * 60 + Number(startLocal.slice(14, 16))
  return { startMinute, durationMinutes }
}

export function snapEventStart(startMinute: number, deltaPixels: number, durationMinutes: number) {
  const latest = Math.max(0, 1440 - durationMinutes)
  return Math.max(0, Math.min(latest, Math.round((startMinute + deltaPixels) / 15) * 15))
}

export function snapEventEnd(startMinute: number, endMinute: number, deltaPixels: number) {
  const earliest = Math.min(1440, Math.ceil((startMinute + 15) / 15) * 15)
  return Math.max(earliest, Math.min(1440, Math.round((endMinute + deltaPixels) / 15) * 15))
}

export function resizableEventRange(event: TimedEvent, date: string, displayZone: string) {
  const range = movableEventRange(event, date, displayZone)
  if (!range || !event.endAt) return null
  const localEnd = getLocalDateTimeValue(event.endAt, displayZone)
  const endMinute = localEnd.startsWith(`${date}T`)
    ? Number(localEnd.slice(11, 13)) * 60 + Number(localEnd.slice(14, 16))
    : 1440
  return endMinute > range.startMinute ? { ...range, endMinute } : null
}

function eventInputWithInstants(event: TimedEvent, displayZone: string, start: string, end: string) {
  const eventZone = event.timeZone ?? displayZone
  return {
    title: event.title,
    description: event.description,
    category: event.category,
    color: event.color,
    goalId: event.goalId,
    allDay: false as const,
    startLocal: getLocalDateTimeValue(start, eventZone),
    endLocal: getLocalDateTimeValue(end, eventZone),
    timeZone: eventZone,
    startOffsetMinutes: getOffsetMinutesAt(start, eventZone),
    endOffsetMinutes: getOffsetMinutesAt(end, eventZone),
  }
}

export function movedEventInput(event: TimedEvent, date: string, displayZone: string, targetMinute: number) {
  const range = movableEventRange(event, date, displayZone)
  if (!range || !event.startAt || !event.endAt) throw new Error('event_not_movable')
  if (targetMinute < 0 || targetMinute + range.durationMinutes > 1440 || targetMinute % 15 !== 0) throw new Error('invalid_target_time')
  const local = `${date}T${String(Math.floor(targetMinute / 60)).padStart(2, '0')}:${String(targetMinute % 60).padStart(2, '0')}`
  const options = getZonedDateTimeOptions(local, displayZone)
  if (!options.length) throw new Error('nonexistent_target_time')
  const expected = Date.parse(event.startAt) + (targetMinute - range.startMinute) * 60_000
  const start = options.reduce((best, option) => Math.abs(Date.parse(option.instant) - expected) < Math.abs(Date.parse(best.instant) - expected) ? option : best).instant
  const end = new Date(Date.parse(start) + range.durationMinutes * 60_000).toISOString()
  return eventInputWithInstants(event, displayZone, start, end)
}

export function resizedEventInput(event: TimedEvent, date: string, displayZone: string, targetEndMinute: number) {
  const range = resizableEventRange(event, date, displayZone)
  if (!range || !event.startAt || !event.endAt) throw new Error('event_not_resizable')
  if (targetEndMinute <= range.startMinute || targetEndMinute > 1440 || targetEndMinute % 15 !== 0) throw new Error('invalid_target_time')
  const endLocal = targetEndMinute === 1440
    ? `${addCalendarDays(date, 1)}T00:00`
    : `${date}T${String(Math.floor(targetEndMinute / 60)).padStart(2, '0')}:${String(targetEndMinute % 60).padStart(2, '0')}`
  const options = getZonedDateTimeOptions(endLocal, displayZone)
    .filter((option) => Date.parse(option.instant) > Date.parse(event.startAt!))
  if (!options.length) throw new Error('nonexistent_target_time')
  const expected = Date.parse(event.endAt) + (targetEndMinute - range.endMinute) * 60_000
  const end = options.reduce((best, option) => Math.abs(Date.parse(option.instant) - expected) < Math.abs(Date.parse(best.instant) - expected) ? option : best).instant
  return eventInputWithInstants(event, displayZone, event.startAt, end)
}
