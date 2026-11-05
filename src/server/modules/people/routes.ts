import type { Context, Hono } from 'hono'
import type { AppEnv } from '../../context.js'
import { apiError } from '../../lib/responses.js'
import { isResponse, parseJson } from '../../lib/validation.js'
import { requireUser } from '../../middleware/require-user.js'
import { withDatabase } from '../../middleware/with-database.js'
import { createPersonSchema, personEventLinksSchema, personSearchSchema, updatePersonSchema } from '../../../shared/schemas/person.js'
import * as service from './service.js'

export function registerPeopleRoutes(app: Hono<AppEnv>) {
  app.get('/people', requireUser, withDatabase, async (c) => {
    const query = personSearchSchema.safeParse({ q: c.req.query('q') })
    if (!query.success) return apiError(c, 400, 'validation_error', 'Revisa el texto de búsqueda.')
    const data = await service.list(c.get('db'), c.get('userId'), c.req.query('archived') === 'true', query.data.q ?? '')
    return c.json({ data })
  })

  app.post('/people', requireUser, withDatabase, async (c) => {
    const input = await parseJson(c, createPersonSchema)
    if (isResponse(input)) return input
    const [data] = await service.create(c.get('db'), c.get('userId'), input)
    return c.json({ data }, 201)
  })

  app.get('/people/:id/events', requireUser, withDatabase, async (c) => {
    const data = await service.listEvents(c.get('db'), c.get('userId'), c.req.param('id'))
    if (!data) return apiError(c, 404, 'not_found', 'No encontramos a esa persona.')
    return c.json({ data })
  })

  app.put('/people/:id/events', requireUser, withDatabase, async (c) => {
    const input = await parseJson(c, personEventLinksSchema)
    if (isResponse(input)) return input
    try {
      const data = await service.replaceEvents(c.get('db'), c.get('userId'), c.req.param('id'), input.eventIds)
      if (!data) return apiError(c, 404, 'not_found', 'No encontramos a esa persona activa.')
      return c.json({ data })
    } catch (error) {
      if (error instanceof service.PersonRuleError) return apiError(c, 404, 'not_found', 'No encontramos uno o más eventos activos.')
      throw error
    }
  })

  app.patch('/people/:id', requireUser, withDatabase, async (c) => {
    const input = await parseJson(c, updatePersonSchema)
    if (isResponse(input)) return input
    const [data] = await service.update(c.get('db'), c.get('userId'), c.req.param('id'), input)
    if (!data) return apiError(c, 404, 'not_found', 'No encontramos a esa persona.')
    return c.json({ data })
  })

  app.post('/people/:id/archive', requireUser, withDatabase, async (c) => personState(c, service.archive(c.get('db'), c.get('userId'), c.req.param('id'))))
  app.post('/people/:id/restore', requireUser, withDatabase, async (c) => personState(c, service.restore(c.get('db'), c.get('userId'), c.req.param('id'))))
}

async function personState(c: Context<AppEnv>, operation: Promise<unknown>) {
  const [data] = await operation as [{ id: string }?]
  if (!data) return apiError(c, 404, 'not_found', 'No encontramos a esa persona.')
  return c.json({ data })
}
