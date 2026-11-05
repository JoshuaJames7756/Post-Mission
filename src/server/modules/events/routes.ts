import type { Context, Hono } from 'hono'
import { z } from 'zod'
import type { AppEnv } from '../../context.js'
import { apiError } from '../../lib/responses.js'
import { isResponse, parseJson } from '../../lib/validation.js'
import { requireUser } from '../../middleware/require-user.js'
import { withDatabase } from '../../middleware/with-database.js'
import { createEventSchema, eventRangeQuerySchema } from '../../../shared/schemas/event.js'
import * as service from './service.js'

export function registerEventRoutes(app: Hono<AppEnv>) {
  app.get('/events', requireUser, withDatabase, async (c) => {
    const range = eventRangeQuerySchema.safeParse({
      from: c.req.query('from'),
      to: c.req.query('to'),
      timeZone: c.req.query('timeZone'),
    })
    if (!range.success) {
      const details = range.error.issues.map(({ path, message }) => ({ path, message }))
      return apiError(c, 400, 'validation_error', 'Revisa el intervalo del calendario.', details)
    }
    try {
      const data = await service.list(c.get('db'), c.get('userId'), range.data, c.req.query('archived') === 'true')
      return c.json({ data })
    } catch (error) { return eventError(c, error) }
  })

  app.post('/events', requireUser, withDatabase, async (c) => {
    const input = await parseJson(c, createEventSchema)
    if (isResponse(input)) return input
    try { return c.json({ data: await service.create(c.get('db'), c.get('userId'), input) }, 201) }
    catch (error) { return eventError(c, error) }
  })

  app.get('/events/:id', requireUser, withDatabase, async (c) => {
    const id = eventId(c)
    if (!id) return eventNotFound(c)
    const [data] = await service.get(c.get('db'), c.get('userId'), id)
    if (!data) return apiError(c, 404, 'not_found', 'No encontramos ese evento.')
    return c.json({ data })
  })

  app.patch('/events/:id', requireUser, withDatabase, async (c) => {
    const id = eventId(c)
    if (!id) return eventNotFound(c)
    const input = await parseJson(c, createEventSchema)
    if (isResponse(input)) return input
    try {
      const data = await service.update(c.get('db'), c.get('userId'), id, input)
      if (!data) return apiError(c, 404, 'not_found', 'No encontramos ese evento.')
      return c.json({ data })
    } catch (error) { return eventError(c, error) }
  })

  app.post('/events/:id/complete', requireUser, withDatabase, async (c) => eventState(c, (id) => service.setStatus(c.get('db'), c.get('userId'), id, 'completed')))
  app.post('/events/:id/cancel', requireUser, withDatabase, async (c) => eventState(c, (id) => service.setStatus(c.get('db'), c.get('userId'), id, 'cancelled')))
  app.post('/events/:id/archive', requireUser, withDatabase, async (c) => eventState(c, (id) => service.archive(c.get('db'), c.get('userId'), id)))
  app.post('/events/:id/restore', requireUser, withDatabase, async (c) => {
    try { return await eventState(c, (id) => service.restore(c.get('db'), c.get('userId'), id)) }
    catch (error) { return eventError(c, error) }
  })
}

function eventId(c: Context<AppEnv>) {
  const parsed = z.uuid().safeParse(c.req.param('id'))
  return parsed.success ? parsed.data : null
}

function eventNotFound(c: Context<AppEnv>) {
  return apiError(c, 404, 'not_found', 'No encontramos ese evento.')
}

async function eventState(c: Context<AppEnv>, operation: (id: string) => Promise<unknown>) {
  const id = eventId(c)
  if (!id) return eventNotFound(c)
  const data = await operation(id) as { id: string } | undefined
  if (!data) return eventNotFound(c)
  return c.json({ data })
}

function eventError(c: Context<AppEnv>, error: unknown) {
  if (error instanceof service.EventRuleError) {
    if (error.code === 'restore_conflict') return apiError(c, 409, 'restore_conflict', 'Restaura primero la meta activa vinculada a este evento.')
    if (error.code === 'invalid_goal') return apiError(c, 404, 'not_found', 'No encontramos esa meta activa.')
    return apiError(c, 422, 'invalid_event_duration', 'La hora final debe ser posterior a la inicial.')
  }
  if (error instanceof service.CalendarTimeError) {
    const messages = {
      invalid_local_datetime: ['invalid_event_time', 'Revisa la fecha y la hora.'],
      invalid_time_zone: ['invalid_time_zone', 'Selecciona una zona horaria válida.'],
      nonexistent_local_time: ['nonexistent_local_time', 'Esa hora no existe en la zona elegida por un cambio de horario.'],
      ambiguous_local_time: ['ambiguous_local_time', 'Esa hora ocurre dos veces; elige el desfase correcto.'],
      invalid_offset: ['invalid_event_offset', 'El desfase no coincide con la zona horaria elegida.'],
    } as const
    const [code, message] = messages[error.code]
    return apiError(c, 422, code, message)
  }
  throw error
}
