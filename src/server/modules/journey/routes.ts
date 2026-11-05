import { and, asc, desc, eq, isNotNull, isNull } from 'drizzle-orm'
import type { Hono } from 'hono'
import { z } from 'zod'
import type { AppEnv } from '../../context.js'
import { journeyMilestones, profiles } from '../../db/schema.js'
import { apiError } from '../../lib/responses.js'
import { isResponse, parseJson } from '../../lib/validation.js'
import { requireUser } from '../../middleware/require-user.js'
import { withDatabase } from '../../middleware/with-database.js'
import { getCalendarDate } from '../../../date-utils.js'
import { createMilestoneSchema, updateJourneySchema, updateMilestoneSchema } from '../../../shared/schemas/journey.js'

export function registerJourneyRoutes(app: Hono<AppEnv>) {
  app.get('/journey', requireUser, withDatabase, async (c) => {
    const [profile] = await c.get('db').select({ returnDate: profiles.returnDate, displayMode: profiles.journeyDisplayMode, timezone: profiles.timezone })
      .from(profiles).where(eq(profiles.userId, c.get('userId'))).limit(1)
    if (!profile) return apiError(c, 404, 'not_found', 'Configura tu perfil para continuar.')
    return c.json({ data: profile })
  })

  app.patch('/journey', requireUser, withDatabase, async (c) => {
    const input = await parseJson(c, updateJourneySchema)
    if (isResponse(input)) return input
    const [profile] = await c.get('db').select({ timezone: profiles.timezone }).from(profiles)
      .where(eq(profiles.userId, c.get('userId'))).limit(1)
    if (!profile) return apiError(c, 404, 'not_found', 'Configura tu perfil para continuar.')
    if (input.returnDate && input.returnDate > getCalendarDate(new Date(), profile.timezone)) {
      return apiError(c, 400, 'validation_error', 'La fecha de regreso no puede estar en el futuro.')
    }
    const [updated] = await c.get('db').update(profiles).set({
      ...(input.returnDate !== undefined ? { returnDate: input.returnDate } : {}),
      ...(input.displayMode !== undefined ? { journeyDisplayMode: input.displayMode } : {}),
      updatedAt: new Date(),
    }).where(eq(profiles.userId, c.get('userId')))
      .returning({ returnDate: profiles.returnDate, displayMode: profiles.journeyDisplayMode, timezone: profiles.timezone })
    return c.json({ data: updated })
  })

  app.get('/journey/milestones', requireUser, withDatabase, async (c) => {
    const archived = c.req.query('archived') === 'true'
    const data = await c.get('db').select().from(journeyMilestones).where(and(
      eq(journeyMilestones.userId, c.get('userId')),
      archived ? isNotNull(journeyMilestones.archivedAt) : isNull(journeyMilestones.archivedAt),
    )).orderBy(archived ? desc(journeyMilestones.updatedAt) : asc(journeyMilestones.milestoneDate))
    return c.json({ data })
  })

  app.post('/journey/milestones', requireUser, withDatabase, async (c) => {
    const input = await parseJson(c, createMilestoneSchema)
    if (isResponse(input)) return input
    const [profile] = await c.get('db').select({ userId: profiles.userId }).from(profiles).where(eq(profiles.userId, c.get('userId'))).limit(1)
    if (!profile) return apiError(c, 404, 'not_found', 'Configura tu perfil para continuar.')
    const [data] = await c.get('db').insert(journeyMilestones).values({ ...input, userId: c.get('userId') }).returning()
    return c.json({ data }, 201)
  })

  app.patch('/journey/milestones/:id', requireUser, withDatabase, async (c) => {
    const id = z.uuid().safeParse(c.req.param('id'))
    if (!id.success) return apiError(c, 404, 'not_found', 'No encontramos ese hito.')
    const input = await parseJson(c, updateMilestoneSchema)
    if (isResponse(input)) return input
    const [data] = await c.get('db').update(journeyMilestones).set({ ...input, updatedAt: new Date() }).where(and(
      eq(journeyMilestones.id, id.data), eq(journeyMilestones.userId, c.get('userId')), isNull(journeyMilestones.archivedAt),
    )).returning()
    if (!data) return apiError(c, 404, 'not_found', 'No encontramos ese hito.')
    return c.json({ data })
  })

  for (const [action, archived] of [['archive', true], ['restore', false]] as const) {
    app.post(`/journey/milestones/:id/${action}`, requireUser, withDatabase, async (c) => {
      const id = z.uuid().safeParse(c.req.param('id'))
      if (!id.success) return apiError(c, 404, 'not_found', 'No encontramos ese hito.')
      const [data] = await c.get('db').update(journeyMilestones).set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() }).where(and(
        eq(journeyMilestones.id, id.data), eq(journeyMilestones.userId, c.get('userId')),
        archived ? isNull(journeyMilestones.archivedAt) : isNotNull(journeyMilestones.archivedAt),
      )).returning()
      if (!data) return apiError(c, 404, 'not_found', 'No encontramos ese hito.')
      return c.json({ data })
    })
  }
}
