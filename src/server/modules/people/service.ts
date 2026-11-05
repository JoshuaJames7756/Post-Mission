import { and, eq, isNull } from 'drizzle-orm'
import type { Database } from '../../db/client.js'
import { people } from '../../db/schema.js'
import type { CreatePersonInput, UpdatePersonInput } from '../../../shared/schemas/person.js'
import * as repository from './repository.js'

export class PersonRuleError extends Error {
  readonly code = 'invalid_event'
  constructor() { super('invalid_event') }
}

export const list = (db: Database, userId: string, archived = false, search = '') => repository.listPeople(db, userId, archived, search)
export const get = (db: Database, userId: string, id: string) => repository.getPerson(db, userId, id)
export const create = (db: Database, userId: string, input: CreatePersonInput) => repository.createPerson(db, userId, input)
export const update = (db: Database, userId: string, id: string, input: UpdatePersonInput) => {
  const values = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Parameters<typeof repository.updatePerson>[3]
  return repository.updatePerson(db, userId, id, values)
}
export const archive = (db: Database, userId: string, id: string) => repository.setPersonArchived(db, userId, id, true)
export const restore = (db: Database, userId: string, id: string) => repository.setPersonArchived(db, userId, id, false)

export async function listEvents(db: Database, userId: string, personId: string) {
  const [person] = await repository.getPerson(db, userId, personId)
  if (!person) return null
  return repository.listPersonEvents(db, userId, personId)
}

export async function replaceEvents(db: Database, userId: string, personId: string, eventIds: string[]) {
  return db.transaction(async (tx) => {
    const [person] = await tx.select({ id: people.id }).from(people).where(and(
      eq(people.userId, userId), eq(people.id, personId), isNull(people.archivedAt),
    )).limit(1)
    if (!person) return null
    const uniqueEventIds = [...new Set(eventIds)]
    const ownedEvents = await repository.listOwnedActiveEvents(tx, userId, uniqueEventIds)
    if (ownedEvents.length !== uniqueEventIds.length) throw new PersonRuleError()
    await repository.replacePersonEvents(tx, userId, personId, uniqueEventIds)
    return repository.listPersonEvents(tx, userId, personId)
  })
}
