import { and, asc, desc, eq, gte, gt, isNotNull, isNull, lt, lte, ne, or, sql } from 'drizzle-orm'
import type { Database } from '../../db/client.js'
import { events } from '../../db/schema.js'

export function listEvents(
  db: Database,
  userId: string,
  range: { from: string; to: string; startAt: Date; endAt: Date },
  archived = false,
) {
  const allDayOverlap = and(eq(events.allDay, true), lte(events.startDate, range.to), gte(events.endDate, range.from))
  const timedOverlap = and(eq(events.allDay, false), lt(events.startAt, range.endAt), gt(events.endAt, range.startAt))
  return db.select().from(events).where(and(
    eq(events.userId, userId),
    archived ? isNotNull(events.archivedAt) : isNull(events.archivedAt),
    archived ? undefined : ne(events.status, 'cancelled'),
    or(allDayOverlap, timedOverlap),
  )).orderBy(desc(events.allDay), asc(events.startDate), asc(events.startAt), asc(events.createdAt))
}

export const getEvent = (db: Database, userId: string, id: string) => db.select().from(events)
  .where(and(eq(events.userId, userId), eq(events.id, id), isNull(events.archivedAt))).limit(1)

export async function createEvent(db: Database, userId: string, input: Omit<typeof events.$inferInsert, 'userId'>) {
  const [created] = await db.insert(events).values({ ...input, userId }).returning()
  return created
}

export async function updateEvent(db: Database, userId: string, id: string, values: Partial<Omit<typeof events.$inferInsert, 'userId'>>) {
  const [updated] = await db.update(events).set({ ...values, updatedAt: new Date() })
    .where(and(eq(events.userId, userId), eq(events.id, id), isNull(events.archivedAt))).returning()
  return updated
}

export async function setEventStatus(db: Database, userId: string, id: string, status: 'scheduled' | 'completed' | 'cancelled') {
  const [updated] = await db.update(events).set({
    status,
    completedAt: status === 'completed' ? new Date() : null,
    updatedAt: new Date(),
  }).where(and(eq(events.userId, userId), eq(events.id, id), isNull(events.archivedAt))).returning()
  return updated
}

export async function setEventArchived(db: Database, userId: string, id: string, archived: boolean) {
  const [updated] = await db.update(events).set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(events.userId, userId), eq(events.id, id), archived ? isNull(events.archivedAt) : sql`${events.archivedAt} is not null`)).returning()
  return updated
}
