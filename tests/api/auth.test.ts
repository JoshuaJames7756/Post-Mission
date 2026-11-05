import { describe, expect, it } from 'vitest'
import { createApp } from '../../src/server/app.js'

describe('private API boundary', () => {
  it('fails closed when Clerk is not configured', async () => {
    const response = await createApp().request('/api/v1/life-areas', {}, {
      ASSETS: { fetch: async () => new Response(null, { status: 404 }) },
    })
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.error.code).toBe('authentication_unavailable')
    expect(body.error.requestId).toBeTruthy()
  })

  it('rejects a missing session even when Clerk settings exist', async () => {
    const response = await createApp().request('/api/v1/life-areas', {}, {
      ASSETS: { fetch: async () => new Response(null, { status: 404 }) },
      APP_ORIGIN: 'http://localhost:5173',
      CLERK_PUBLISHABLE_KEY: 'pk_test_placeholder',
      CLERK_SECRET_KEY: 'sk_test_placeholder',
    })
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(body.error.code).toBe('unauthenticated')
  })

  it.each([
    ['GET', '/api/v1/me'],
    ['PATCH', '/api/v1/me'],
    ['POST', '/api/v1/me/onboarding/complete'],
    ['GET', '/api/v1/life-areas'],
    ['POST', '/api/v1/life-areas'],
    ['PATCH', '/api/v1/life-areas/order'],
    ['PATCH', '/api/v1/life-areas/00000000-0000-4000-8000-000000000001'],
    ['POST', '/api/v1/life-areas/00000000-0000-4000-8000-000000000001/archive'],
    ['POST', '/api/v1/life-areas/00000000-0000-4000-8000-000000000001/restore'],
    ['GET', '/api/v1/goals'],
    ['POST', '/api/v1/goals'],
    ['GET', '/api/v1/goals/00000000-0000-4000-8000-000000000001'],
    ['PATCH', '/api/v1/goals/00000000-0000-4000-8000-000000000001'],
    ['POST', '/api/v1/goals/00000000-0000-4000-8000-000000000001/complete'],
    ['POST', '/api/v1/goals/00000000-0000-4000-8000-000000000001/reopen'],
    ['POST', '/api/v1/goals/00000000-0000-4000-8000-000000000001/archive'],
    ['POST', '/api/v1/goals/00000000-0000-4000-8000-000000000001/restore'],
    ['GET', '/api/v1/tasks'],
    ['POST', '/api/v1/tasks'],
    ['GET', '/api/v1/tasks/00000000-0000-4000-8000-000000000001'],
    ['PATCH', '/api/v1/tasks/00000000-0000-4000-8000-000000000001'],
    ['POST', '/api/v1/tasks/00000000-0000-4000-8000-000000000001/complete'],
    ['POST', '/api/v1/tasks/00000000-0000-4000-8000-000000000001/reopen'],
    ['POST', '/api/v1/tasks/00000000-0000-4000-8000-000000000001/archive'],
    ['POST', '/api/v1/tasks/00000000-0000-4000-8000-000000000001/restore'],
    ['GET', '/api/v1/events?from=2026-10-01&to=2026-10-31&timeZone=America%2FLa_Paz'],
    ['POST', '/api/v1/events'],
    ['GET', '/api/v1/events/00000000-0000-4000-8000-000000000001'],
    ['PATCH', '/api/v1/events/00000000-0000-4000-8000-000000000001'],
    ['POST', '/api/v1/events/00000000-0000-4000-8000-000000000001/complete'],
    ['POST', '/api/v1/events/00000000-0000-4000-8000-000000000001/cancel'],
    ['POST', '/api/v1/events/00000000-0000-4000-8000-000000000001/archive'],
    ['POST', '/api/v1/events/00000000-0000-4000-8000-000000000001/restore'],
    ['GET', '/api/v1/people'],
    ['POST', '/api/v1/people'],
    ['PATCH', '/api/v1/people/00000000-0000-4000-8000-000000000001'],
    ['POST', '/api/v1/people/00000000-0000-4000-8000-000000000001/archive'],
    ['POST', '/api/v1/people/00000000-0000-4000-8000-000000000001/restore'],
    ['GET', '/api/v1/people/00000000-0000-4000-8000-000000000001/events'],
    ['PUT', '/api/v1/people/00000000-0000-4000-8000-000000000001/events'],
    ['GET', '/api/v1/places'],
    ['POST', '/api/v1/places'],
    ['PATCH', '/api/v1/places/00000000-0000-4000-8000-000000000001'],
    ['POST', '/api/v1/places/00000000-0000-4000-8000-000000000001/archive'],
    ['POST', '/api/v1/places/00000000-0000-4000-8000-000000000001/restore'],
    ['GET', '/api/v1/places/00000000-0000-4000-8000-000000000001/events'],
    ['PUT', '/api/v1/places/00000000-0000-4000-8000-000000000001/events'],
    ['POST', '/api/v1/examples'],
    ['GET', '/api/v1/journey'],
    ['PATCH', '/api/v1/journey'],
    ['GET', '/api/v1/journey/milestones'],
    ['POST', '/api/v1/journey/milestones'],
    ['PATCH', '/api/v1/journey/milestones/00000000-0000-4000-8000-000000000001'],
    ['POST', '/api/v1/journey/milestones/00000000-0000-4000-8000-000000000001/archive'],
    ['POST', '/api/v1/journey/milestones/00000000-0000-4000-8000-000000000001/restore'],
    ['GET', '/api/v1/notes'],
    ['GET', '/api/v1/notes/link-options'],
    ['POST', '/api/v1/notes'],
    ['PUT', '/api/v1/notes/00000000-0000-4000-8000-000000000001'],
    ['POST', '/api/v1/notes/00000000-0000-4000-8000-000000000001/archive'],
    ['POST', '/api/v1/notes/00000000-0000-4000-8000-000000000001/restore'],
    ['GET', '/api/v1/reviews'],
    ['GET', '/api/v1/reviews/daily/2026-11-01'],
    ['PUT', '/api/v1/reviews/daily/2026-11-01'],
    ['POST', '/api/v1/reviews/daily/2026-11-01/complete'],
    ['POST', '/api/v1/reviews/daily/2026-11-01/reopen'],
    ['GET', '/api/v1/reminders'],
    ['GET', '/api/v1/archive'],
    ['GET', '/api/v1/account-deletion'],
    ['POST', '/api/v1/account-deletion'],
    ['PATCH', '/api/v1/reminders/preferences'],
    ['POST', '/api/v1/reminders/tasks/dismiss'],
  ] as const)('%s %s always requires a verified session', async (method, path) => {
    const response = await createApp().request(path, { method }, {
      ASSETS: { fetch: async () => new Response(null, { status: 404 }) },
      APP_ORIGIN: 'http://localhost:5173',
      CLERK_PUBLISHABLE_KEY: 'pk_test_placeholder',
      CLERK_SECRET_KEY: 'sk_test_placeholder',
    })
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(body.error.code).toBe('unauthenticated')
  })

  it('does not trust a userId supplied in an unauthenticated request body', async () => {
    const response = await createApp().request('/api/v1/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user_attacker', title: 'Tarea manipulada' }),
    }, {
      ASSETS: { fetch: async () => new Response(null, { status: 404 }) },
      APP_ORIGIN: 'http://localhost:5173',
      CLERK_PUBLISHABLE_KEY: 'pk_test_placeholder',
      CLERK_SECRET_KEY: 'sk_test_placeholder',
    })

    expect(response.status).toBe(401)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
})
