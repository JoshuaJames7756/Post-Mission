export type TaskPriorityFilter = 'all' | 'low' | 'normal' | 'high'

function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es').trim()
}

export function filterTasks<T extends { title: string; priority: Exclude<TaskPriorityFilter, 'all'> }>(
  tasks: readonly T[],
  search: string,
  priority: TaskPriorityFilter,
): T[] {
  const query = normalizeSearch(search)

  return tasks.filter((task) => {
    const matchesTitle = !query || normalizeSearch(task.title).includes(query)
    const matchesPriority = priority === 'all' || task.priority === priority
    return matchesTitle && matchesPriority
  })
}
