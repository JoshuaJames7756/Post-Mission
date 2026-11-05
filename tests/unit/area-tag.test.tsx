// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AreaTag } from '../../src/area-tag.js'
import { areaForGoal, areaTone } from '../../src/area-colors.js'

describe('area colors', () => {
  it('uses a stable subtle tone and resolves a goal area', () => {
    expect(areaTone('Físico')).toBe('physical')
    expect(areaTone('Espiritual')).toBe('spiritual')
    expect(areaTone('Social')).toBe('social')
    expect(areaTone('Intelectual')).toBe('intellectual')
    expect(areaForGoal('goal-1', [{ id: 'goal-1', lifeAreaId: 'area-1' }], [{ id: 'area-1', name: 'Espiritual' }])).toEqual({ id: 'area-1', name: 'Espiritual' })
    expect(renderToStaticMarkup(<AreaTag name="Físico" />)).toContain('area-tag-physical')
  })
})
