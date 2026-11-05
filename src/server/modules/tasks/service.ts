import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import type { Database } from '../../db/client.js'
import { goals, tasks } from '../../db/schema.js'
import type { CreateTaskInput, UpdateTaskInput } from '../../../shared/schemas/task.js'
import * as repository from './repository.js'

export class TaskRuleError extends Error {
  readonly code: 'invalid_goal' | 'restore_conflict'
  constructor(code: 'invalid_goal' | 'restore_conflict' = 'invalid_goal') { super(code); this.code = code }
}

export const list = (db: Database, userId: string, archived = false) => repository.listTasks(db, userId, archived)
export const get = (db: Database, userId: string, id: string) => repository.getTask(db, userId, id)

async function validateGoal(db: Database, userId: string, goalId: string | null | undefined) {
  if (!goalId) return
  const [goal] = await db.select({ id: goals.id }).from(goals)
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId), isNull(goals.archivedAt))).limit(1)
  if (!goal) throw new TaskRuleError()
}

export async function create(db: Database, userId: string, input: CreateTaskInput) {
  await validateGoal(db, userId, input.goalId)
  const { dueAt, ...fields } = input
  return repository.createTask(db, userId, { ...fields, ...(dueAt === undefined ? {} : { dueAt: dueAt ? new Date(dueAt) : null }) })
}

export async function update(db: Database, userId: string, id: string, input: UpdateTaskInput) {
  if (input.goalId !== undefined) await validateGoal(db, userId, input.goalId)
  const { dueAt, status, ...fields } = input
  const values = Object.fromEntries(Object.entries({
    ...fields,
    ...(dueAt === undefined ? {} : { dueAt: dueAt ? new Date(dueAt) : null }),
    ...(status === undefined ? {} : { status, completedAt: status === 'completed' ? new Date() : null }),
  }).filter(([, value]) => value !== undefined))
  return repository.updateTask(db, userId, id, values)
}

export async function setStatus(db: Database, userId: string, id: string, status: 'open' | 'completed') {
  return update(db, userId, id, { status })
}

export const archive = (db: Database, userId: string, id: string) => repository.setTaskArchived(db, userId, id, true)
export async function restore(db: Database, userId: string, id: string) {
  const [current] = await db.select({ goalId: tasks.goalId }).from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.id, id), isNotNull(tasks.archivedAt))).limit(1)
  if (!current) return undefined
  try { await validateGoal(db, userId, current.goalId) }
  catch (error) { if (error instanceof TaskRuleError) throw new TaskRuleError('restore_conflict'); throw error }
  return repository.setTaskArchived(db, userId, id, false)
}
