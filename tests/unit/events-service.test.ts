import { describe, expect, it } from 'vitest'
import * as eventService from '../../src/server/modules/events/service.js'

const base = { title: 'Study group', category: 'Study', color: 'sage' as const }

function insertDb() {
  const inserted: Array<Record<string, unknown>> = []
  const db = {
    insert: () => ({
      values: (value: Record<string, unknown>) => ({
        returning: async () => { inserted.push(value); return [{ ...value, id: '00000000-0000-4000-8000-000000000009' }] },
      }),
    }),
  }
  return { db, inserted }
}

describe('event service time semantics', () => {
  it('stores all-day events as date values without a time zone or UTC instants', async () => {
    const { db, inserted } = insertDb()
    await eventService.create(db as never, 'user-alpha', {
      ...base, allDay: true, startDate: '2026-10-24', endDate: '2026-10-25',
    })

    expect(inserted[0]).toMatchObject({ allDay: true, startDate: '2026-10-24', endDate: '2026-10-25', timeZone: null, startAt: null, endAt: null })
  })

  it('stores timed events as instants resolved in their selected IANA zone', async () => {
    const { db, inserted } = insertDb()
    await eventService.create(db as never, 'user-alpha', {
      ...base, allDay: false,
      startLocal: '2026-10-24T09:00', endLocal: '2026-10-24T10:00',
      timeZone: 'America/La_Paz', startOffsetMinutes: -240, endOffsetMinutes: -240,
    })

    expect(inserted[0]).toMatchObject({
      allDay: false,
      startAt: new Date('2026-10-24T13:00:00.000Z'),
      endAt: new Date('2026-10-24T14:00:00.000Z'),
      timeZone: 'America/La_Paz',
    })
  })

  it('rejects nonexistent, ambiguous, and reversed timed intervals before writing', async () => {
    const { db, inserted } = insertDb()
    await expect(eventService.create(db as never, 'user-alpha', {
      ...base, allDay: false,
      startLocal: '2026-03-08T02:30', endLocal: '2026-03-08T03:30',
      timeZone: 'America/New_York', startOffsetMinutes: -300, endOffsetMinutes: -240,
    })).rejects.toMatchObject({ code: 'nonexistent_local_time' })
    await expect(eventService.create(db as never, 'user-alpha', {
      ...base, allDay: false,
      startLocal: '2026-11-01T01:30', endLocal: '2026-11-01T02:30',
      timeZone: 'America/New_York', startOffsetMinutes: -200, endOffsetMinutes: -300,
    })).rejects.toMatchObject({ code: 'invalid_offset' })
    await expect(eventService.create(db as never, 'user-alpha', {
      ...base, allDay: false,
      startLocal: '2026-10-24T10:00', endLocal: '2026-10-24T09:00',
      timeZone: 'America/La_Paz', startOffsetMinutes: -240, endOffsetMinutes: -240,
    })).rejects.toMatchObject({ code: 'invalid_duration' })
    expect(inserted).toHaveLength(0)
  })

  it('rejects a goal that the event owner cannot use', async () => {
    const { inserted } = insertDb()
    const db = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
      insert: () => ({ values: (value: Record<string, unknown>) => ({ returning: async () => { inserted.push(value); return [value] } }) }),
    }
    await expect(eventService.create(db as never, 'user-alpha', {
      ...base, allDay: true, startDate: '2026-10-24', endDate: '2026-10-24',
      goalId: '00000000-0000-4000-8000-000000000010',
    })).rejects.toMatchObject({ code: 'invalid_goal' })
    expect(inserted).toHaveLength(0)
  })
})
