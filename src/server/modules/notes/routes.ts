import type { Hono } from 'hono'
import { z } from 'zod'
import type { AppEnv } from '../../context.js'
import { apiError } from '../../lib/responses.js'
import { isResponse, parseJson } from '../../lib/validation.js'
import { requireUser } from '../../middleware/require-user.js'
import { withDatabase } from '../../middleware/with-database.js'
import { saveNoteSchema } from '../../../shared/schemas/note.js'
import * as service from './service.js'

export function registerNoteRoutes(app: Hono<AppEnv>) {
  app.get('/notes', requireUser, withDatabase, async (c) => c.json({ data: await service.list(c.get('db'), c.get('userId'), c.req.query('archived') === 'true') }))
  app.get('/notes/link-options', requireUser, withDatabase, async (c) => c.json({ data: await service.linkOptions(c.get('db'), c.get('userId')) }))

  app.post('/notes', requireUser, withDatabase, async (c) => {
    const input = await parseJson(c, saveNoteSchema)
    if (isResponse(input)) return input
    try { return c.json({ data: await service.create(c.get('db'), c.get('userId'), input) }, 201) }
    catch (error) { if (error instanceof service.NoteLinkError) return apiError(c, 404, 'not_found', 'No encontramos uno o más vínculos.') ; throw error }
  })

  app.put('/notes/:id', requireUser, withDatabase, async (c) => {
    const id = z.uuid().safeParse(c.req.param('id'))
    if (!id.success) return apiError(c, 404, 'not_found', 'No encontramos esa nota.')
    const input = await parseJson(c, saveNoteSchema)
    if (isResponse(input)) return input
    try {
      const data = await service.update(c.get('db'), c.get('userId'), id.data, input)
      if (!data) return apiError(c, 404, 'not_found', 'No encontramos esa nota.')
      return c.json({ data })
    } catch (error) { if (error instanceof service.NoteLinkError) return apiError(c, 404, 'not_found', 'No encontramos uno o más vínculos.'); throw error }
  })

  for (const [action, archived] of [['archive', true], ['restore', false]] as const) {
    app.post(`/notes/:id/${action}`, requireUser, withDatabase, async (c) => {
      const id = z.uuid().safeParse(c.req.param('id'))
      if (!id.success) return apiError(c, 404, 'not_found', 'No encontramos esa nota.')
      const [data] = await service.setArchived(c.get('db'), c.get('userId'), id.data, archived)
      if (!data) return apiError(c, 404, 'not_found', 'No encontramos esa nota.')
      return c.json({ data })
    })
  }
}
