import { describe, expect, it } from 'vitest'
import { filterTasks } from '../../src/task-filters.js'

describe('task filters', () => {
  const tasks = [
    { id: '1', title: 'Llamar a mamá', priority: 'high' as const },
    { id: '2', title: 'Leer un capítulo', priority: 'normal' as const },
    { id: '3', title: 'Preparar la reunión', priority: 'low' as const },
  ]

  it('searches titles without case or accent differences', () => {
    expect(filterTasks(tasks, 'MAMA', 'all').map((task) => task.id)).toEqual(['1'])
  })

  it('filters by priority and combines the search with priority', () => {
    expect(filterTasks(tasks, '', 'high').map((task) => task.id)).toEqual(['1'])
    expect(filterTasks(tasks, 'leer', 'normal').map((task) => task.id)).toEqual(['2'])
    expect(filterTasks(tasks, 'leer', 'high')).toEqual([])
  })

  it('preserves source order and does not mutate the task list', () => {
    const original = [...tasks]

    expect(filterTasks(tasks, '', 'all')).toEqual(original)
    expect(tasks).toEqual(original)
  })
})
