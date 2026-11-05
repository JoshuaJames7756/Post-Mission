import { and, desc, eq, sql } from 'drizzle-orm'
import type { Context, Hono } from 'hono'
import { z } from 'zod'
import type { AppEnv } from '../../context.js'
import { profiles, reviews } from '../../db/schema.js'
import { apiError } from '../../lib/responses.js'
import { isResponse, parseJson } from '../../lib/validation.js'
import { requireUser } from '../../middleware/require-user.js'
import { withDatabase } from '../../middleware/with-database.js'
import { getCalendarDate } from '../../../date-utils.js'
import { periodStart } from '../../../review-period.js'
import { reviewPeriodTypeSchema, reviewRevisionSchema, saveReviewSchema } from '../../../shared/schemas/review.js'

function periodParams(c: Context<AppEnv>) {
  const type = reviewPeriodTypeSchema.safeParse(c.req.param('type'))
  const start = z.iso.date().safeParse(c.req.param('start'))
  if (!type.success || !start.success || periodStart(start.data, type.data) !== start.data) return null
  return { type: type.data, start: start.data }
}

export function registerReviewRoutes(app: Hono<AppEnv>) {
  app.get('/reviews', requireUser, withDatabase, async (c) => {
    const type = c.req.query('type')
    const parsed = type ? reviewPeriodTypeSchema.safeParse(type) : null
    if (parsed && !parsed.success) return apiError(c, 400, 'validation_error', 'Revisa el tipo de revisión.')
    const data = await c.get('db').select().from(reviews).where(and(
      eq(reviews.userId, c.get('userId')),
      parsed?.success ? eq(reviews.periodType, parsed.data) : undefined,
    )).orderBy(desc(reviews.periodStart)).limit(24)
    return c.json({ data })
  })

  app.get('/reviews/:type/:start', requireUser, withDatabase, async (c) => {
    const period = periodParams(c)
    if (!period) return apiError(c, 400, 'validation_error', 'Revisa el periodo de la revisión.')
    const [data] = await c.get('db').select().from(reviews).where(and(
      eq(reviews.userId, c.get('userId')), eq(reviews.periodType, period.type), eq(reviews.periodStart, period.start),
    )).limit(1)
    return c.json({ data: data ?? null })
  })

  app.put('/reviews/:type/:start', requireUser, withDatabase, async (c) => {
    const period = periodParams(c)
    if (!period) return apiError(c, 400, 'validation_error', 'Revisa el periodo de la revisión.')
    const input = await parseJson(c, saveReviewSchema)
    if (isResponse(input)) return input
    const [profile] = await c.get('db').select({ timezone: profiles.timezone }).from(profiles).where(eq(profiles.userId, c.get('userId'))).limit(1)
    if (!profile) return apiError(c, 404, 'not_found', 'Configura tu perfil para continuar.')
    const today = getCalendarDate(new Date(), profile.timezone)
    if (period.start > periodStart(today, period.type)) return apiError(c, 400, 'validation_error', 'No puedes escribir una revisión futura.')
    if (input.baseRevision !== 0) {
      const [existing] = await c.get('db').select({ id: reviews.id }).from(reviews).where(and(
        eq(reviews.userId, c.get('userId')), eq(reviews.periodType, period.type), eq(reviews.periodStart, period.start),
      )).limit(1)
      if (!existing) return apiError(c, 409, 'review_conflict', 'La revisión cambió. Vuelve a cargarla antes de guardar.')
    }
    const [data] = await c.get('db').insert(reviews).values({
      userId: c.get('userId'), periodType: period.type, periodStart: period.start,
      wins: input.wins, challenges: input.challenges, reflection: input.reflection, nextSteps: input.nextSteps,
    }).onConflictDoUpdate({
      target: [reviews.userId, reviews.periodType, reviews.periodStart],
      set: { wins: input.wins, challenges: input.challenges, reflection: input.reflection, nextSteps: input.nextSteps, revision: sql`${reviews.revision} + 1`, updatedAt: new Date() },
      setWhere: sql`${reviews.revision} = ${input.baseRevision} and ${reviews.status} = 'draft'`,
    }).returning()
    if (!data) return apiError(c, 409, 'review_conflict', 'La revisión cambió. Vuelve a cargarla antes de guardar.')
    return c.json({ data })
  })

  for (const [action, from, to] of [['complete', 'draft', 'completed'], ['reopen', 'completed', 'draft']] as const) {
    app.post(`/reviews/:type/:start/${action}`, requireUser, withDatabase, async (c) => {
      const period = periodParams(c)
      if (!period) return apiError(c, 400, 'validation_error', 'Revisa el periodo de la revisión.')
      const input = await parseJson(c, reviewRevisionSchema)
      if (isResponse(input)) return input
      const [data] = await c.get('db').update(reviews).set({
        status: to, completedAt: to === 'completed' ? new Date() : null,
        revision: sql`${reviews.revision} + 1`, updatedAt: new Date(),
      }).where(and(
        eq(reviews.userId, c.get('userId')), eq(reviews.periodType, period.type), eq(reviews.periodStart, period.start),
        eq(reviews.status, from), eq(reviews.revision, input.baseRevision),
      )).returning()
      if (!data) return apiError(c, 409, 'review_conflict', 'La revisión cambió. Vuelve a cargarla antes de continuar.')
      return c.json({ data })
    })
  }
}
