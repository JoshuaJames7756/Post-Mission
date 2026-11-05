import { describe, expect, it } from 'vitest'
import { createPersonSchema } from '../../src/shared/schemas/person.js'

const validPerson = { name: 'María Rivera', relationship: 'friend', avatarColor: 'sage' }

describe('person schemas', () => {
  it('accepts a minimal contact and trims bounded fields', () => {
    expect(createPersonSchema.parse({ ...validPerson, name: '  María Rivera  ', phone: '  +1 555 0100  ' })).toMatchObject({
      name: 'María Rivera', phone: '+1 555 0100',
    })
  })

  it('rejects missing names, unknown relationship/color values, and malformed birthdays', () => {
    expect(createPersonSchema.safeParse({ ...validPerson, name: '   ' }).success).toBe(false)
    expect(createPersonSchema.safeParse({ ...validPerson, relationship: 'stranger' }).success).toBe(false)
    expect(createPersonSchema.safeParse({ ...validPerson, avatarColor: 'neon' }).success).toBe(false)
    expect(createPersonSchema.safeParse({ ...validPerson, birthday: '2026-02-30' }).success).toBe(false)
  })

  it('bounds notes and rejects caller-supplied ownership fields', () => {
    expect(createPersonSchema.safeParse({ ...validPerson, notes: 'x'.repeat(2001) }).success).toBe(false)
    expect(createPersonSchema.safeParse({ ...validPerson, userId: 'user_attacker' }).success).toBe(false)
  })
})
