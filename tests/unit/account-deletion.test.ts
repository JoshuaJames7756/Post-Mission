import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Database } from '../../src/server/db/client.js'
import { accountDeletions } from '../../src/server/db/schema.js'
import { processAccountDeletion } from '../../src/server/modules/account-deletion/service.js'

const { deleteUser } = vi.hoisted(() => ({ deleteUser: vi.fn() }))
vi.mock('@clerk/backend', () => ({ createClerkClient: () => ({ users: { deleteUser } }) }))

function fakeDatabase(initialState: 'requested' | 'data_deleted', failDataCleanup = false) {
  const job = { userId: 'user_test_delete', state: initialState, attempts: 0, nextAttemptAt: new Date() }
  const deleted: string[] = []
  const update = (table: unknown) => ({ set: (value: Record<string, unknown>) => ({ where: async () => {
    if (table === accountDeletions) Object.assign(job, value)
  } }) })
  const tx = {
    execute: async () => ({ rows: [{ state: job.state }] }),
    delete: (table: { [key: string]: unknown }) => ({ where: async () => {
      if (failDataCleanup) throw new Error('database unavailable')
      deleted.push(String(table[Symbol.for('drizzle:Name')] ?? 'table'))
    } }),
    update,
  }
  const db = {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ ...job }] }) }) }),
    transaction: async (callback: (transaction: typeof tx) => Promise<void>) => callback(tx),
    update,
    delete: () => ({ where: async () => { deleted.push('account_deletions'); job.state = 'complete' as typeof job.state } }),
  } as unknown as Database
  return { db, job, deleted }
}

describe('account deletion recovery', () => {
  beforeEach(() => deleteUser.mockReset())

  it('keeps the job and schedules a retry if Neon cleanup fails', async () => {
    const { db, job, deleted } = fakeDatabase('requested', true)
    const result = await processAccountDeletion(db, { CLERK_SECRET_KEY: 'test' } as never, job.userId)
    expect(result).toBe('requested')
    expect(job.attempts).toBe(1)
    expect(job.nextAttemptAt.getTime()).toBeGreaterThan(Date.now())
    expect(deleted).toEqual([])
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('retries Clerk after data cleanup and finishes only when identity deletion succeeds', async () => {
    const { db, job, deleted } = fakeDatabase('requested')
    deleteUser.mockRejectedValueOnce({ status: 503 }).mockResolvedValueOnce(undefined)
    const first = await processAccountDeletion(db, { CLERK_SECRET_KEY: 'test' } as never, job.userId)
    expect(first).toBe('data_deleted')
    expect(job.state).toBe('data_deleted')
    expect(job.attempts).toBe(1)
    expect(deleted).not.toContain('account_deletions')

    const second = await processAccountDeletion(db, { CLERK_SECRET_KEY: 'test' } as never, job.userId)
    expect(second).toBe('complete')
    expect(deleteUser).toHaveBeenCalledTimes(2)
    expect(deleted.at(-1)).toBe('account_deletions')
  })

  it('treats an identity already removed from Clerk as an idempotent completion', async () => {
    const { db, job, deleted } = fakeDatabase('data_deleted')
    deleteUser.mockRejectedValueOnce({ status: 404 })
    const result = await processAccountDeletion(db, { CLERK_SECRET_KEY: 'test' } as never, job.userId)
    expect(result).toBe('complete')
    expect(deleted).toEqual(['account_deletions'])
  })

  it('does not claim completion when the Clerk secret is unavailable', async () => {
    const { db, job, deleted } = fakeDatabase('data_deleted')
    const result = await processAccountDeletion(db, {} as never, job.userId)
    expect(result).toBe('data_deleted')
    expect(deleted).toEqual([])
    expect(deleteUser).not.toHaveBeenCalled()
  })
})
