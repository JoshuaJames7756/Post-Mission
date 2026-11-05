import { and, eq, isNull } from 'drizzle-orm'
import type { Hono } from 'hono'
import type { AppEnv } from '../../context.js'
import { lifeAreas, profiles } from '../../db/schema.js'
import { apiError } from '../../lib/responses.js'
import { requireUser } from '../../middleware/require-user.js'
import { withDatabase } from '../../middleware/with-database.js'
import { parseJson, isResponse } from '../../lib/validation.js'
import { updateProfileSchema } from '../../../shared/schemas/profile.js'

export function registerProfileRoutes(app: Hono<AppEnv>) {
  app.get('/me', requireUser, withDatabase, async (c) => {
    const [profile] = await c.get('db').select().from(profiles).where(eq(profiles.userId, c.get('userId'))).limit(1)
    return c.json({ data: profile ?? null })
  })

  app.patch('/me', requireUser, withDatabase, async (c) => {
    const input = await parseJson(c, updateProfileSchema)
    if (isResponse(input)) return input

    const now = new Date()
    const [profile] = await c.get('db').insert(profiles).values({
      userId: c.get('userId'),
      ...input,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: profiles.userId,
      set: { ...input, updatedAt: now },
    }).returning()

    return c.json({ data: profile })
  })

  app.post('/me/onboarding/complete', requireUser, withDatabase, async (c) => {
    const db = c.get('db')
    const userId = c.get('userId')
    const [profile] = await db.select({ onboardingCompletedAt: profiles.onboardingCompletedAt }).from(profiles)
      .where(eq(profiles.userId, userId)).limit(1)
    if (!profile) return apiError(c, 404, 'not_found', 'Guarda tu perfil para continuar.')
    if (profile.onboardingCompletedAt) return c.json({ data: { onboardingCompletedAt: profile.onboardingCompletedAt } })
    const [area] = await db.select({ id: lifeAreas.id }).from(lifeAreas)
      .where(and(eq(lifeAreas.userId, userId), isNull(lifeAreas.archivedAt))).limit(1)
    if (!area) return apiError(c, 409, 'area_required', 'Elige al menos un área de vida para comenzar.')
    const [updated] = await db.update(profiles).set({ onboardingCompletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(profiles.userId, userId), isNull(profiles.onboardingCompletedAt)))
      .returning({ onboardingCompletedAt: profiles.onboardingCompletedAt })
    if (updated) return c.json({ data: updated })
    const [completed] = await db.select({ onboardingCompletedAt: profiles.onboardingCompletedAt }).from(profiles)
      .where(eq(profiles.userId, userId)).limit(1)
    return c.json({ data: completed })
  })
}
