import { describe, expect, it } from 'vitest'
import { daysSince, elapsedSince, journeySummary } from '../../src/journey.js'
import { createMilestoneSchema, updateJourneySchema } from '../../src/shared/schemas/journey.js'

describe('Journey calendar time', () => {
  it('counts the return date as day zero', () => {
    expect(daysSince('2026-11-01', '2026-11-01')).toBe(0)
    expect(daysSince('2026-10-31', '2026-11-01')).toBe(1)
    expect(journeySummary('2026-11-01', '2026-11-01', 'elapsed')).toBe('Hoy')
  })

  it('handles leap days and month ends without rolling into the next month', () => {
    expect(daysSince('2028-02-28', '2028-03-01')).toBe(2)
    expect(elapsedSince('2026-01-31', '2026-02-28')).toEqual({ years: 0, months: 1, days: 0 })
    expect(elapsedSince('2026-01-31', '2026-03-01')).toEqual({ years: 0, months: 1, days: 1 })
    expect(elapsedSince('2024-02-29', '2025-02-28')).toEqual({ years: 1, months: 0, days: 0 })
  })

  it('requires real dates and rejects client-supplied ownership fields', () => {
    expect(updateJourneySchema.safeParse({ returnDate: '2026-02-30' }).success).toBe(false)
    expect(updateJourneySchema.safeParse({}).success).toBe(false)
    expect(createMilestoneSchema.safeParse({ title: 'Graduación', milestoneDate: '2026-11-01', userId: 'other-user' }).success).toBe(false)
  })
})
