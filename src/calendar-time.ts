export type ZonedDateTimeOption = { offsetMinutes: number; instant: string }

export class CalendarTimeError extends Error {
  readonly code: 'invalid_local_datetime' | 'invalid_time_zone' | 'nonexistent_local_time' | 'ambiguous_local_time' | 'invalid_offset'

  constructor(code: 'invalid_local_datetime' | 'invalid_time_zone' | 'nonexistent_local_time' | 'ambiguous_local_time' | 'invalid_offset') {
    super(code)
    this.code = code
  }
}

type LocalParts = { year: number; month: number; day: number; hour: number; minute: number }

function parseLocalDateTime(value: string): LocalParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) throw new CalendarTimeError('invalid_local_datetime')
  const [, yearText, monthText, dayText, hourText, minuteText] = match
  const parts = {
    year: Number(yearText), month: Number(monthText), day: Number(dayText),
    hour: Number(hourText), minute: Number(minuteText),
  }
  const normalized = new Date(0)
  normalized.setUTCFullYear(parts.year, parts.month - 1, parts.day)
  normalized.setUTCHours(parts.hour, parts.minute, 0, 0)
  if (normalized.getUTCFullYear() !== parts.year || normalized.getUTCMonth() + 1 !== parts.month
    || normalized.getUTCDate() !== parts.day || parts.hour > 23 || parts.minute > 59) {
    throw new CalendarTimeError('invalid_local_datetime')
  }
  return parts
}

function asUtcMilliseconds(parts: LocalParts) {
  const value = new Date(0)
  value.setUTCFullYear(parts.year, parts.month - 1, parts.day)
  value.setUTCHours(parts.hour, parts.minute, 0, 0)
  return value.getTime()
}

function getTimeZoneParts(instant: Date, timeZone: string): LocalParts {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)
  const values = Object.fromEntries(formatted.map(({ type, value }) => [type, value]))
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  }
}

function assertTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(0)
  } catch {
    throw new CalendarTimeError('invalid_time_zone')
  }
}

function getPossibleOffsets(localAsUtc: number, timeZone: string) {
  const offsets = new Set<number>()
  for (let hours = -36; hours <= 36; hours += 3) {
    const sample = new Date(localAsUtc + hours * 60 * 60 * 1000)
    const zonedParts = getTimeZoneParts(sample, timeZone)
    offsets.add(Math.round((asUtcMilliseconds(zonedParts) - sample.getTime()) / 60_000))
  }
  return offsets
}

function sameLocalTime(left: LocalParts, right: LocalParts) {
  return left.year === right.year && left.month === right.month && left.day === right.day
    && left.hour === right.hour && left.minute === right.minute
}

export function getZonedDateTimeOptions(localDateTime: string, timeZone: string): ZonedDateTimeOption[] {
  const localParts = parseLocalDateTime(localDateTime)
  assertTimeZone(timeZone)
  const localAsUtc = asUtcMilliseconds(localParts)
  const possibleOffsets = getPossibleOffsets(localAsUtc, timeZone)

  return [...possibleOffsets]
    .map((offsetMinutes) => {
      const instant = new Date(localAsUtc - offsetMinutes * 60_000)
      return { offsetMinutes, instant }
    })
    .filter(({ instant }) => sameLocalTime(getTimeZoneParts(instant, timeZone), localParts))
    .sort((left, right) => left.instant.getTime() - right.instant.getTime())
    .map(({ offsetMinutes, instant }) => ({ offsetMinutes, instant: instant.toISOString() }))
}

export function getStartOfCalendarDate(date: string, timeZone: string) {
  const midnight = parseLocalDateTime(`${date}T00:00`)
  assertTimeZone(timeZone)
  const localAsUtc = asUtcMilliseconds(midnight)
  const candidates = [...getPossibleOffsets(localAsUtc, timeZone)]
    .map((offsetMinutes) => new Date(localAsUtc - offsetMinutes * 60_000))
    .filter((instant) => {
      const local = getTimeZoneParts(instant, timeZone)
      return local.year === midnight.year && local.month === midnight.month && local.day === midnight.day
    })
    .sort((left, right) => left.getTime() - right.getTime())
  const firstInstant = candidates[0]
  if (!firstInstant) throw new CalendarTimeError('nonexistent_local_time')
  return firstInstant.toISOString()
}

export function getLocalDateTimeValue(instant: string, timeZone: string) {
  assertTimeZone(timeZone)
  const date = new Date(instant)
  if (!Number.isFinite(date.getTime())) throw new CalendarTimeError('invalid_local_datetime')
  const parts = getTimeZoneParts(date, timeZone)
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`
}

export function getOffsetMinutesAt(instant: string, timeZone: string) {
  assertTimeZone(timeZone)
  const date = new Date(instant)
  if (!Number.isFinite(date.getTime())) throw new CalendarTimeError('invalid_local_datetime')
  return Math.round((asUtcMilliseconds(getTimeZoneParts(date, timeZone)) - date.getTime()) / 60_000)
}

export function resolveZonedDateTime(localDateTime: string, timeZone: string, selectedOffsetMinutes?: number) {
  const options = getZonedDateTimeOptions(localDateTime, timeZone)
  if (options.length === 0) throw new CalendarTimeError('nonexistent_local_time')
  if (selectedOffsetMinutes === undefined && options.length > 1) throw new CalendarTimeError('ambiguous_local_time')
  const selected = selectedOffsetMinutes === undefined
    ? options[0]
    : options.find(({ offsetMinutes }) => offsetMinutes === selectedOffsetMinutes)
  if (!selected) throw new CalendarTimeError('invalid_offset')
  return selected.instant
}
