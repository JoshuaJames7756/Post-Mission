import type { Hono } from 'hono'
import type { Context } from 'hono'
import { z } from 'zod'
import type { AppEnv } from '../../context.js'
import { apiError } from '../../lib/responses.js'
import { isResponse, parseJson } from '../../lib/validation.js'
import { requireUser } from '../../middleware/require-user.js'
import { withDatabase } from '../../middleware/with-database.js'
import { createGoalSchema, updateGoalSchema } from '../../../shared/schemas/goal.js'
import * as service from './service.js'

export function registerGoalRoutes(app: Hono<AppEnv>) {
  app.get('/goals', requireUser, withDatabase, async (c) => c.json({ data: await service.list(c.get('db'), c.get('userId'), c.req.query('archived') === 'true') }))
  app.post('/goals', requireUser, withDatabase, async (c) => {
    const input = await parseJson(c, createGoalSchema)
    if (isResponse(input)) return input
    try { return c.json({ data: await service.create(c.get('db'), c.get('userId'), input) }, 201) }
    catch (error) { return ruleError(c, error) }
  })
  app.get('/goals/:id', requireUser, withDatabase, async (c) => {
    const id = goalId(c)
    if (!id) return goalNotFound(c)
    const [data] = await service.get(c.get('db'), c.get('userId'), id)
    if (!data) return apiError(c, 404, 'not_found', 'No encontramos esa meta.')
    return c.json({ data })
  })
  app.patch('/goals/:id', requireUser, withDatabase, async (c) => {
    const id = goalId(c)
    if (!id) return goalNotFound(c)
    const input = await parseJson(c, updateGoalSchema)
    if (isResponse(input)) return input
    try {
      const data = await service.update(c.get('db'), c.get('userId'), id, input)
      if (!data) return apiError(c, 404, 'not_found', 'No encontramos esa meta.')
      return c.json({ data })
    } catch (error) { return ruleError(c, error) }
  })
  app.post('/goals/:id/complete', requireUser, withDatabase, async (c) => goalState(c, (id) => service.complete(c.get('db'), c.get('userId'), id)))
  app.post('/goals/:id/reopen', requireUser, withDatabase, async (c) => goalState(c, (id) => service.reopen(c.get('db'), c.get('userId'), id)))
  app.post('/goals/:id/archive', requireUser, withDatabase, async (c) => {
    try { return await goalState(c, (id) => service.archive(c.get('db'), c.get('userId'), id)) }
    catch (error) { return ruleError(c, error) }
  })
  app.post('/goals/:id/restore', requireUser, withDatabase, async (c) => {
    try { return await goalState(c, (id) => service.restore(c.get('db'), c.get('userId'), id)) }
    catch (error) { return ruleError(c, error) }
  })
}

function goalId(c: Context<AppEnv>) {
  const parsed = z.uuid().safeParse(c.req.param('id'))
  return parsed.success ? parsed.data : null
}

function goalNotFound(c: Context<AppEnv>) {
  return apiError(c, 404, 'not_found', 'No encontramos esa meta.')
}

async function goalState(c: Context<AppEnv>, operation: (id: string) => Promise<unknown>) {
  const id = goalId(c)
  if (!id) return goalNotFound(c)
  const data = await operation(id) as { id: string } | undefined
  if (!data) return goalNotFound(c)
  return c.json({ data })
}

function ruleError(c: Context<AppEnv>, error: unknown) {
  if (!(error instanceof service.GoalRuleError)) throw error
  const messages = {
    invalid_parent: ['invalid_goal_hierarchy', 'La meta superior debe ser del periodo anterior y contener sus fechas.'],
    invalid_dates: ['invalid_goal_dates', 'La fecha objetivo debe ser igual o posterior al inicio.'],
    invalid_area: ['invalid_life_area', 'Selecciona un área activa de tu cuenta.'],
    goal_has_children: ['goal_has_children', 'Esta meta no puede cambiar porque invalidaría una meta inferior.'],
    goal_not_found: ['not_found', 'No encontramos esa meta.'],
    restore_conflict: ['restore_conflict', 'Restaura primero el área o la meta superior vinculada.'],
  } as const
  const [code, message] = messages[error.code]
  return apiError(c, error.code === 'goal_not_found' ? 404 : error.code === 'restore_conflict' ? 409 : 422, code, message)
}
