import { describe, expect, it } from 'vitest'
import { getLifeAreaOrderUpdates } from '../../src/server/modules/life-areas/domain.js'
import { reorderLifeAreasSchema } from '../../src/shared/schemas/life-area.js'

describe('life-area ordering', () => {
  const first = '11111111-1111-4111-8111-111111111111'
  const second = '22222222-2222-4222-8222-222222222222'
  const third = '33333333-3333-4333-8333-333333333333'

  it('creates stable sequential sort values for a valid reorder', () => {
    expect(getLifeAreaOrderUpdates([first, second, third], [third, first, second])).toEqual([
      { id: third, sortOrder: 0 },
      { id: first, sortOrder: 1 },
      { id: second, sortOrder: 2 },
    ])
  })

  it('rejects stale or incomplete area lists without exposing another owner’s IDs', () => {
    expect(getLifeAreaOrderUpdates([first, second], [first])).toBeNull()
    expect(getLifeAreaOrderUpdates([first, second], [first, third])).toBeNull()
    expect(getLifeAreaOrderUpdates([first, second], [first, first])).toBeNull()
  })

  it('validates reorder request shape and duplicate IDs', () => {
    expect(reorderLifeAreasSchema.safeParse({ areaIds: [first, second] }).success).toBe(true)
    expect(reorderLifeAreasSchema.safeParse({ areaIds: [first, first] }).success).toBe(false)
    expect(reorderLifeAreasSchema.safeParse({ areaIds: [] }).success).toBe(false)
  })
})
