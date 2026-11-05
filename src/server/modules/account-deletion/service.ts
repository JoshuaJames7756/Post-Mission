import { createClerkClient } from '@clerk/backend'
import { eq, lte, sql } from 'drizzle-orm'
import type { Database } from '../../db/client.js'
import { accountDeletions, events, goals, lifeAreas, notes, people, places, profiles, tasks } from '../../db/schema.js'
import type { WorkerBindings } from '../../env.js'

export type DeletionState = 'none' | 'requested' | 'data_deleted' | 'complete'

function nextAttempt(attempts: number, now: Date) {
  return new Date(now.getTime() + Math.min(2 ** Math.min(attempts, 10) * 60_000, 24 * 60 * 60_000))
}

function clerkStatus(error: unknown) {
  return typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number' ? error.status : null
}

async function removeNeonData(db: Database, userId: string) {
  await db.transaction(async (tx) => {
    const lock = await tx.execute(sql`select state from account_deletions where user_id = ${userId} for update`)
    if (lock.rows[0]?.state !== 'requested') return
    await tx.delete(notes).where(eq(notes.userId, userId))
    await tx.delete(tasks).where(eq(tasks.userId, userId))
    await tx.delete(events).where(eq(events.userId, userId))
    await tx.update(goals).set({ parentGoalId: null }).where(eq(goals.userId, userId))
    await tx.delete(goals).where(eq(goals.userId, userId))
    await tx.delete(lifeAreas).where(eq(lifeAreas.userId, userId))
    await tx.delete(people).where(eq(people.userId, userId))
    await tx.delete(places).where(eq(places.userId, userId))
    await tx.delete(profiles).where(eq(profiles.userId, userId))
    await tx.update(accountDeletions).set({ state: 'data_deleted', updatedAt: new Date() })
      .where(eq(accountDeletions.userId, userId))
  })
}

export async function processAccountDeletion(db: Database, env: WorkerBindings, userId: string): Promise<DeletionState> {
  const [job] = await db.select().from(accountDeletions).where(eq(accountDeletions.userId, userId)).limit(1)
  if (!job) return 'none'
  if (job.state === 'requested') {
    try { await removeNeonData(db, userId) }
    catch (error) {
      console.error('account_data_cleanup_error', { name: error instanceof Error ? error.name : 'UnknownError' })
      await scheduleRetry(db, userId, job.attempts)
      return 'requested'
    }
  }
  if (!env.CLERK_SECRET_KEY) return 'data_deleted'
  try {
    const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY })
    await clerk.users.deleteUser(userId)
  } catch (error) {
    if (clerkStatus(error) !== 404) {
      console.error('account_identity_cleanup_error', { name: error instanceof Error ? error.name : 'UnknownError', status: clerkStatus(error) })
      const [current] = await db.select({ attempts: accountDeletions.attempts }).from(accountDeletions)
        .where(eq(accountDeletions.userId, userId)).limit(1)
      await scheduleRetry(db, userId, current?.attempts ?? 0)
      return 'data_deleted'
    }
  }
  await db.delete(accountDeletions).where(eq(accountDeletions.userId, userId))
  return 'complete'
}

async function scheduleRetry(db: Database, userId: string, previousAttempts: number) {
  const now = new Date()
  const attempts = previousAttempts + 1
  await db.update(accountDeletions).set({ attempts, nextAttemptAt: nextAttempt(attempts, now), updatedAt: now })
    .where(eq(accountDeletions.userId, userId))
}

export async function retryPendingAccountDeletions(db: Database, env: WorkerBindings) {
  if (!env.CLERK_SECRET_KEY) return
  const pending = await db.select({ userId: accountDeletions.userId }).from(accountDeletions)
    .where(lte(accountDeletions.nextAttemptAt, new Date())).limit(10)
  for (const job of pending) {
    try { await processAccountDeletion(db, env, job.userId) }
    catch (error) { console.error('account_cleanup_retry_error', { name: error instanceof Error ? error.name : 'UnknownError' }) }
  }
}
