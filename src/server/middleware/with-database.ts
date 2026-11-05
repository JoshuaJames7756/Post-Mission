import type { MiddlewareHandler } from 'hono'
import type { AppEnv } from '../context.js'
import { createDb } from '../db/client.js'
import { accountDeletions } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { apiError } from '../lib/responses.js'

export const withDatabase: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.env.DATABASE_URL) {
    return apiError(c, 503, 'database_unavailable', 'Tu espacio no está disponible por el momento. Inténtalo de nuevo más tarde.')
  }

  const connection = createDb(c.env)
  c.set('db', connection.db)
  try {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) && !c.req.path.startsWith('/api/v1/account-deletion')) {
      const [pending] = await connection.db.select({ userId: accountDeletions.userId }).from(accountDeletions)
        .where(eq(accountDeletions.userId, c.get('userId'))).limit(1)
      if (pending) return apiError(c, 409, 'account_deletion_pending', 'La eliminación de tu cuenta está en curso. No se pueden guardar cambios nuevos.')
    }
    await next()
  } finally {
    c.executionCtx.waitUntil(connection.close().catch((error: unknown) => {
      console.error('database_close_error', { requestId: c.get('requestId'), name: error instanceof Error ? error.name : 'UnknownError' })
    }))
  }
}
