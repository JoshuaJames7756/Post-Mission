// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { applyPendingTasks, readPendingTasks, upsertPendingTask, writePendingTasks } from '../../src/task-sync-queue.js'

afterEach(() => localStorage.clear())

it('keeps only the latest offline decision per task and scopes it to the account', () => {
  const pending = upsertPendingTask(upsertPendingTask([], { id: 'task-1', status: 'completed' }), { id: 'task-1', status: 'open' })
  expect(pending).toEqual([{ id: 'task-1', status: 'open' }])
  expect(writePendingTasks('user-a', pending)).toBe(true)
  expect(readPendingTasks('user-a')).toEqual(pending)
  expect(readPendingTasks('user-b')).toEqual([])
})

it('shows the pending result without changing the server snapshot', () => {
  const serverTasks = [{ id: 'task-1', status: 'open' as const, completedAt: null }]
  const visible = applyPendingTasks(serverTasks, [{ id: 'task-1', status: 'completed' }])
  expect(visible[0]?.status).toBe('completed')
  expect(visible[0]?.completedAt).toBeTruthy()
  expect(serverTasks[0]?.status).toBe('open')
})
