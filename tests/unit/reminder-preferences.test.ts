import { describe, expect, it } from 'vitest'
import { reminderCategorySchema, reminderPreferencesSchema } from '../../src/shared/schemas/reminder.js'

describe('reminder inputs', () => {
  it('allows one independent boolean preference', () => {
    expect(reminderPreferencesSchema.parse({ remindEvents: false })).toEqual({ remindEvents: false })
    expect(reminderPreferencesSchema.parse({ remindReviews: true })).toEqual({ remindReviews: true })
  })

  it('rejects empty, unknown, and nonboolean preference changes', () => {
    expect(reminderPreferencesSchema.safeParse({}).success).toBe(false)
    expect(reminderPreferencesSchema.safeParse({ userId: 'other', remindTasks: true }).success).toBe(false)
    expect(reminderPreferencesSchema.safeParse({ remindTasks: 'false' }).success).toBe(false)
  })

  it('accepts only known categories for dismissal', () => {
    expect(reminderCategorySchema.safeParse('tasks').success).toBe(true)
    expect(reminderCategorySchema.safeParse('people').success).toBe(false)
  })
})
