import { and, asc, eq, ilike, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm'
import type { Database } from '../../db/client.js'
import { eventPeople, events, people } from '../../db/schema.js'

export async function listPeople<TDb extends Pick<Database, 'select'>>(db: TDb, userId: string, archived = false, search = '') {
  const pattern = `%${search.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`
  const rows = await db.select().from(people).where(and(
    eq(people.userId, userId),
    archived ? isNotNull(people.archivedAt) : isNull(people.archivedAt),
    search ? or(ilike(people.name, pattern), ilike(sql`${people.relationship}::text`, pattern)) : undefined,
  )).orderBy(asc(people.name), asc(people.createdAt))
  if (rows.length === 0) return []
  const counts = await db.select({ personId: eventPeople.personId, count: sql<number>`count(*)::int` })
    .from(eventPeople).innerJoin(events, and(eq(eventPeople.eventId, events.id), eq(eventPeople.userId, events.userId)))
    .where(and(eq(eventPeople.userId, userId), inArray(eventPeople.personId, rows.map((person) => person.id)), isNull(events.archivedAt)))
    .groupBy(eventPeople.personId)
  const countByPerson = new Map(counts.map((row) => [row.personId, row.count]))
  return rows.map((person) => ({ ...person, linkedEventCount: countByPerson.get(person.id) ?? 0 }))
}

export const getPerson = <TDb extends Pick<Database, 'select'>>(db: TDb, userId: string, id: string) => db.select().from(people)
  .where(and(eq(people.userId, userId), eq(people.id, id), isNull(people.archivedAt))).limit(1)

export function createPerson<TDb extends Pick<Database, 'insert'>>(db: TDb, userId: string, input: { name: string; relationship: 'family' | 'friend' | 'mentor' | 'community' | 'other'; phone?: string | null | undefined; birthday?: string | null | undefined; notes?: string | null | undefined; avatarColor: 'sage' | 'amber' | 'navy' | 'slate' | 'plum' }) {
  return db.insert(people).values({ ...input, userId }).returning()
}

export function updatePerson<TDb extends Pick<Database, 'update'>>(db: TDb, userId: string, id: string, input: { name?: string; relationship?: 'family' | 'friend' | 'mentor' | 'community' | 'other'; phone?: string | null; birthday?: string | null; notes?: string | null; avatarColor?: 'sage' | 'amber' | 'navy' | 'slate' | 'plum' }) {
  return db.update(people).set({ ...input, updatedAt: new Date() })
    .where(and(eq(people.userId, userId), eq(people.id, id), isNull(people.archivedAt))).returning()
}

export function setPersonArchived<TDb extends Pick<Database, 'update'>>(db: TDb, userId: string, id: string, archived: boolean) {
  return db.update(people).set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(people.userId, userId), eq(people.id, id), archived ? isNull(people.archivedAt) : isNotNull(people.archivedAt))).returning()
}

export function listPersonEvents<TDb extends Pick<Database, 'select'>>(db: TDb, userId: string, personId: string) {
  return db.select({ id: events.id, title: events.title, allDay: events.allDay, startDate: events.startDate, startAt: events.startAt, timeZone: events.timeZone })
    .from(eventPeople).innerJoin(events, and(eq(eventPeople.eventId, events.id), eq(eventPeople.userId, events.userId)))
    .where(and(eq(eventPeople.userId, userId), eq(eventPeople.personId, personId), isNull(events.archivedAt)))
    .orderBy(asc(events.startDate), asc(events.startAt))
}

export async function listOwnedActiveEvents<TDb extends Pick<Database, 'select'>>(db: TDb, userId: string, eventIds: string[]) {
  if (eventIds.length === 0) return []
  return db.select({ id: events.id }).from(events).where(and(
    eq(events.userId, userId),
    isNull(events.archivedAt),
    inArray(events.id, eventIds),
  ))
}

export async function replacePersonEvents<TDb extends Pick<Database, 'delete' | 'insert'>>(db: TDb, userId: string, personId: string, eventIds: string[]) {
  await db.delete(eventPeople).where(and(eq(eventPeople.userId, userId), eq(eventPeople.personId, personId)))
  if (eventIds.length === 0) return
  await db.insert(eventPeople).values(eventIds.map((eventId) => ({ userId, eventId, personId })))
}
