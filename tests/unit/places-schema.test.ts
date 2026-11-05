import { describe, expect, it } from 'vitest'
import { createPlaceSchema, updatePlaceSchema } from '../../src/shared/schemas/place.js'

const minimum = { name: 'Casa', type: 'home' }

describe('place schemas', () => {
  it('accepts places without coordinates and trims the name', () => {
    expect(createPlaceSchema.parse({ ...minimum, name: ' Casa ' })).toMatchObject({ name: 'Casa' })
  })

  it('requires both coordinates together and checks geographic ranges', () => {
    expect(createPlaceSchema.safeParse({ ...minimum, latitude: 40 }).success).toBe(false)
    expect(createPlaceSchema.safeParse({ ...minimum, latitude: 91, longitude: 0 }).success).toBe(false)
    expect(createPlaceSchema.safeParse({ ...minimum, latitude: 0, longitude: -181 }).success).toBe(false)
    expect(createPlaceSchema.safeParse({ ...minimum, latitude: -90, longitude: 180 }).success).toBe(true)
  })

  it('rejects malformed names, place types, and caller-supplied owner fields', () => {
    expect(createPlaceSchema.safeParse({ ...minimum, name: '  ' }).success).toBe(false)
    expect(createPlaceSchema.safeParse({ ...minimum, type: 'unknown' }).success).toBe(false)
    expect(createPlaceSchema.safeParse({ ...minimum, userId: 'user_other' }).success).toBe(false)
  })

  it('requires coordinate pairs to be updated or cleared together', () => {
    expect(updatePlaceSchema.safeParse({ latitude: -16.5 }).success).toBe(false)
    expect(updatePlaceSchema.safeParse({ latitude: null, longitude: null }).success).toBe(true)
  })
})
