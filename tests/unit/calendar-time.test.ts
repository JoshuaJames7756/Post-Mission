import { describe, expect, it } from 'vitest'
import { getLocalDateTimeValue, getOffsetMinutesAt, getStartOfCalendarDate, getZonedDateTimeOptions, resolveZonedDateTime } from '../../src/calendar-time.js'

describe('calendar time-zone conversion', () => {
  it('converts a unique local time using the selected IANA zone', () => {
    expect(resolveZonedDateTime('2026-10-24T09:00', 'America/La_Paz', -240)).toBe('2026-10-24T13:00:00.000Z')
  })

  it('returns both valid offsets for an ambiguous daylight-saving time', () => {
    expect(getZonedDateTimeOptions('2026-11-01T01:30', 'America/New_York')).toEqual([
      { offsetMinutes: -240, instant: '2026-11-01T05:30:00.000Z' },
      { offsetMinutes: -300, instant: '2026-11-01T06:30:00.000Z' },
    ])
    expect(() => resolveZonedDateTime('2026-11-01T01:30', 'America/New_York')).toThrow('ambiguous_local_time')
  })

  it('rejects nonexistent local times, invalid dates, and unknown zones', () => {
    expect(() => resolveZonedDateTime('2026-03-08T02:30', 'America/New_York')).toThrow('nonexistent_local_time')
    expect(() => resolveZonedDateTime('2026-02-30T09:00', 'America/La_Paz')).toThrow('invalid_local_datetime')
    expect(() => resolveZonedDateTime('2026-02-28T09:00', 'Not/AZone')).toThrow('invalid_time_zone')
  })

  it('finds the first real instant of a calendar date when midnight is skipped', () => {
    expect(getStartOfCalendarDate('2018-11-04', 'America/Sao_Paulo')).toBe('2018-11-04T03:00:00.000Z')
  })

  it('restores an instant as local fields and its explicit zone offset', () => {
    const instant = '2026-10-24T13:00:00.000Z'
    expect(getLocalDateTimeValue(instant, 'America/La_Paz')).toBe('2026-10-24T09:00')
    expect(getOffsetMinutesAt(instant, 'America/La_Paz')).toBe(-240)
  })
})
