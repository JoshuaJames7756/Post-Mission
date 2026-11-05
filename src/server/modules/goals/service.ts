import { and, eq, isNull, sql } from 'drizzle-orm'
import type { Database } from '../../db/client.js'
import { goals, lifeAreas } from '../../db/schema.js'
import type { CreateGoalInput, UpdateGoalInput } from '../../../shared/schemas/goal.js'
import * as repository from './repository.js'
import { isGoalChildCompatible } from './domain.js'

export class GoalRuleError extends Error {
  readonly code: 'invalid_parent' | 'invalid_area' | 'goal_has_children' | 'goal_not_found' | 'invalid_dates' | 'restore_conflict'
  constructor(code: 'invalid_parent' | 'invalid_area' | 'goal_has_children' | 'goal_not_found' | 'invalid_dates' | 'restore_conflict') { super(code); this.code = code }
}

export const list = (db: Database, userId: string, archived = false) => repository.listGoals(db, userId, archived)
export const get = (db: Database, userId: string, id: string) => repository.getGoal(db, userId, id)

export async function create(db: Database, userId: string, input: CreateGoalInput) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`)
    if (input.lifeAreaId) {
      const [area] = await tx.select({ id: lifeAreas.id }).from(lifeAreas).where(and(eq(lifeAreas.id, input.lifeAreaId), eq(lifeAreas.userId, userId), isNull(lifeAreas.archivedAt))).limit(1)
      if (!area) throw new GoalRuleError('invalid_area')
    }
    if (input.parentGoalId) {
      const [parent] = await tx.select().from(goals).where(and(eq(goals.id, input.parentGoalId), eq(goals.userId, userId), isNull(goals.archivedAt))).limit(1)
      if (!parent || !isGoalChildCompatible(parent, input)) throw new GoalRuleError('invalid_parent')
    }
    return repository.createGoal(tx, userId, input)
  })
}

export async function update(db: Database, userId: string, id: string, input: UpdateGoalInput) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`)
    const [current] = await tx.select().from(goals).where(and(eq(goals.id, id), eq(goals.userId, userId), isNull(goals.archivedAt))).limit(1)
    if (!current) throw new GoalRuleError('goal_not_found')
    const next: Pick<typeof current, 'periodType' | 'startDate' | 'targetDate' | 'lifeAreaId' | 'parentGoalId'> = {
      periodType: input.periodType ?? current.periodType,
      startDate: input.startDate ?? current.startDate,
      targetDate: input.targetDate ?? current.targetDate,
      lifeAreaId: input.lifeAreaId === undefined ? current.lifeAreaId : input.lifeAreaId,
      parentGoalId: input.parentGoalId === undefined ? current.parentGoalId : input.parentGoalId,
    }
    if (next.targetDate < next.startDate) throw new GoalRuleError('invalid_dates')
    if (next.lifeAreaId) {
      const [area] = await tx.select({ id: lifeAreas.id }).from(lifeAreas).where(and(eq(lifeAreas.id, next.lifeAreaId), eq(lifeAreas.userId, userId), isNull(lifeAreas.archivedAt))).limit(1)
      if (!area) throw new GoalRuleError('invalid_area')
    }
    if (next.parentGoalId) {
      if (next.parentGoalId === id) throw new GoalRuleError('invalid_parent')
      const [parent] = await tx.select().from(goals).where(and(eq(goals.id, next.parentGoalId), eq(goals.userId, userId), isNull(goals.archivedAt))).limit(1)
      if (!parent || !isGoalChildCompatible(parent, next)) throw new GoalRuleError('invalid_parent')
      let ancestor = parent
      while (ancestor.parentGoalId) {
        if (ancestor.parentGoalId === id) throw new GoalRuleError('invalid_parent')
        const [nextAncestor] = await tx.select().from(goals).where(and(eq(goals.id, ancestor.parentGoalId), eq(goals.userId, userId))).limit(1)
        if (!nextAncestor) break
        ancestor = nextAncestor
      }
    }
    const children = await tx.select().from(goals).where(and(eq(goals.userId, userId), eq(goals.parentGoalId, id), isNull(goals.archivedAt)))
    if (children.some((child) => !isGoalChildCompatible(next, child))) throw new GoalRuleError('goal_has_children')
    const values = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined))
    return repository.updateGoal(tx, userId, id, values)
  })
}

export const complete = (db: Database, userId: string, id: string) => repository.setGoalState(db, userId, id, 'completed')
export const reopen = (db: Database, userId: string, id: string) => repository.setGoalState(db, userId, id, 'active')
export async function archive(db: Database, userId: string, id: string) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`)
    const [current] = await tx.select({ id: goals.id }).from(goals).where(and(eq(goals.id, id), eq(goals.userId, userId), isNull(goals.archivedAt))).limit(1)
    if (!current) return undefined
    const [child] = await tx.select({ id: goals.id }).from(goals).where(and(eq(goals.parentGoalId, id), eq(goals.userId, userId), isNull(goals.archivedAt))).limit(1)
    if (child) throw new GoalRuleError('goal_has_children')
    return repository.setGoalArchived(tx, userId, id, true)
  })
}
export async function restore(db: Database, userId: string, id: string) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`)
    const [current] = await tx.select({ lifeAreaId: goals.lifeAreaId, parentGoalId: goals.parentGoalId }).from(goals)
      .where(and(eq(goals.id, id), eq(goals.userId, userId), sql`${goals.archivedAt} is not null`)).limit(1)
    if (!current) return undefined
    if (current.lifeAreaId) {
      const [area] = await tx.select({ id: lifeAreas.id }).from(lifeAreas)
        .where(and(eq(lifeAreas.id, current.lifeAreaId), eq(lifeAreas.userId, userId), isNull(lifeAreas.archivedAt))).limit(1)
      if (!area) throw new GoalRuleError('restore_conflict')
    }
    if (current.parentGoalId) {
      const [parent] = await tx.select({ id: goals.id }).from(goals)
        .where(and(eq(goals.id, current.parentGoalId), eq(goals.userId, userId), isNull(goals.archivedAt))).limit(1)
      if (!parent) throw new GoalRuleError('restore_conflict')
    }
    return repository.setGoalArchived(tx, userId, id, false)
  })
}
