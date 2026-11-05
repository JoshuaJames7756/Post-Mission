import { getTableConfig } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import { reviews } from '../../src/server/db/schema.js'
import { movePeriod, periodStart, weekStart } from '../../src/review-period.js'
import { saveReviewSchema } from '../../src/shared/schemas/review.js'

describe('review periods and integrity', () => {
  it('anchors weeks on Monday across month, year and daylight-saving boundaries', () => {
    expect(weekStart('2026-11-01')).toBe('2026-10-26')
    expect(weekStart('2027-01-01')).toBe('2026-12-28')
    expect(weekStart('2026-03-29')).toBe('2026-03-23')
    expect(periodStart('2026-11-01', 'daily')).toBe('2026-11-01')
    expect(movePeriod('2026-10-26', 'weekly', 1)).toBe('2026-11-02')
  })

  it('enforces one review per owner and period with valid completion shape', () => {
    const config = getTableConfig(reviews)
    expect(config.uniqueConstraints.map((item) => item.name)).toContain('reviews_user_period_unique')
    expect(config.checks.map((item) => item.name)).toEqual(expect.arrayContaining(['reviews_week_start_check', 'reviews_completion_shape_check']))
    expect(config.foreignKeys).toHaveLength(1)
  })

  it('rejects client-supplied status, owner and oversized text', () => {
    const valid = { wins: '', challenges: '', reflection: '', nextSteps: '', baseRevision: 0 }
    expect(saveReviewSchema.safeParse(valid).success).toBe(true)
    expect(saveReviewSchema.safeParse({ ...valid, userId: 'other' }).success).toBe(false)
    expect(saveReviewSchema.safeParse({ ...valid, status: 'completed' }).success).toBe(false)
    expect(saveReviewSchema.safeParse({ ...valid, wins: 'x'.repeat(5001) }).success).toBe(false)
  })
})
