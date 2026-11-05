import { describe, expect, it } from 'vitest'
import { addCalendarDays, getCalendarDate, isoDateTimeToLocalInput, localInputToIsoDateTime } from '../../src/date-utils.js'

describe('calendar date helpers', () => {
  it('uses the profile timezone instead of UTC when selecting the calendar day', () => {
    const instant = new Date('2026-10-25T02:30:00.000Z')

    expect(getCalendarDate(instant, 'America/La_Paz')).toBe('2026-10-24')
    expect(getCalendarDate(instant, 'UTC')).toBe('2026-10-25')
  })

  it('adds calendar days without changing the requested day at UTC offsets', () => {
    expect(addCalendarDays('2026-10-24', 1)).toBe('2026-10-25')
    expect(addCalendarDays('2026-10-24', 30)).toBe('2026-11-23')
    expect(addCalendarDays('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('round-trips due dates between the local form and the server timestamp', () => {
    const timestamp = '2026-10-25T02:30:00.000Z'
    const localInput = isoDateTimeToLocalInput(timestamp)

    expect(localInput).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    expect(localInputToIsoDateTime(localInput)).toBe(timestamp)
    expect(localInputToIsoDateTime('')).toBeNull()
  })
})
