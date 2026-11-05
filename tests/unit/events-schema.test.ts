import { getTableConfig } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import { eventPeople, eventPlaces, events, people, places } from '../../src/server/db/schema.js'

describe('events database schema', () => {
  const config = getTableConfig(events)

  it('stores all-day dates separately from timed instants', () => {
    const columns = new Map(config.columns.map((column) => [column.name, column]))

    expect(columns.get('start_date')?.getSQLType()).toBe('date')
    expect(columns.get('end_date')?.getSQLType()).toBe('date')
    expect(columns.get('start_at')?.getSQLType()).toBe('timestamp with time zone')
    expect(columns.get('end_at')?.getSQLType()).toBe('timestamp with time zone')
    expect(columns.get('time_zone')?.notNull).toBe(false)
  })

  it('defines database checks, owner-scoped goal relation, and range indexes', () => {
    expect(config.checks).toHaveLength(1)
    expect(config.foreignKeys).toHaveLength(2)
    expect(config.indexes.map((index) => index.config.name)).toEqual(expect.arrayContaining([
      'events_user_all_day_range_idx',
      'events_user_timed_range_idx',
    ]))
  })
})

describe('people and event associations database schema', () => {
  it('stores birthdays as dates and keeps event/person links within one owner', () => {
    const personConfig = getTableConfig(people)
    const birthday = personConfig.columns.find((column) => column.name === 'birthday')
    expect(birthday?.getSQLType()).toBe('date')
    expect(personConfig.foreignKeys).toHaveLength(1)

    const linkConfig = getTableConfig(eventPeople)
    expect(linkConfig.foreignKeys).toHaveLength(2)
    expect(linkConfig.indexes.map((index) => index.config.name)).toContain('event_people_user_person_idx')
    expect(linkConfig.uniqueConstraints.map((constraint) => constraint.name)).toContain('event_people_user_event_person_unique')
  })
})

describe('places and event associations database schema', () => {
  it('stores coordinates as doubles and constrains their valid pair/ranges', () => {
    const config = getTableConfig(places)
    const columns = new Map(config.columns.map((column) => [column.name, column]))
    expect(columns.get('latitude')?.getSQLType()).toBe('double precision')
    expect(columns.get('longitude')?.getSQLType()).toBe('double precision')
    expect(config.checks).toHaveLength(1)
    expect(config.foreignKeys).toHaveLength(1)
  })

  it('binds each place/event association to a single owner and prevents duplicates', () => {
    const config = getTableConfig(eventPlaces)
    expect(config.foreignKeys).toHaveLength(2)
    expect(config.indexes.map((index) => index.config.name)).toContain('event_places_user_place_idx')
    expect(config.uniqueConstraints.map((constraint) => constraint.name)).toContain('event_places_user_event_place_unique')
  })
})
