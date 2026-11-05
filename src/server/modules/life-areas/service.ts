import type { Database } from '../../db/client.js'
import { and, eq, isNull, max, sql } from 'drizzle-orm'
import { lifeAreas } from '../../db/schema.js'
import type { ReorderLifeAreasInput } from '../../../shared/schemas/life-area.js'
import * as repository from './repository.js'
import { getLifeAreaOrderUpdates } from './domain.js'

export const list = (db: Database, userId: string, archived = false) => repository.listLifeAreas(db, userId, archived)

export async function create(db: Database, userId: string, input: { name: string; icon?: string | null | undefined }) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`)
    const [highest] = await tx.select({ sortOrder: max(lifeAreas.sortOrder) }).from(lifeAreas)
      .where(and(eq(lifeAreas.userId, userId), isNull(lifeAreas.archivedAt)))
    return repository.createLifeArea(tx, userId, { ...input, sortOrder: (highest?.sortOrder ?? -1) + 1 })
  })
}

export async function update(db: Database, userId: string, id: string, input: { name?: string | undefined; icon?: string | null | undefined; sortOrder?: number | undefined }) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`)
    return repository.updateLifeArea(tx, userId, id, input)
  })
}

export async function archive(db: Database, userId: string, id: string) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`)
    return repository.setLifeAreaArchived(tx, userId, id, true)
  })
}

export async function restore(db: Database, userId: string, id: string) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`)
    return repository.setLifeAreaArchived(tx, userId, id, false)
  })
}

export async function reorder(db: Database, userId: string, input: ReorderLifeAreasInput) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`)
    const activeAreas = await tx.select({ id: lifeAreas.id }).from(lifeAreas)
      .where(and(eq(lifeAreas.userId, userId), isNull(lifeAreas.archivedAt)))
      .orderBy(lifeAreas.sortOrder, lifeAreas.createdAt)
    const updates = getLifeAreaOrderUpdates(activeAreas.map((area) => area.id), input.areaIds)
    if (!updates) throw new LifeAreaRuleError()

    const updatedAt = new Date()
    for (const area of updates) {
      await tx.update(lifeAreas).set({ sortOrder: area.sortOrder, updatedAt })
        .where(and(eq(lifeAreas.userId, userId), eq(lifeAreas.id, area.id), isNull(lifeAreas.archivedAt)))
    }

    return repository.listLifeAreas(tx, userId)
  })
}

export class LifeAreaRuleError extends Error {
  readonly code = 'order_changed'
  constructor() { super('order_changed') }
}
