import { describe, expect, it } from 'vitest'
import { createApp } from '../../src/server/app'

describe('versioned API foundation', () => {
  it('returns a minimal health response without private environment details', async () => {
    const response = await createApp().request('/api/v1/health')

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-request-id')).toBeTruthy()
    await expect(response.json()).resolves.toEqual({ data: { status: 'ok' } })
  })

  it('uses the standard error envelope for unknown API routes', async () => {
    const response = await createApp().request('/api/v1/missing')
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body).toMatchObject({
      error: { code: 'not_found', message: expect.any(String), requestId: expect.any(String) },
    })
  })
})
