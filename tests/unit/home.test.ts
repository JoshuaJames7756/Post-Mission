import { describe, expect, it } from 'vitest'
import { getNextTask, getTodayFocusTasks, getWeeklyTaskSummary, type WeeklyTask } from '../../src/home.js'

describe('home next-task selection', () => {
  const task = (id: string, status: 'open' | 'completed', dueAt: string | null, priority: 'low' | 'normal' | 'high' = 'normal') => ({ id, title: id, status, dueAt, priority })

  it('chooses the earliest open task and skips completed tasks', () => {
    const nextTask = getNextTask([
      task('completed', 'completed', '2026-10-01T09:00:00.000Z'),
      task('later', 'open', '2026-10-26T09:00:00.000Z'),
      task('next', 'open', '2026-10-25T09:00:00.000Z'),
    ])

    expect(nextTask?.id).toBe('next')
  })

  it('places tasks without a due date after scheduled tasks and returns null when none are open', () => {
    expect(getNextTask([task('unscheduled', 'open', null)])?.id).toBe('unscheduled')
    expect(getNextTask([task('completed', 'completed', null)])).toBeNull()
  })

  it('uses priority to break equal due-date ties and to order unscheduled tasks', () => {
    expect(getNextTask([
      task('normal', 'open', '2026-10-25T09:00:00.000Z'),
      task('high', 'open', '2026-10-25T09:00:00.000Z', 'high'),
    ])?.id).toBe('high')

    expect(getNextTask([
      task('low', 'open', null, 'low'),
      task('normal', 'open', null),
      task('high', 'open', null, 'high'),
    ])?.id).toBe('high')
  })
})

describe('home focus', () => {
  it('shows overdue, today and unscheduled tasks without pulling future tasks into today', () => {
    const tasks = [
      { id: 'future', title: 'Future', status: 'open' as const, dueAt: '2026-11-04T12:00:00Z', priority: 'high' as const },
      { id: 'unscheduled', title: 'Unscheduled', status: 'open' as const, dueAt: null, priority: 'high' as const },
      { id: 'today', title: 'Today', status: 'open' as const, dueAt: '2026-11-04T03:00:00Z', priority: 'normal' as const },
      { id: 'overdue', title: 'Overdue', status: 'open' as const, dueAt: '2026-11-02T12:00:00Z', priority: 'low' as const },
    ]
    expect(getTodayFocusTasks(tasks, '2026-11-03', 'America/La_Paz').map((task) => task.id)).toEqual(['overdue', 'today', 'unscheduled'])
  })
})

describe('weekly home activity', () => {
  const task = (id: string, status: WeeklyTask['status'], dueAt: string | null, completedAt: string | null): WeeklyTask => ({ id, title: id, status, dueAt, completedAt })

  it('uses the profile week and the actual completion instant across timezones', () => {
    const tasks = [
      task('done-sunday', 'completed', null, '2026-11-02T03:30:00Z'),
      task('done-monday', 'completed', null, '2026-10-26T03:30:00Z'),
      task('due-sunday', 'open', '2026-11-02T03:30:00Z', null),
      task('due-next-week', 'open', '2026-11-02T04:30:00Z', null),
      task('reopened', 'open', null, '2026-10-28T12:00:00Z'),
    ]
    expect(getWeeklyTaskSummary(tasks, new Date('2026-11-01T12:00:00Z'), 'America/La_Paz')).toEqual({
      startDate: '2026-10-26', endDate: '2026-11-01', completed: 1, pending: 1,
    })
    expect(getWeeklyTaskSummary(tasks, new Date('2026-11-01T12:00:00Z'), 'Asia/Tokyo')).toEqual({
      startDate: '2026-10-26', endDate: '2026-11-01', completed: 1, pending: 0,
    })
  })

  it('handles a week crossing a year boundary', () => {
    expect(getWeeklyTaskSummary([task('new-year', 'completed', null, '2027-01-01T12:00:00Z')], new Date('2027-01-01T12:00:00Z'), 'UTC')).toEqual({
      startDate: '2026-12-28', endDate: '2027-01-03', completed: 1, pending: 0,
    })
  })
})
