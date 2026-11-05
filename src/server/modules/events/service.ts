import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import type { Database } from '../../db/client.js'
import { events, goals } from '../../db/schema.js'
import { getStartOfCalendarDate, resolveZonedDateTime, CalendarTimeError } from '../../../calendar-time.js'
import { addCalendarDays } from '../../../date-utils.js'
import type { CreateEventInput } from '../../../shared/schemas/event.js'
import * as repository from './repository.js'

export class EventRuleError extends Error {
  readonly code: 'invalid_goal' | 'invalid_duration' | 'restore_conflict'

  constructor(code: 'invalid_goal' | 'invalid_duration' | 'restore_conflict') {
    super(code)
    this.code = code
  }
}

export { CalendarTimeError }

async function validateGoal(db: Database, userId: string, goalId: string | null | undefined) {
  if (!goalId) return
  const [goal] = await db.select({ id: goals.id }).from(goals)
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId), eq(goals.status, 'active'), isNull(goals.archivedAt))).limit(1)
  if (!goal) throw new EventRuleError('invalid_goal')
}

function eventValues(input: CreateEventInput) {
  const shared = {
    title: input.title,
    description: input.description ?? null,
    category: input.category,
    color: input.color,
    goalId: input.goalId ?? null,
  }
  if (input.allDay) {
    return {
      ...shared,
      allDay: true,
      startDate: input.startDate,
      endDate: input.endDate,
      startAt: null,
      endAt: null,
      timeZone: null,
    }
  }

  const startAt = resolveZonedDateTime(input.startLocal, input.timeZone, input.startOffsetMinutes)
  const endAt = resolveZonedDateTime(input.endLocal, input.timeZone, input.endOffsetMinutes)
  if (Date.parse(endAt) <= Date.parse(startAt)) throw new EventRuleError('invalid_duration')
  return {
    ...shared,
    allDay: false,
    startDate: null,
    endDate: null,
    startAt: new Date(startAt),
    endAt: new Date(endAt),
    timeZone: input.timeZone,
  }
}

export async function list(db: Database, userId: string, range: { from: string; to: string; timeZone: string }, archived = false) {
  const startAt = new Date(getStartOfCalendarDate(range.from, range.timeZone))
  const endDate = addCalendarDays(range.to, 1)
  const endAt = new Date(getStartOfCalendarDate(endDate, range.timeZone))
  return repository.listEvents(db, userId, { ...range, startAt, endAt }, archived)
}

export const get = (db: Database, userId: string, id: string) => repository.getEvent(db, userId, id)

export async function create(db: Database, userId: string, input: CreateEventInput) {
  await validateGoal(db, userId, input.goalId)
  return repository.createEvent(db, userId, eventValues(input))
}

export async function update(db: Database, userId: string, id: string, input: CreateEventInput) {
  await validateGoal(db, userId, input.goalId)
  return repository.updateEvent(db, userId, id, eventValues(input))
}

export const setStatus = (db: Database, userId: string, id: string, status: 'completed' | 'cancelled') => repository.setEventStatus(db, userId, id, status)
export const archive = (db: Database, userId: string, id: string) => repository.setEventArchived(db, userId, id, true)
export async function restore(db: Database, userId: string, id: string) {
  const [current] = await db.select({ goalId: events.goalId }).from(events)
    .where(and(eq(events.userId, userId), eq(events.id, id), isNotNull(events.archivedAt))).limit(1)
  if (!current) return undefined
  try { await validateGoal(db, userId, current.goalId) }
  catch (error) { if (error instanceof EventRuleError) throw new EventRuleError('restore_conflict'); throw error }
  return repository.setEventArchived(db, userId, id, false)
}
