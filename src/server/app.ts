import { Hono } from 'hono'
import type { AppEnv } from './context.js'
import { registerProfileRoutes } from './modules/profile/routes.js'
import { registerLifeAreaRoutes } from './modules/life-areas/routes.js'
import { registerGoalRoutes } from './modules/goals/routes.js'
import { registerTaskRoutes } from './modules/tasks/routes.js'
import { registerEventRoutes } from './modules/events/routes.js'
import { registerPeopleRoutes } from './modules/people/routes.js'
import { registerPlaceRoutes } from './modules/places/routes.js'
import { registerJourneyRoutes } from './modules/journey/routes.js'
import { registerNoteRoutes } from './modules/notes/routes.js'
import { registerReviewRoutes } from './modules/reviews/routes.js'
import { registerReminderRoutes } from './modules/reminders/routes.js'
import { registerArchiveRoutes } from './modules/archive/routes.js'
import { registerAccountDeletionRoutes } from './modules/account-deletion/routes.js'

export function createApp() {
  const app = new Hono<AppEnv>().basePath('/api/v1')

  app.use('*', async (c, next) => {
    const requestId = crypto.randomUUID()
    c.set('requestId', requestId)
    c.header('Cache-Control', 'no-store')
    c.header('X-Request-Id', requestId)
    await next()
  })

  app.get('/health', (c) => c.json({ data: { status: 'ok' } }))
  registerProfileRoutes(app)
  registerLifeAreaRoutes(app)
  registerGoalRoutes(app)
  registerTaskRoutes(app)
  registerEventRoutes(app)
  registerPeopleRoutes(app)
  registerPlaceRoutes(app)
  registerJourneyRoutes(app)
  registerNoteRoutes(app)
  registerReviewRoutes(app)
  registerReminderRoutes(app)
  registerArchiveRoutes(app)
  registerAccountDeletionRoutes(app)

  app.notFound((c) => c.json({
    error: {
      code: 'not_found',
      message: 'No encontramos esa ruta.',
      requestId: c.get('requestId'),
    },
  }, 404))

  app.onError((error, c) => {
    const requestId = c.get('requestId')
    const causes: Array<{ name: string; code?: string }> = []
    let current: unknown = error
    for (let depth = 0; depth < 3 && current instanceof Error; depth += 1) {
      const code = 'code' in current && typeof current.code === 'string' ? current.code : undefined
      causes.push({ name: current.name, ...(code ? { code } : {}) })
      current = current.cause
    }
    console.error('api_error', { requestId, method: c.req.method, route: c.req.routePath, causes })
    return c.json({
      error: {
        code: 'internal_error',
        message: 'Ocurrió un problema. Inténtalo de nuevo.',
        requestId,
      },
    }, 500)
  })

  return app
}

export const api = createApp()

export type { AppEnv } from './context.js'
