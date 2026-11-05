import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import * as goalRepository from '../../src/server/modules/goals/repository.js'
import * as goalService from '../../src/server/modules/goals/service.js'
import * as taskRepository from '../../src/server/modules/tasks/repository.js'
import * as taskService from '../../src/server/modules/tasks/service.js'
import * as eventRepository from '../../src/server/modules/events/repository.js'
import * as peopleRepository from '../../src/server/modules/people/repository.js'
import * as placesRepository from '../../src/server/modules/places/repository.js'
import { goals, lifeAreas } from '../../src/server/db/schema.js'

const dialect = new PgDialect()

function selectionDb() {
  let condition: SQL | undefined
  const query = {
    from: () => query,
    where: (value: SQL) => { condition = value; return query },
    orderBy: async () => [],
    limit: async () => [],
  }
  return { db: { select: () => query }, condition: () => condition }
}

function updateDb() {
  let condition: SQL | undefined
  const query = {
    set: () => query,
    where: (value: SQL) => { condition = value; return query },
    returning: async () => [],
  }
  return { db: { update: () => query }, condition: () => condition }
}

function expectOwnerScope(condition: SQL | undefined, ownerId: string) {
  expect(condition).toBeDefined()
  const query = dialect.sqlToQuery(condition!)
  expect(query.sql).toContain('user_id')
  expect(query.params).toContain(ownerId)
}

describe('goal repository tenant isolation', () => {
  const ownerId = 'user-alpha'
  const foreignOwnerId = 'user-beta'
  const goalId = '00000000-0000-4000-8000-000000000001'

  it('scopes list and single-goal reads to the requested owner', async () => {
    const list = selectionDb()
    await goalRepository.listGoals(list.db as never, ownerId)
    expectOwnerScope(list.condition(), ownerId)

    const single = selectionDb()
    await goalRepository.getGoal(single.db as never, ownerId, goalId)
    expectOwnerScope(single.condition(), ownerId)
    expect(dialect.sqlToQuery(single.condition()!).params).not.toContain(foreignOwnerId)
  })

  it('scopes updates, completion changes, and archive changes to the requested owner', async () => {
    const update = updateDb()
    await goalRepository.updateGoal(update.db as never, ownerId, goalId, { title: 'Meta actualizada' })
    expectOwnerScope(update.condition(), ownerId)

    const state = updateDb()
    await goalRepository.setGoalState(state.db as never, ownerId, goalId, 'completed')
    expectOwnerScope(state.condition(), ownerId)

    const archive = updateDb()
    await goalRepository.setGoalArchived(archive.db as never, ownerId, goalId, true)
    expectOwnerScope(archive.condition(), ownerId)
  })
})

describe('task repository tenant isolation', () => {
  const ownerId = 'user-alpha'
  const foreignOwnerId = 'user-beta'
  const taskId = '00000000-0000-4000-8000-000000000002'

  it('scopes list and single-task reads to the requested owner', async () => {
    const list = selectionDb()
    await taskRepository.listTasks(list.db as never, ownerId)
    expectOwnerScope(list.condition(), ownerId)

    const single = selectionDb()
    await taskRepository.getTask(single.db as never, ownerId, taskId)
    expectOwnerScope(single.condition(), ownerId)
    expect(dialect.sqlToQuery(single.condition()!).params).not.toContain(foreignOwnerId)
  })

  it('scopes updates, completion changes, and archive changes to the requested owner', async () => {
    const update = updateDb()
    await taskRepository.updateTask(update.db as never, ownerId, taskId, { title: 'Tarea actualizada' })
    expectOwnerScope(update.condition(), ownerId)

    const archive = updateDb()
    await taskRepository.setTaskArchived(archive.db as never, ownerId, taskId, true)
    expectOwnerScope(archive.condition(), ownerId)
  })
})

describe('event repository tenant isolation', () => {
  const ownerId = 'user-alpha'
  const foreignOwnerId = 'user-beta'
  const eventId = '00000000-0000-4000-8000-000000000008'
  const range = { from: '2026-10-01', to: '2026-10-31', startAt: new Date('2026-10-01T04:00:00Z'), endAt: new Date('2026-11-01T04:00:00Z') }

  it('scopes range and single-event reads to the requested owner', async () => {
    const list = selectionDb()
    await eventRepository.listEvents(list.db as never, ownerId, range)
    expectOwnerScope(list.condition(), ownerId)
    const listQuery = dialect.sqlToQuery(list.condition()!)
    expect(listQuery.sql).toContain('"end_at" >')
    expect(listQuery.params).toContain(range.startAt.toISOString())
    expect(listQuery.params).toContain(range.endAt.toISOString())
    expect(listQuery.params).toContain(range.to)

    const single = selectionDb()
    await eventRepository.getEvent(single.db as never, ownerId, eventId)
    expectOwnerScope(single.condition(), ownerId)
    expect(dialect.sqlToQuery(single.condition()!).params).not.toContain(foreignOwnerId)
  })

  it('scopes event edits, state changes, and archive changes to the requested owner', async () => {
    const update = updateDb()
    await eventRepository.updateEvent(update.db as never, ownerId, eventId, { title: 'Updated event' })
    expectOwnerScope(update.condition(), ownerId)

    const state = updateDb()
    await eventRepository.setEventStatus(state.db as never, ownerId, eventId, 'cancelled')
    expectOwnerScope(state.condition(), ownerId)

    const archive = updateDb()
    await eventRepository.setEventArchived(archive.db as never, ownerId, eventId, true)
    expectOwnerScope(archive.condition(), ownerId)
  })
})

describe('people repository tenant isolation', () => {
  const ownerId = 'user-alpha'
  const personId = '00000000-0000-4000-8000-000000000005'

  it('scopes list and individual contact reads to the authenticated owner', async () => {
    const list = selectionDb()
    await peopleRepository.listPeople(list.db as never, ownerId, false, 'friend')
    expectOwnerScope(list.condition(), ownerId)

    const one = selectionDb()
    await peopleRepository.getPerson(one.db as never, ownerId, personId)
    expectOwnerScope(one.condition(), ownerId)
  })

  it('scopes contact updates and archive actions to the authenticated owner', async () => {
    const update = updateDb()
    await peopleRepository.updatePerson(update.db as never, ownerId, personId, { name: 'Updated' })
    expectOwnerScope(update.condition(), ownerId)

    const archive = updateDb()
    await peopleRepository.setPersonArchived(archive.db as never, ownerId, personId, true)
    expectOwnerScope(archive.condition(), ownerId)
  })
})

describe('places repository tenant isolation', () => {
  const ownerId = 'user-alpha'
  const placeId = '00000000-0000-4000-8000-000000000008'

  it('scopes place list and individual reads to the authenticated owner', async () => {
    const list = selectionDb()
    await placesRepository.listPlaces(list.db as never, ownerId, false, 'home')
    expectOwnerScope(list.condition(), ownerId)

    const one = selectionDb()
    await placesRepository.getPlace(one.db as never, ownerId, placeId)
    expectOwnerScope(one.condition(), ownerId)
  })

  it('scopes place updates and archive actions to the authenticated owner', async () => {
    const update = updateDb()
    await placesRepository.updatePlace(update.db as never, ownerId, placeId, { name: 'Updated' })
    expectOwnerScope(update.condition(), ownerId)

    const archive = updateDb()
    await placesRepository.setPlaceArchived(archive.db as never, ownerId, placeId, true)
    expectOwnerScope(archive.condition(), ownerId)
  })
})

describe('task goal association ownership', () => {
  const goal = { id: '00000000-0000-4000-8000-000000000003', userId: 'user-beta', archivedAt: null }

  function databaseWithGoal() {
    const inserted: Array<Record<string, unknown>> = []
    const db = {
      select: () => ({
        from: () => ({
          where: (condition: SQL) => ({
            limit: async () => {
              const query = dialect.sqlToQuery(condition)
              const ownerMatches = !query.sql.includes('user_id') || query.params.includes(goal.userId)
              return query.params.includes(goal.id) && ownerMatches ? [{ id: goal.id }] : []
            },
          }),
        }),
      }),
      insert: () => ({
        values: (value: Record<string, unknown>) => ({
          returning: async () => { inserted.push(value); return [{ ...value, id: '00000000-0000-4000-8000-000000000004' }] },
        }),
      }),
    }
    return { db, inserted }
  }

  it('rejects linking a task to another owner’s goal', async () => {
    const { db, inserted } = databaseWithGoal()
    await expect(taskService.create(db as never, 'user-alpha', { title: 'Paso privado', goalId: goal.id }))
      .rejects.toMatchObject({ code: 'invalid_goal' })
    expect(inserted).toHaveLength(0)
  })

  it('allows linking a task to a goal owned by the same user', async () => {
    const { db, inserted } = databaseWithGoal()
    const task = await taskService.create(db as never, goal.userId, { title: 'Paso de la meta', goalId: goal.id })
    expect(task.userId).toBe(goal.userId)
    expect(inserted).toHaveLength(1)
  })
})

describe('goal association ownership', () => {
  const area = { id: '00000000-0000-4000-8000-000000000005', userId: 'user-beta', archivedAt: null }
  const parent = {
    id: '00000000-0000-4000-8000-000000000006', userId: 'user-beta', archivedAt: null,
    periodType: 'year' as const, startDate: '2026-01-01', targetDate: '2026-12-31',
  }
  const input = {
    title: 'Meta del mes', periodType: 'month' as const,
    startDate: '2026-03-01', targetDate: '2026-03-31',
  }

  function databaseWithAssociations(associationOwnerId = 'user-beta') {
    const inserted: Array<Record<string, unknown>> = []
    const areaRecord = { ...area, userId: associationOwnerId }
    const parentRecord = { ...parent, userId: associationOwnerId }
    const tx = {
      execute: async () => undefined,
      select: () => ({
        from: (table: unknown) => ({
          where: (condition: SQL) => ({
            limit: async () => {
              const query = dialect.sqlToQuery(condition)
              const records = table === goals ? [parentRecord] : table === lifeAreas ? [areaRecord] : []
              return records.filter((record) => query.params.includes(record.id)
                && (!query.sql.includes('user_id') || query.params.includes(record.userId))
                && (!query.sql.includes('archived_at') || record.archivedAt === null))
            },
          }),
        }),
      }),
      insert: () => ({
        values: (value: Record<string, unknown>) => ({
          returning: async () => { inserted.push(value); return [{ ...value, id: '00000000-0000-4000-8000-000000000007' }] },
        }),
      }),
    }
    return { db: { transaction: async (operation: (transaction: typeof tx) => unknown) => operation(tx) }, inserted }
  }

  it('rejects a life area owned by another user', async () => {
    const { db, inserted } = databaseWithAssociations()
    await expect(goalService.create(db as never, 'user-alpha', { ...input, lifeAreaId: area.id }))
      .rejects.toMatchObject({ code: 'invalid_area' })
    expect(inserted).toHaveLength(0)
  })

  it('rejects a parent goal owned by another user', async () => {
    const { db, inserted } = databaseWithAssociations()
    await expect(goalService.create(db as never, 'user-alpha', { ...input, parentGoalId: parent.id }))
      .rejects.toMatchObject({ code: 'invalid_parent' })
    expect(inserted).toHaveLength(0)
  })

  it('allows same-user area and parent associations', async () => {
    const { db, inserted } = databaseWithAssociations('user-alpha')
    const created = await goalService.create(db as never, 'user-alpha', { ...input, lifeAreaId: area.id, parentGoalId: parent.id })
    expect(created.userId).toBe('user-alpha')
    expect(inserted).toHaveLength(1)
  })
})
