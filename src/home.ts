import { addCalendarDays, getCalendarDate } from './date-utils.js'

export type HomeTask = {
  id: string
  title: string
  status: 'open' | 'completed'
  dueAt: string | null
  priority?: 'low' | 'normal' | 'high'
}

export type WeeklyTask = HomeTask & { completedAt: string | null }

export function getWeeklyTaskSummary(tasks: WeeklyTask[], now: Date, timeZone: string) {
  const today = getCalendarDate(now, timeZone)
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay()
  const startDate = addCalendarDays(today, -(weekday === 0 ? 6 : weekday - 1))
  const endDate = addCalendarDays(startDate, 6)
  const inWeek = (instant: string | null) => {
    if (!instant || !Number.isFinite(Date.parse(instant))) return false
    const date = getCalendarDate(new Date(instant), timeZone)
    return date >= startDate && date <= endDate
  }

  return {
    startDate,
    endDate,
    completed: tasks.filter((task) => task.status === 'completed' && inWeek(task.completedAt)).length,
    pending: tasks.filter((task) => task.status === 'open' && inWeek(task.dueAt)).length,
  }
}

const priorityRank = { high: 0, normal: 1, low: 2 } as const

export function getNextTask<T extends HomeTask>(tasks: T[]): T | null {
  return tasks
    .map((task, index) => ({ task, index }))
    .filter(({ task }) => task.status === 'open')
    .sort((left, right) => {
      if (!left.task.dueAt && right.task.dueAt) return 1
      if (left.task.dueAt && !right.task.dueAt) return -1
      const dueDifference = left.task.dueAt && right.task.dueAt
        ? Date.parse(left.task.dueAt) - Date.parse(right.task.dueAt)
        : 0
      const priorityDifference = priorityRank[left.task.priority ?? 'normal'] - priorityRank[right.task.priority ?? 'normal']
      return dueDifference || priorityDifference || left.index - right.index
    })[0]?.task ?? null
}

export function getTodayFocusTasks<T extends HomeTask>(tasks: T[], today: string, timeZone: string, limit = 4): T[] {
  return tasks
    .map((task, index) => ({ task, index }))
    .filter(({ task }) => task.status === 'open' && (!task.dueAt || getCalendarDate(new Date(task.dueAt), timeZone) <= today))
    .sort((left, right) => {
      if (!left.task.dueAt) return right.task.dueAt ? 1 : priorityRank[left.task.priority ?? 'normal'] - priorityRank[right.task.priority ?? 'normal'] || left.index - right.index
      if (!right.task.dueAt) return -1
      return Date.parse(left.task.dueAt) - Date.parse(right.task.dueAt)
        || priorityRank[left.task.priority ?? 'normal'] - priorityRank[right.task.priority ?? 'normal']
        || left.index - right.index
    })
    .slice(0, limit)
    .map(({ task }) => task)
}
