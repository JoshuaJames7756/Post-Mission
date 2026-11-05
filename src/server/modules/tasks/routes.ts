import type { Context, Hono } from 'hono'
import { z } from 'zod'
import type { AppEnv } from '../../context.js'
import { apiError } from '../../lib/responses.js'
import { isResponse, parseJson } from '../../lib/validation.js'
import { requireUser } from '../../middleware/require-user.js'
import { withDatabase } from '../../middleware/with-database.js'
import { createTaskSchema, updateTaskSchema } from '../../../shared/schemas/task.js'
import * as service from './service.js'

export function registerTaskRoutes(app: Hono<AppEnv>) {
  app.get('/tasks', requireUser, withDatabase, async (c) => c.json({ data: await service.list(c.get('db'), c.get('userId'), c.req.query('archived') === 'true') }))
  app.post('/tasks', requireUser, withDatabase, async (c) => {
    const input = await parseJson(c, createTaskSchema)
    if (isResponse(input)) return input
    try { return c.json({ data: await service.create(c.get('db'), c.get('userId'), input) }, 201) }
    catch (error) { return taskError(c, error) }
  })
  app.get('/tasks/:id', requireUser, withDatabase, async (c) => {
    const id = taskId(c)
    if (!id) return taskNotFound(c)
    const [data] = await service.get(c.get('db'), c.get('userId'), id)
    if (!data) return apiError(c, 404, 'not_found', 'No encontramos esa tarea.')
    return c.json({ data })
  })
  app.patch('/tasks/:id', requireUser, withDatabase, async (c) => {
    const id = taskId(c)
    if (!id) return taskNotFound(c)
    const input = await parseJson(c, updateTaskSchema)
    if (isResponse(input)) return input
    try {
      const data = await service.update(c.get('db'), c.get('userId'), id, input)
      if (!data) return apiError(c, 404, 'not_found', 'No encontramos esa tarea.')
      return c.json({ data })
    } catch (error) { return taskError(c, error) }
  })
  app.post('/tasks/:id/complete', requireUser, withDatabase, async (c) => taskState(c, (id) => service.setStatus(c.get('db'), c.get('userId'), id, 'completed')))
  app.post('/tasks/:id/reopen', requireUser, withDatabase, async (c) => taskState(c, (id) => service.setStatus(c.get('db'), c.get('userId'), id, 'open')))
  app.post('/tasks/:id/archive', requireUser, withDatabase, async (c) => taskState(c, (id) => service.archive(c.get('db'), c.get('userId'), id)))
  app.post('/tasks/:id/restore', requireUser, withDatabase, async (c) => {
    try { return await taskState(c, (id) => service.restore(c.get('db'), c.get('userId'), id)) }
    catch (error) { return taskError(c, error) }
  })
}

function taskId(c: Context<AppEnv>) {
  const parsed = z.uuid().safeParse(c.req.param('id'))
  return parsed.success ? parsed.data : null
}

function taskNotFound(c: Context<AppEnv>) {
  return apiError(c, 404, 'not_found', 'No encontramos esa tarea.')
}

async function taskState(c: Context<AppEnv>, operation: (id: string) => Promise<unknown>) {
  const id = taskId(c)
  if (!id) return taskNotFound(c)
  const data = await operation(id) as { id: string } | undefined
  if (!data) return taskNotFound(c)
  return c.json({ data })
}

function taskError(c: Context<AppEnv>, error: unknown) {
  if (!(error instanceof service.TaskRuleError)) throw error
  if (error.code === 'restore_conflict') return apiError(c, 409, 'restore_conflict', 'Restaura primero la meta vinculada a esta tarea.')
  return apiError(c, 404, 'not_found', 'No encontramos esa meta activa.')
}
