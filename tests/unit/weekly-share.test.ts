import { describe, expect, it } from 'vitest'
import { weeklyShareText } from '../../src/weekly-share.js'

describe('weekly share summary', () => {
  it('includes completed goals and the next focus without private challenges or reflection', () => {
    const text = weeklyShareText({ wins: 'Visité a un amigo', challenges: 'Algo privado', reflection: 'Diario privado', nextSteps: 'Estudiar cada mañana' }, ['Leer un libro'])
    expect(text).toContain('Leer un libro')
    expect(text).toContain('Visité a un amigo')
    expect(text).toContain('Estudiar cada mañana')
    expect(text).not.toContain('Algo privado')
    expect(text).not.toContain('Diario privado')
  })
})
