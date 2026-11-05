import type { Hono } from 'hono'
import type { AppEnv } from '../../context.js'
import { apiError } from '../../lib/responses.js'
import { requireUser } from '../../middleware/require-user.js'
import { withDatabase } from '../../middleware/with-database.js'
import { ExampleProfileRequiredError, seedExamples } from './service.js'

export function registerExampleRoutes(app: Hono<AppEnv>) {
  app.post('/examples', requireUser, withDatabase, async (c) => {
    try {
      const data = await seedExamples(c.get('db'), c.get('userId'))
      return c.json({ data }, data.created ? 201 : 200)
    } catch (error) {
      if (error instanceof ExampleProfileRequiredError) return apiError(c, 409, 'profile_required', 'Completa tu perfil antes de cargar ejemplos.')
      throw error
    }
  })
}
