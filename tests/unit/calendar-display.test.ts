import { describe, expect, it } from 'vitest'
import { eventOccursOnDate, eventTimelineRange } from '../../src/calendar-display.js'

const tokyoMeeting = { allDay: false, startDate: null, endDate: null, startAt: '2026-11-01T15:30:00Z', endAt: '2026-11-01T16:30:00Z' }

describe('fechas y horas de Agenda según la zona de visualización', () => {
  it('muestra en Bolivia el día anterior a una reunión de madrugada en Tokio', () => {
    expect(eventOccursOnDate(tokyoMeeting, '2026-11-01', 'America/La_Paz')).toBe(true)
    expect(eventOccursOnDate(tokyoMeeting, '2026-11-02', 'America/La_Paz')).toBe(false)
    expect(eventTimelineRange(tokyoMeeting, '2026-11-01', 'America/La_Paz')).toEqual({ start: 690, end: 750 })
    expect(eventTimelineRange(tokyoMeeting, '2026-11-02', 'Asia/Tokyo')).toEqual({ start: 30, end: 90 })
  })

  it('reparte un evento entre dos días del perfil y excluye el instante final a medianoche', () => {
    const event = { ...tokyoMeeting, startAt: '2026-11-02T03:30:00Z', endAt: '2026-11-02T04:30:00Z' }
    expect(eventTimelineRange(event, '2026-11-01', 'America/La_Paz')).toEqual({ start: 1410, end: 1440 })
    expect(eventTimelineRange(event, '2026-11-02', 'America/La_Paz')).toEqual({ start: 0, end: 30 })
    expect(eventOccursOnDate({ ...event, endAt: '2026-11-02T04:00:00Z' }, '2026-11-02', 'America/La_Paz')).toBe(false)
  })

  it('mantiene las fechas de todo el día independientemente de la zona', () => {
    const event = { allDay: true, startDate: '2026-11-01', endDate: '2026-11-02', startAt: null, endAt: null }
    for (const zone of ['America/La_Paz', 'Asia/Tokyo']) {
      expect(eventOccursOnDate(event, '2026-11-01', zone)).toBe(true)
      expect(eventOccursOnDate(event, '2026-11-02', zone)).toBe(true)
      expect(eventOccursOnDate(event, '2026-11-03', zone)).toBe(false)
      expect(eventTimelineRange(event, '2026-11-01', zone)).toBeNull()
    }
  })
})
