import { describe, expect, it } from 'vitest'
import { movableEventRange, movedEventInput, resizableEventRange, resizedEventInput, scheduleAllDayEventInput, snapEventEnd, snapEventStart } from '../../src/calendar-drag.js'

const event = {
  title: 'Estudio', description: null, category: 'Espiritual', color: 'sage' as const,
  goalId: null, allDay: false, startAt: '2026-11-03T13:00:00.000Z', endAt: '2026-11-03T14:00:00.000Z',
  timeZone: 'America/La_Paz', status: 'scheduled' as const,
}

describe('moving a timed event in the day view', () => {
  it('schedules a single-day event in the hourly timeline', () => {
    const allDay = { ...event, allDay: true, startDate: '2026-11-03', endDate: '2026-11-03', startAt: null, endAt: null }
    expect(scheduleAllDayEventInput(allDay, '2026-11-03', 'America/La_Paz', 570)).toMatchObject({
      title: 'Estudio', allDay: false, startLocal: '2026-11-03T09:30', endLocal: '2026-11-03T10:30',
    })
    expect(() => scheduleAllDayEventInput({ ...allDay, endDate: '2026-11-04' }, '2026-11-03', 'America/La_Paz', 570)).toThrow('event_not_schedulable')
  })
  it('snaps to quarters, preserves duration, and keeps the original event fields', () => {
    expect(movableEventRange(event, '2026-11-03', 'America/La_Paz')).toEqual({ startMinute: 540, durationMinutes: 60 })
    const target = snapEventStart(540, 23, 60)
    expect(target).toBe(570)
    expect(movedEventInput(event, '2026-11-03', 'America/La_Paz', target)).toMatchObject({
      title: 'Estudio', category: 'Espiritual', allDay: false,
      startLocal: '2026-11-03T09:30', endLocal: '2026-11-03T10:30',
      startOffsetMinutes: -240, endOffsetMinutes: -240,
    })
  })

  it('does not move completed or overnight events and clamps within the day', () => {
    expect(movableEventRange({ ...event, status: 'completed' }, '2026-11-03', 'America/La_Paz')).toBeNull()
    expect(movableEventRange({ ...event, endAt: '2026-11-04T05:00:00.000Z' }, '2026-11-03', 'America/La_Paz')).toBeNull()
    expect(snapEventStart(540, 2000, 60)).toBe(1380)
    expect(snapEventStart(540, -2000, 60)).toBe(0)
  })

  it('rejects a local time skipped by daylight saving and chooses the nearest repeated hour', () => {
    const spring = { ...event, startAt: '2026-03-08T06:00:00.000Z', endAt: '2026-03-08T06:30:00.000Z', timeZone: 'America/New_York' }
    expect(() => movedEventInput(spring, '2026-03-08', 'America/New_York', 150)).toThrow('nonexistent_target_time')

    const fall = { ...event, startAt: '2026-11-01T04:30:00.000Z', endAt: '2026-11-01T05:00:00.000Z', timeZone: 'America/New_York' }
    expect(movedEventInput(fall, '2026-11-01', 'America/New_York', 60).startOffsetMinutes).toBe(-240)
  })

  it('moves in the displayed day while preserving the event’s own time zone', () => {
    const tokyo = { ...event, startAt: '2026-11-01T15:30:00.000Z', endAt: '2026-11-01T16:30:00.000Z', timeZone: 'Asia/Tokyo' }
    expect(movedEventInput(tokyo, '2026-11-01', 'America/La_Paz', 720)).toMatchObject({
      startLocal: '2026-11-02T01:00', endLocal: '2026-11-02T02:00', timeZone: 'Asia/Tokyo',
    })
  })

  it('resizes the end in quarter hours while keeping the start instant', () => {
    expect(resizableEventRange(event, '2026-11-03', 'America/La_Paz')).toMatchObject({ startMinute: 540, endMinute: 600 })
    const end = snapEventEnd(540, 600, 31)
    expect(end).toBe(630)
    expect(resizedEventInput(event, '2026-11-03', 'America/La_Paz', end)).toMatchObject({
      startLocal: '2026-11-03T09:00', endLocal: '2026-11-03T10:30',
    })
    expect(snapEventEnd(540, 600, -300)).toBe(555)
    expect(snapEventEnd(540, 600, 2000)).toBe(1440)
  })

  it('keeps the event’s original zone when resizing from another display zone', () => {
    const tokyo = { ...event, startAt: '2026-11-01T15:30:00.000Z', endAt: '2026-11-01T16:30:00.000Z', timeZone: 'Asia/Tokyo' }
    expect(resizedEventInput(tokyo, '2026-11-01', 'America/La_Paz', 780)).toMatchObject({
      startLocal: '2026-11-02T00:30', endLocal: '2026-11-02T02:00', timeZone: 'Asia/Tokyo',
    })
  })
})
