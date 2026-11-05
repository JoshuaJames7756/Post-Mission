import { describe, expect, it } from 'vitest'
import { moveDueAtToToday, pendingDayLabel } from '../../src/soft-rollover.js'

describe('soft rollover', () => {
  const zone = 'America/La_Paz'
  const today = '2026-11-04'

  it('uses the profile day and avoids calling earlier hours today overdue', () => {
    expect(pendingDayLabel('2026-11-04T03:00:00Z', today, zone)).toBe('De ayer')
    expect(pendingDayLabel('2026-11-04T04:00:00Z', today, zone)).toBeNull()
    expect(pendingDayLabel('2026-11-04T12:00:00Z', today, zone)).toBeNull()
    expect(pendingDayLabel('2026-11-02T12:00:00Z', today, zone)).toBe('Pendiente')
  })

  it('moves the date to the current instant', () => {
    expect(moveDueAtToToday(new Date('2026-11-04T15:30:00Z'))).toBe('2026-11-04T15:30:00.000Z')
  })
})
