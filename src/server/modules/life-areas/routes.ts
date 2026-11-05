import type { Hono } from 'hono'
import type { AppEnv } from '../../context.js'
import { requireUser } from '../../middleware/require-user.js'
import { withDatabase } from '../../middleware/with-database.js'
import { apiError } from '../../lib/responses.js'
import { parseJson, isResponse } from '../../lib/validation.js'
import { createLifeAreaSchema, reorderLifeAreasSchema, updateLifeAreaSchema } from '../../../shared/schemas/life-area.js'
import * as service from './service.js'
import { LifeAreaRuleError } from './service.js'

export function registerLifeAreaRoutes(app: Hono<AppEnv>) {
  app.get('/life-areas', requireUser, withDatabase, async (c) => {
    const data = await service.list(c.get('db'), c.get('userId'), c.req.query('archived') === 'true')
    return c.json({ data })
  })

  app.patch('/life-areas/order', requireUser, withDatabase, async (c) => {
    const input = await parseJson(c, reorderLifeAreasSchema)
    if (isResponse(input)) return input
    try {
      const data = await service.reorder(c.get('db'), c.get('userId'), input)
      return c.json({ data })
    } catch (error) {
      if (error instanceof LifeAreaRuleError) return apiError(c, 409, 'area_order_changed', 'La lista de áreas cambió. Actualízala y vuelve a ordenar.')
      throw error
    }
  })

  app.post('/life-areas', requireUser, withDatabase, async (c) => {
    const input = await parseJson(c, createLifeAreaSchema)
    if (isResponse(input)) return input
    try {
      const [data] = await service.create(c.get('db'), c.get('userId'), input)
      return c.json({ data }, 201)
    } catch (error) {
      if (isUniqueViolation(error)) return apiError(c, 409, 'life_area_exists', 'Ya tienes un área con ese nombre.')
      throw error
    }
  })

  app.patch('/life-areas/:id', requireUser, withDatabase, async (c) => {
    const input = await parseJson(c, updateLifeAreaSchema)
    if (isResponse(input)) return input
    try {
      const [data] = await service.update(c.get('db'), c.get('userId'), c.req.param('id'), input)
      if (!data) return apiError(c, 404, 'not_found', 'No encontramos esa área.')
      return c.json({ data })
    } catch (error) {
      if (isUniqueViolation(error)) return apiError(c, 409, 'life_area_exists', 'Ya tienes un área activa con ese nombre.')
      throw error
    }
  })

  app.post('/life-areas/:id/archive', requireUser, withDatabase, async (c) => {
    const [data] = await service.archive(c.get('db'), c.get('userId'), c.req.param('id'))
    if (!data) return apiError(c, 404, 'not_found', 'No encontramos esa área.')
    return c.json({ data })
  })

  app.post('/life-areas/:id/restore', requireUser, withDatabase, async (c) => {
    try {
      const [data] = await service.restore(c.get('db'), c.get('userId'), c.req.param('id'))
      if (!data) return apiError(c, 404, 'not_found', 'No encontramos esa área.')
      return c.json({ data })
    } catch (error) {
      if (isUniqueViolation(error)) return apiError(c, 409, 'life_area_exists', 'Ya tienes un área activa con ese nombre.')
      throw error
    }
  })
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}
