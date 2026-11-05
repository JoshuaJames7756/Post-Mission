import { PgDialect } from 'drizzle-orm/pg-core'
import { describe, expect, it, vi } from 'vitest'
import { tasks, events, notes, reviews, accountDeletions } from '../../src/server/db/schema.js'

const fixture = vi.hoisted(() => ({ db: null as unknown }))

vi.mock('@clerk/backend', () => ({
  createClerkClient: () => ({
    authenticateRequest: async (request: Request) => ({
      isAuthenticated: true,
      toAuth: () => ({ userId: request.headers.get('Authorization')?.slice(7), has: () => true }),
    }),
  }),
}))

vi.mock('../../src/server/db/client.js', () => ({
  createDb: () => ({ db: fixture.db, close: async () => {} }),
}))

import { createApp } from '../../src/server/app.js'

const dialect = new PgDialect()
const taskId = '00000000-0000-4000-8000-000000000001'

function memoryDb() {
  const record = { id: taskId, userId: 'user-alpha', title: 'Mi tarea privada', status: 'open', dueAt: new Date('2026-11-02T12:00:00Z'), archivedAt: null as Date | null }
  const note = { id: '00000000-0000-4000-8000-000000000002', userId: 'user-alpha', title: 'Impresión privada', content: 'Solo para mí', archivedAt: null as Date | null }
  const review = { id: '00000000-0000-4000-8000-000000000003', userId: 'user-alpha', periodType: 'weekly', periodStart: '2026-11-02', status: 'draft', revision: 1, wins: 'Logro privado', challenges: '', reflection: '', nextSteps: '', completedAt: null as Date | null }
  const event = { id: '00000000-0000-4000-8000-000000000004', userId: 'user-alpha', title: 'Evento privado', status: 'scheduled', allDay: true, startDate: '2026-11-05', endDate: '2026-11-05', startAt: null, endAt: null, archivedAt: null as Date | null }
  const select = () => {
    let table: unknown
    let params: unknown[] = []
    const rows = () => {
      if (table === accountDeletions) return []
      if (table === notes) return params.includes(note.userId) && note.archivedAt === null ? [note] : []
      if (table === reviews) return params.includes(review.userId) && params.includes(review.periodType) && params.includes(review.periodStart) ? [review] : []
      if (table === events) return params.includes(event.userId) && event.archivedAt === null ? [event] : []
      if (table !== tasks) return []
      return params.includes(record.userId) && (!params.includes(taskId) || params.includes(record.id)) && record.archivedAt === null ? [record] : []
    }
    const query = {
      from(value: unknown) { table = value; return query },
      where(value: Parameters<typeof dialect.sqlToQuery>[0]) { params = dialect.sqlToQuery(value).params; return query },
      limit: async () => rows(),
      orderBy: async () => rows(),
      then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows()).then(resolve),
    }
    return query
  }
  const update = (table: unknown) => {
    let values: Record<string, unknown> = {}
    let params: unknown[] = []
    const query = {
      set(input: Record<string, unknown>) { values = input; return query },
      where(value: Parameters<typeof dialect.sqlToQuery>[0]) { params = dialect.sqlToQuery(value).params; return query },
      returning: async () => {
        if (table === reviews) {
          if (!params.includes(review.userId) || !params.includes(review.periodStart)) return []
          Object.assign(review, values)
          return [review]
        }
        if (table === events) {
          if (!params.includes(event.userId) || !params.includes(event.id)) return []
          Object.assign(event, values)
          return [event]
        }
        if (table !== tasks || !params.includes(record.userId) || !params.includes(record.id)) return []
        Object.assign(record, values)
        return [record]
      },
    }
    return query
  }
  return { db: { select, update }, record, event, note, review }
}

const bindings = {
  APP_ORIGIN: 'http://localhost:5174',
  CLERK_PUBLISHABLE_KEY: 'pk_test_placeholder',
  CLERK_SECRET_KEY: 'sk_test_placeholder',
  DATABASE_URL: 'mock://memory',
}

async function requestAs(userId: string, path: string, method = 'GET') {
  return createApp().request(path, {
    method,
    headers: { Authorization: `Bearer ${userId}`, Origin: 'http://localhost:5174' },
  }, bindings as never, { waitUntil: () => {}, passThroughOnException: () => {} } as never)
}

describe('authenticated task isolation across accounts', () => {
  it('hides another account’s task and rejects its completion', async () => {
    const memory = memoryDb()
    fixture.db = memory.db

    const own = await requestAs('user-alpha', `/api/v1/tasks/${taskId}`)
    expect(own.status).toBe(200)
    expect((await own.json()).data.title).toBe('Mi tarea privada')

    const foreignRead = await requestAs('user-beta', `/api/v1/tasks/${taskId}`)
    const foreignChange = await requestAs('user-beta', `/api/v1/tasks/${taskId}/complete`, 'POST')
    expect(foreignRead.status).toBe(404)
    expect(foreignChange.status).toBe(404)
    expect(memory.record.status).toBe('open')
    expect((await foreignRead.json()).error.code).toBe('not_found')

    const ownChange = await requestAs('user-alpha', `/api/v1/tasks/${taskId}/complete`, 'POST')
    expect(ownChange.status).toBe(200)
    expect(memory.record.status).toBe('completed')
  })

  it('allows the owner to move a task to today without letting another account change its date', async () => {
    const memory = memoryDb()
    fixture.db = memory.db
    const moveAs = (userId: string, dueAt: string) => createApp().request(`/api/v1/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userId}`, Origin: 'http://localhost:5174', 'Content-Type': 'application/json' },
      body: JSON.stringify({ dueAt }),
    }, bindings as never, { waitUntil: () => {}, passThroughOnException: () => {} } as never)

    const newDueAt = '2026-11-04T15:30:00.000Z'
    const foreign = await moveAs('user-beta', newDueAt)
    expect(foreign.status).toBe(404)
    expect(memory.record.dueAt.toISOString()).toBe('2026-11-02T12:00:00.000Z')

    const own = await moveAs('user-alpha', newDueAt)
    expect(own.status).toBe(200)
    expect(memory.record.dueAt.toISOString()).toBe(newDueAt)
  })

  it('returns not found for a foreign task restore and malformed task IDs', async () => {
    const memory = memoryDb()
    fixture.db = memory.db
    expect((await requestAs('user-beta', `/api/v1/tasks/${taskId}/restore`, 'POST')).status).toBe(404)
    for (const [method, path] of [
      ['GET', '/api/v1/tasks/not-a-uuid'],
      ['PATCH', '/api/v1/tasks/not-a-uuid'],
      ['POST', '/api/v1/tasks/not-a-uuid/complete'],
      ['POST', '/api/v1/tasks/not-a-uuid/restore'],
    ]) {
      expect((await requestAs('user-alpha', path, method)).status).toBe(404)
    }
    expect(memory.record.status).toBe('open')
  })

  it('returns not found when an account archives or restores a missing goal', async () => {
    const tx = {
      execute: async () => ({ rows: [] }),
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    }
    fixture.db = {
      ...memoryDb().db,
      transaction: (operation: (value: typeof tx) => Promise<unknown>) => operation(tx),
    }
    const goalId = '00000000-0000-4000-8000-000000000005'
    expect((await requestAs('user-beta', `/api/v1/goals/${goalId}/archive`, 'POST')).status).toBe(404)
    expect((await requestAs('user-beta', `/api/v1/goals/${goalId}/restore`, 'POST')).status).toBe(404)
    expect((await requestAs('user-alpha', '/api/v1/goals/not-a-uuid')).status).toBe(404)
    expect((await requestAs('user-alpha', '/api/v1/goals/not-a-uuid/complete', 'POST')).status).toBe(404)
  })

  it('keeps captured notes out of another account’s list', async () => {
    const memory = memoryDb()
    fixture.db = memory.db
    const own = await requestAs('user-alpha', '/api/v1/notes')
    const foreign = await requestAs('user-beta', '/api/v1/notes')
    expect(own.status).toBe(200)
    expect((await own.json()).data[0].title).toBe(memory.note.title)
    expect(foreign.status).toBe(200)
    expect((await foreign.json()).data).toEqual([])
  })

  it('hides calendar events from another account and rejects completion', async () => {
    const memory = memoryDb()
    fixture.db = memory.db
    const path = `/api/v1/events/${memory.event.id}`
    const range = '/api/v1/events?from=2026-11-01&to=2026-11-30&timeZone=America%2FLa_Paz'

    const ownList = await requestAs('user-alpha', range)
    const foreignList = await requestAs('user-beta', range)
    expect((await ownList.json()).data[0].title).toBe(memory.event.title)
    expect((await foreignList.json()).data).toEqual([])

    const foreignRead = await requestAs('user-beta', path)
    const foreignComplete = await requestAs('user-beta', `${path}/complete`, 'POST')
    const foreignRestore = await requestAs('user-beta', `${path}/restore`, 'POST')
    expect(foreignRead.status).toBe(404)
    expect(foreignComplete.status).toBe(404)
    expect(foreignRestore.status).toBe(404)
    expect(memory.event.status).toBe('scheduled')

    const ownComplete = await requestAs('user-alpha', `${path}/complete`, 'POST')
    expect(ownComplete.status).toBe(200)
    expect(memory.event.status).toBe('completed')
  })

  it('rejects malformed event IDs before querying or changing data', async () => {
    const memory = memoryDb()
    fixture.db = memory.db
    const path = '/api/v1/events/not-a-uuid'
    for (const [method, url] of [
      ['GET', path], ['PATCH', path], ['POST', `${path}/complete`], ['POST', `${path}/restore`],
    ]) {
      const response = await requestAs('user-alpha', url, method)
      expect(response.status).toBe(404)
      expect((await response.json()).error.code).toBe('not_found')
    }
    expect(memory.event.status).toBe('scheduled')
  })

  it('does not expose or complete another account’s weekly review', async () => {
    const memory = memoryDb()
    fixture.db = memory.db
    const path = '/api/v1/reviews/weekly/2026-11-02'
    const own = await requestAs('user-alpha', path)
    const foreign = await requestAs('user-beta', path)
    expect((await own.json()).data.wins).toBe('Logro privado')
    expect((await foreign.json()).data).toBeNull()

    const foreignComplete = await createApp().request(`${path}/complete`, {
      method: 'POST',
      headers: { Authorization: 'Bearer user-beta', Origin: 'http://localhost:5174', 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseRevision: 1 }),
    }, bindings as never, { waitUntil: () => {}, passThroughOnException: () => {} } as never)
    expect(foreignComplete.status).toBe(409)
    expect(memory.review.status).toBe('draft')
  })

  it('scopes every archived data source to the authenticated account', async () => {
    let archiveSql = ''
    let archiveParams: unknown[] = []
    fixture.db = {
      ...memoryDb().db,
      execute: async (statement: Parameters<typeof dialect.sqlToQuery>[0]) => {
        const compiled = dialect.sqlToQuery(statement)
        archiveSql = compiled.sql
        archiveParams = compiled.params
        return { rows: [] }
      },
    }
    const response = await requestAs('user-beta', '/api/v1/archive?kind=all')
    expect(response.status).toBe(200)
    expect((await response.json()).data.items).toEqual([])
    expect((archiveSql.match(/user_id =/g) ?? [])).toHaveLength(8)
    expect(archiveParams.filter((value) => value === 'user-beta')).toHaveLength(8)
    expect(archiveParams).not.toContain('user-alpha')
  })
})
