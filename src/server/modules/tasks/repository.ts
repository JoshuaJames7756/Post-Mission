import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import type { Database } from '../../db/client.js'
import { tasks } from '../../db/schema.js'

export const listTasks = (db: Database, userId: string, archived = false) => db.select().from(tasks)
  .where(and(eq(tasks.userId, userId), archived ? sql`${tasks.archivedAt} is not null` : isNull(tasks.archivedAt)))
  .orderBy(asc(tasks.dueAt), asc(tasks.createdAt))

export const getTask = (db: Database, userId: string, id: string) => db.select().from(tasks)
  .where(and(eq(tasks.userId, userId), eq(tasks.id, id), isNull(tasks.archivedAt))).limit(1)

export const createTask = async (db: Database, userId: string, input: Omit<typeof tasks.$inferInsert, 'userId'>) => {
  const [created] = await db.insert(tasks).values({ ...input, userId }).returning()
  return created
}

export const updateTask = async (db: Database, userId: string, id: string, values: Partial<Omit<typeof tasks.$inferInsert, 'userId'>>) => {
  const [updated] = await db.update(tasks).set({ ...values, updatedAt: new Date() })
    .where(and(eq(tasks.userId, userId), eq(tasks.id, id), isNull(tasks.archivedAt))).returning()
  return updated
}

export const setTaskArchived = async (db: Database, userId: string, id: string, archived: boolean) => {
  const [updated] = await db.update(tasks).set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(tasks.userId, userId), eq(tasks.id, id), archived ? isNull(tasks.archivedAt) : sql`${tasks.archivedAt} is not null`)).returning()
  return updated
}
