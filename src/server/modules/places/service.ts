import { and, eq, isNull } from 'drizzle-orm'
import type { Database } from '../../db/client.js'
import { places } from '../../db/schema.js'
import type { CreatePlaceInput, UpdatePlaceInput } from '../../../shared/schemas/place.js'
import * as repository from './repository.js'

export class PlaceRuleError extends Error {
  readonly code = 'invalid_event'
  constructor() { super('invalid_event') }
}

export const list = (db: Database, userId: string, archived = false, search = '') => repository.listPlaces(db, userId, archived, search)
export const get = (db: Database, userId: string, id: string) => repository.getPlace(db, userId, id)
export const create = (db: Database, userId: string, input: CreatePlaceInput) => repository.createPlace(db, userId, {
  name: input.name, type: input.type, address: input.address ?? null,
  latitude: input.latitude ?? null, longitude: input.longitude ?? null,
})
export const update = (db: Database, userId: string, id: string, input: UpdatePlaceInput) => {
  const values = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Parameters<typeof repository.updatePlace>[3]
  return repository.updatePlace(db, userId, id, values)
}
export const archive = (db: Database, userId: string, id: string) => repository.setPlaceArchived(db, userId, id, true)
export const restore = (db: Database, userId: string, id: string) => repository.setPlaceArchived(db, userId, id, false)

export async function listEvents(db: Database, userId: string, placeId: string) {
  const [place] = await repository.getPlace(db, userId, placeId)
  if (!place) return null
  return repository.listPlaceEvents(db, userId, placeId)
}

export async function replaceEvents(db: Database, userId: string, placeId: string, eventIds: string[]) {
  return db.transaction(async (tx) => {
    const [place] = await tx.select({ id: places.id }).from(places).where(and(
      eq(places.userId, userId), eq(places.id, placeId), isNull(places.archivedAt),
    )).limit(1)
    if (!place) return null
    const uniqueEventIds = [...new Set(eventIds)]
    const ownedEvents = await repository.listOwnedActiveEvents(tx, userId, uniqueEventIds)
    if (ownedEvents.length !== uniqueEventIds.length) throw new PlaceRuleError()
    await repository.replacePlaceEvents(tx, userId, placeId, uniqueEventIds)
    return repository.listPlaceEvents(tx, userId, placeId)
  })
}
