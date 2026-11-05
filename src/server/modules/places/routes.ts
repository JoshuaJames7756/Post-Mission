import type { Context, Hono } from 'hono'
import type { AppEnv } from '../../context.js'
import { apiError } from '../../lib/responses.js'
import { isResponse, parseJson } from '../../lib/validation.js'
import { requireUser } from '../../middleware/require-user.js'
import { withDatabase } from '../../middleware/with-database.js'
import { createPlaceSchema, placeEventLinksSchema, placeSearchSchema, updatePlaceSchema } from '../../../shared/schemas/place.js'
import * as service from './service.js'

export function registerPlaceRoutes(app: Hono<AppEnv>) {
  app.get('/places', requireUser, withDatabase, async (c) => {
    const query = placeSearchSchema.safeParse({ q: c.req.query('q') })
    if (!query.success) return apiError(c, 400, 'validation_error', 'Revisa el texto de búsqueda.')
    const data = await service.list(c.get('db'), c.get('userId'), c.req.query('archived') === 'true', query.data.q ?? '')
    return c.json({ data })
  })

  app.post('/places', requireUser, withDatabase, async (c) => {
    const input = await parseJson(c, createPlaceSchema)
    if (isResponse(input)) return input
    const [data] = await service.create(c.get('db'), c.get('userId'), input)
    return c.json({ data }, 201)
  })

  app.get('/places/:id/events', requireUser, withDatabase, async (c) => {
    const data = await service.listEvents(c.get('db'), c.get('userId'), c.req.param('id'))
    if (!data) return apiError(c, 404, 'not_found', 'No encontramos ese lugar.')
    return c.json({ data })
  })

  app.put('/places/:id/events', requireUser, withDatabase, async (c) => {
    const input = await parseJson(c, placeEventLinksSchema)
    if (isResponse(input)) return input
    try {
      const data = await service.replaceEvents(c.get('db'), c.get('userId'), c.req.param('id'), input.eventIds)
      if (!data) return apiError(c, 404, 'not_found', 'No encontramos ese lugar activo.')
      return c.json({ data })
    } catch (error) {
      if (error instanceof service.PlaceRuleError) return apiError(c, 404, 'not_found', 'No encontramos uno o más eventos activos.')
      throw error
    }
  })

  app.patch('/places/:id', requireUser, withDatabase, async (c) => {
    const input = await parseJson(c, updatePlaceSchema)
    if (isResponse(input)) return input
    const [data] = await service.update(c.get('db'), c.get('userId'), c.req.param('id'), input)
    if (!data) return apiError(c, 404, 'not_found', 'No encontramos ese lugar.')
    return c.json({ data })
  })

  app.post('/places/:id/archive', requireUser, withDatabase, async (c) => placeState(c, service.archive(c.get('db'), c.get('userId'), c.req.param('id'))))
  app.post('/places/:id/restore', requireUser, withDatabase, async (c) => placeState(c, service.restore(c.get('db'), c.get('userId'), c.req.param('id'))))
}

async function placeState(c: Context<AppEnv>, operation: Promise<unknown>) {
  const [data] = await operation as [{ id: string }?]
  if (!data) return apiError(c, 404, 'not_found', 'No encontramos ese lugar.')
  return c.json({ data })
}
