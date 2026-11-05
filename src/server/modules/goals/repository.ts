import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import type { Database } from '../../db/client.js'
import { goals } from '../../db/schema.js'

export const listGoals = (db: Database, userId: string, archived = false) => db.select().from(goals)
  .where(and(eq(goals.userId, userId), archived ? sql`${goals.archivedAt} is not null` : isNull(goals.archivedAt)))
  .orderBy(asc(goals.startDate), asc(goals.createdAt))

export const getGoal = (db: Database, userId: string, id: string) => db.select().from(goals)
  .where(and(eq(goals.userId, userId), eq(goals.id, id), isNull(goals.archivedAt))).limit(1)

export async function createGoal<TDb extends Pick<Database, 'insert'>>(db: TDb, userId: string, input: Omit<typeof goals.$inferInsert, 'userId'>) {
  const [created] = await db.insert(goals).values({ ...input, userId }).returning()
  return created
}

export async function updateGoal<TDb extends Pick<Database, 'update'>>(db: TDb, userId: string, id: string, values: Partial<Omit<typeof goals.$inferInsert, 'userId'>>) {
  const [updated] = await db.update(goals).set({ ...values, updatedAt: new Date() })
    .where(and(eq(goals.userId, userId), eq(goals.id, id), isNull(goals.archivedAt))).returning()
  return updated
}

export async function setGoalState(db: Database, userId: string, id: string, status: 'active' | 'completed') {
  const [updated] = await db.update(goals).set({
    status,
    completedAt: status === 'completed' ? new Date() : null,
    updatedAt: new Date(),
  }).where(and(eq(goals.userId, userId), eq(goals.id, id), isNull(goals.archivedAt))).returning()
  return updated
}

export async function setGoalArchived<TDb extends Pick<Database, 'update'>>(db: TDb, userId: string, id: string, archived: boolean) {
  const [updated] = await db.update(goals).set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(goals.userId, userId), eq(goals.id, id), archived ? isNull(goals.archivedAt) : sql`${goals.archivedAt} is not null`)).returning()
  return updated
}
