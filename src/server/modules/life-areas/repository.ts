import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm'
import type { Database } from '../../db/client.js'
import { lifeAreas } from '../../db/schema.js'

export function listLifeAreas<TDb extends Pick<Database, 'select'>>(db: TDb, userId: string, archived = false) {
  return db.select().from(lifeAreas)
    .where(and(eq(lifeAreas.userId, userId), archived ? isNotNull(lifeAreas.archivedAt) : isNull(lifeAreas.archivedAt)))
    .orderBy(asc(lifeAreas.sortOrder), asc(lifeAreas.createdAt))
}

export function createLifeArea<TDb extends Pick<Database, 'insert'>>(db: TDb, userId: string, input: { name: string; icon?: string | null | undefined; sortOrder?: number }) {
  return db.insert(lifeAreas).values({
    userId,
    name: input.name,
    icon: input.icon ?? null,
    ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
  }).returning()
}

export function updateLifeArea<TDb extends Pick<Database, 'update'>>(db: TDb, userId: string, id: string, input: { name?: string | undefined; icon?: string | null | undefined; sortOrder?: number | undefined }) {
  return db.update(lifeAreas).set({ ...input, updatedAt: new Date() })
    .where(and(eq(lifeAreas.userId, userId), eq(lifeAreas.id, id), isNull(lifeAreas.archivedAt)))
    .returning()
}

export function setLifeAreaArchived<TDb extends Pick<Database, 'update'>>(db: TDb, userId: string, id: string, archived: boolean) {
  return db.update(lifeAreas).set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(lifeAreas.userId, userId), eq(lifeAreas.id, id), archived ? isNull(lifeAreas.archivedAt) : isNotNull(lifeAreas.archivedAt)))
    .returning()
}
