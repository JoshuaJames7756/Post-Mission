import { describe, expect, it } from 'vitest'
import { createEventSchema, eventRangeQuerySchema } from '../../src/shared/schemas/event.js'

describe('event request schemas', () => {
  const event = {
    title: 'Study group',
    category: 'Study',
    color: 'sage',
  }

  it('accepts all-day date ranges without UTC fields', () => {
    expect(createEventSchema.safeParse({
      ...event,
      allDay: true,
      startDate: '2026-10-24',
      endDate: '2026-10-24',
    }).success).toBe(true)
  })

  it('rejects reversed all-day ranges and timed events without an explicit zone offset', () => {
    expect(createEventSchema.safeParse({
      ...event,
      allDay: true,
      startDate: '2026-10-25',
      endDate: '2026-10-24',
    }).success).toBe(false)
    expect(createEventSchema.safeParse({
      ...event,
      allDay: false,
      startLocal: '2026-10-24T09:00',
      endLocal: '2026-10-24T10:00',
      timeZone: 'America/La_Paz',
    }).success).toBe(false)
  })

  it('accepts timed local values only with a zone and offsets', () => {
    expect(createEventSchema.safeParse({
      ...event,
      allDay: false,
      startLocal: '2026-10-24T09:00',
      endLocal: '2026-10-24T10:00',
      timeZone: 'America/La_Paz',
      startOffsetMinutes: -240,
      endOffsetMinutes: -240,
    }).success).toBe(true)
  })

  it('validates calendar query ranges and a required time zone', () => {
    expect(eventRangeQuerySchema.safeParse({ from: '2026-10-01', to: '2026-10-31', timeZone: 'America/La_Paz' }).success).toBe(true)
    expect(eventRangeQuerySchema.safeParse({ from: '2026-10-31', to: '2026-10-01', timeZone: 'America/La_Paz' }).success).toBe(false)
    expect(eventRangeQuerySchema.safeParse({ from: '2026-01-01', to: '2026-04-15', timeZone: 'America/La_Paz' }).success).toBe(false)
    expect(eventRangeQuerySchema.safeParse({ from: '2026-10-01', to: '2026-10-31', timeZone: '' }).success).toBe(false)
  })
})
