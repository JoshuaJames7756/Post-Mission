import { and, asc, eq, ilike, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm'
import type { Database } from '../../db/client.js'
import { eventPlaces, events, places } from '../../db/schema.js'

export function listPlaces<TDb extends Pick<Database, 'select'>>(db: TDb, userId: string, archived = false, search = '') {
  const pattern = `%${search.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`
  return db.select().from(places).where(and(
    eq(places.userId, userId),
    archived ? isNotNull(places.archivedAt) : isNull(places.archivedAt),
    search ? or(ilike(places.name, pattern), ilike(sql`${places.type}::text`, pattern), ilike(places.address, pattern)) : undefined,
  )).orderBy(asc(places.name), asc(places.createdAt))
}

export const getPlace = <TDb extends Pick<Database, 'select'>>(db: TDb, userId: string, id: string) => db.select().from(places)
  .where(and(eq(places.userId, userId), eq(places.id, id), isNull(places.archivedAt))).limit(1)

export function createPlace<TDb extends Pick<Database, 'insert'>>(db: TDb, userId: string, input: { name: string; type: 'home' | 'church' | 'work' | 'school' | 'community' | 'other'; address: string | null; latitude: number | null; longitude: number | null }) {
  return db.insert(places).values({ ...input, userId }).returning()
}

export function updatePlace<TDb extends Pick<Database, 'update'>>(db: TDb, userId: string, id: string, input: { name?: string; type?: 'home' | 'church' | 'work' | 'school' | 'community' | 'other'; address?: string | null; latitude?: number | null; longitude?: number | null }) {
  return db.update(places).set({ ...input, updatedAt: new Date() })
    .where(and(eq(places.userId, userId), eq(places.id, id), isNull(places.archivedAt))).returning()
}

export function setPlaceArchived<TDb extends Pick<Database, 'update'>>(db: TDb, userId: string, id: string, archived: boolean) {
  return db.update(places).set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(places.userId, userId), eq(places.id, id), archived ? isNull(places.archivedAt) : isNotNull(places.archivedAt))).returning()
}

export function listPlaceEvents<TDb extends Pick<Database, 'select'>>(db: TDb, userId: string, placeId: string) {
  return db.select({ id: events.id, title: events.title, allDay: events.allDay, startDate: events.startDate, startAt: events.startAt, timeZone: events.timeZone })
    .from(eventPlaces).innerJoin(events, and(eq(eventPlaces.eventId, events.id), eq(eventPlaces.userId, events.userId)))
    .where(and(eq(eventPlaces.userId, userId), eq(eventPlaces.placeId, placeId), isNull(events.archivedAt)))
    .orderBy(asc(events.startDate), asc(events.startAt))
}

export async function listOwnedActiveEvents<TDb extends Pick<Database, 'select'>>(db: TDb, userId: string, eventIds: string[]) {
  if (eventIds.length === 0) return []
  return db.select({ id: events.id }).from(events).where(and(
    eq(events.userId, userId), isNull(events.archivedAt), inArray(events.id, eventIds),
  ))
}

export async function replacePlaceEvents<TDb extends Pick<Database, 'delete' | 'insert'>>(db: TDb, userId: string, placeId: string, eventIds: string[]) {
  await db.delete(eventPlaces).where(and(eq(eventPlaces.userId, userId), eq(eventPlaces.placeId, placeId)))
  if (eventIds.length === 0) return
  await db.insert(eventPlaces).values(eventIds.map((eventId) => ({ userId, eventId, placeId })))
}
