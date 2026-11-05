import { describe, expect, it } from 'vitest'
import { isGoalChildCompatible } from '../../src/server/modules/goals/domain.js'
import { createGoalSchema, updateGoalSchema } from '../../src/shared/schemas/goal.js'

describe('goal hierarchy rules', () => {
  const year = { periodType: 'year' as const, startDate: '2026-01-01', targetDate: '2026-12-31' }

  it('allows only the immediately lower period when dates fit inside the parent', () => {
    expect(isGoalChildCompatible(year, { periodType: 'month', startDate: '2026-03-01', targetDate: '2026-03-31' })).toBe(true)
    expect(isGoalChildCompatible(year, { periodType: 'week', startDate: '2026-03-01', targetDate: '2026-03-07' })).toBe(false)
    expect(isGoalChildCompatible(year, { periodType: 'month', startDate: '2025-12-01', targetDate: '2026-01-31' })).toBe(false)
  })

  it('rejects a goal whose target date precedes its start', () => {
    expect(createGoalSchema.safeParse({ ...year, title: 'Meta', targetDate: '2025-12-31' }).success).toBe(false)
  })

  it('allows partial date updates but rejects an inverted date pair', () => {
    expect(updateGoalSchema.safeParse({ startDate: '2026-04-01' }).success).toBe(true)
    expect(updateGoalSchema.safeParse({ startDate: '2026-04-02', targetDate: '2026-04-01' }).success).toBe(false)
  })
})
