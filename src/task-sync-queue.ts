export type PendingTask = { id: string; status: 'open' | 'completed' }

const storageKey = (userId: string) => `postmission:task-sync:${userId}`

export function readPendingTasks(userId: string): PendingTask[] {
  if (!userId) return []
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey(userId)) ?? '[]')
    if (!Array.isArray(value)) return []
    return value.filter((item): item is PendingTask => Boolean(item && typeof item.id === 'string' && (item.status === 'open' || item.status === 'completed')))
  } catch { return [] }
}

export function writePendingTasks(userId: string, pending: PendingTask[]): boolean {
  if (!userId) return false
  try { localStorage.setItem(storageKey(userId), JSON.stringify(pending)); return true }
  catch { return false }
}

export function upsertPendingTask(pending: PendingTask[], next: PendingTask): PendingTask[] {
  return [...pending.filter((item) => item.id !== next.id), next]
}

export function applyPendingTasks<T extends { id: string; status: 'open' | 'completed'; completedAt: string | null }>(tasks: T[], pending: PendingTask[]): T[] {
  const statusById = new Map(pending.map((item) => [item.id, item.status]))
  return tasks.map((task) => {
    const status = statusById.get(task.id)
    return status ? { ...task, status, completedAt: status === 'completed' ? task.completedAt ?? new Date().toISOString() : null } : task
  })
}
