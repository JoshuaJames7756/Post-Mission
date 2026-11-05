import { eq } from 'drizzle-orm'
import type { Hono } from 'hono'
import { z } from 'zod'
import type { AppEnv } from '../../context.js'
import { accountDeletions } from '../../db/schema.js'
import { isResponse, parseJson } from '../../lib/validation.js'
import { requireUser } from '../../middleware/require-user.js'
import { requireReverification } from '../../middleware/require-reverification.js'
import { withDatabase } from '../../middleware/with-database.js'
import { processAccountDeletion } from './service.js'

const confirmationSchema = z.strictObject({ confirmation: z.literal('BORRAR MI CUENTA') })

export function registerAccountDeletionRoutes(app: Hono<AppEnv>) {
  app.get('/account-deletion', requireUser, withDatabase, async (c) => {
    const [job] = await c.get('db').select({ state: accountDeletions.state, nextAttemptAt: accountDeletions.nextAttemptAt })
      .from(accountDeletions).where(eq(accountDeletions.userId, c.get('userId'))).limit(1)
    return c.json({ data: job ?? { state: 'none' } })
  })

  app.post('/account-deletion', requireUser, requireReverification, withDatabase, async (c) => {
    const input = await parseJson(c, confirmationSchema)
    if (isResponse(input)) return input
    const userId = c.get('userId')
    await c.get('db').insert(accountDeletions).values({ userId }).onConflictDoNothing({ target: accountDeletions.userId })
    const state = await processAccountDeletion(c.get('db'), c.env, userId)
    return c.json({ data: { state } }, state === 'complete' ? 200 : 202)
  })
}
