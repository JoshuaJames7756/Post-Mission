import { and, asc, eq, gte, isNotNull, isNull, lte, or } from 'drizzle-orm'
import type { Hono } from 'hono'
import type { AppEnv } from '../../context.js'
import { events, profiles, reminderDismissals, reviews, tasks } from '../../db/schema.js'
import { apiError } from '../../lib/responses.js'
import { isResponse, parseJson } from '../../lib/validation.js'
import { requireUser } from '../../middleware/require-user.js'
import { withDatabase } from '../../middleware/with-database.js'
import { addCalendarDays, getCalendarDate } from '../../../date-utils.js'
import { weekStart } from '../../../review-period.js'
import { reminderCategorySchema, reminderPreferencesSchema } from '../../../shared/schemas/reminder.js'

export function registerReminderRoutes(app: Hono<AppEnv>) {
  app.get('/reminders', requireUser, withDatabase, async (c) => {
    const db = c.get('db')
    const userId = c.get('userId')
    const [profile] = await db.select({
      timezone: profiles.timezone,
      remindTasks: profiles.remindTasks,
      remindEvents: profiles.remindEvents,
      remindReviews: profiles.remindReviews,
    }).from(profiles).where(eq(profiles.userId, userId)).limit(1)
    if (!profile) return c.json({ data: { preferences: null, items: [] } })

    const now = new Date()
    const today = getCalendarDate(now, profile.timezone)
    const tomorrow = addCalendarDays(today, 1)
    const dismissed = await db.select({ category: reminderDismissals.category })
      .from(reminderDismissals).where(and(eq(reminderDismissals.userId, userId), eq(reminderDismissals.localDate, today)))
    const hidden = new Set(dismissed.map((row) => row.category))
    const items: { category: 'tasks' | 'events' | 'reviews'; title: string; detail: string; href: string }[] = []

    if (profile.remindTasks && !hidden.has('tasks')) {
      const dueTasks = await db.select({ title: tasks.title, dueAt: tasks.dueAt })
        .from(tasks).where(and(eq(tasks.userId, userId), eq(tasks.status, 'open'), isNull(tasks.archivedAt), isNotNull(tasks.dueAt), lte(tasks.dueAt, new Date(now.getTime() + 48 * 60 * 60 * 1000))))
        .orderBy(asc(tasks.dueAt)).limit(30)
      const first = dueTasks.find((task) => task.dueAt && getCalendarDate(task.dueAt, profile.timezone) <= today)
      if (first?.dueAt) items.push({ category: 'tasks', title: 'Tarea pendiente', detail: `${first.title} · ${getCalendarDate(first.dueAt, profile.timezone) < today ? 'pendiente' : 'para hoy'}`, href: '#tasks' })
    }

    if (profile.remindEvents && !hidden.has('events')) {
      const upcoming = await db.select({ title: events.title, allDay: events.allDay, startDate: events.startDate, startAt: events.startAt })
        .from(events).where(and(eq(events.userId, userId), eq(events.status, 'scheduled'), isNull(events.archivedAt), or(
          and(eq(events.allDay, true), gte(events.startDate, today), lte(events.startDate, tomorrow)),
          and(eq(events.allDay, false), gte(events.startAt, now), lte(events.startAt, new Date(now.getTime() + 24 * 60 * 60 * 1000))),
        ))).limit(30)
      const first = upcoming.sort((a, b) => {
        const aTime = a.allDay ? `${a.startDate}T00:00` : a.startAt?.toISOString() ?? ''
        const bTime = b.allDay ? `${b.startDate}T00:00` : b.startAt?.toISOString() ?? ''
        return aTime.localeCompare(bTime)
      })[0]
      if (first) items.push({ category: 'events', title: 'Próximo evento', detail: `${first.title} · ${first.allDay ? (first.startDate === today ? 'hoy' : 'mañana') : new Intl.DateTimeFormat('es', { timeZone: profile.timezone, weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(first.startAt!)}`, href: '#calendar' })
    }

    if (profile.remindReviews && !hidden.has('reviews')) {
      const recent = await db.select({ periodType: reviews.periodType, periodStart: reviews.periodStart })
        .from(reviews).where(and(eq(reviews.userId, userId), eq(reviews.status, 'draft'), or(
          and(eq(reviews.periodType, 'daily'), gte(reviews.periodStart, addCalendarDays(today, -7)), lte(reviews.periodStart, addCalendarDays(today, -1))),
          and(eq(reviews.periodType, 'weekly'), gte(reviews.periodStart, addCalendarDays(today, -28)), lte(reviews.periodStart, addCalendarDays(weekStart(today), -7))),
        ))).orderBy(asc(reviews.periodStart)).limit(1)
      const first = recent[0]
      if (first) items.push({ category: 'reviews', title: 'Revisión por terminar', detail: `Tu revisión ${first.periodType === 'daily' ? 'diaria' : 'semanal'} del ${first.periodStart} sigue en borrador.`, href: `#reviews/${first.periodType}/${first.periodStart}` })
    }

    return c.json({ data: { preferences: { remindTasks: profile.remindTasks, remindEvents: profile.remindEvents, remindReviews: profile.remindReviews }, items } })
  })

  app.patch('/reminders/preferences', requireUser, withDatabase, async (c) => {
    const input = await parseJson(c, reminderPreferencesSchema)
    if (isResponse(input)) return input
    const [profile] = await c.get('db').update(profiles).set({ ...input, updatedAt: new Date() })
      .where(eq(profiles.userId, c.get('userId'))).returning({ remindTasks: profiles.remindTasks, remindEvents: profiles.remindEvents, remindReviews: profiles.remindReviews })
    if (!profile) return apiError(c, 404, 'not_found', 'Configura tu perfil para continuar.')
    return c.json({ data: profile })
  })

  app.post('/reminders/:category/dismiss', requireUser, withDatabase, async (c) => {
    const category = reminderCategorySchema.safeParse(c.req.param('category'))
    if (!category.success) return apiError(c, 400, 'validation_error', 'Revisa el tipo de aviso.')
    const [profile] = await c.get('db').select({ timezone: profiles.timezone }).from(profiles)
      .where(eq(profiles.userId, c.get('userId'))).limit(1)
    if (!profile) return apiError(c, 404, 'not_found', 'Configura tu perfil para continuar.')
    const localDate = getCalendarDate(new Date(), profile.timezone)
    await c.get('db').insert(reminderDismissals).values({ userId: c.get('userId'), category: category.data, localDate })
      .onConflictDoNothing({ target: [reminderDismissals.userId, reminderDismissals.category, reminderDismissals.localDate] })
    return c.json({ data: { category: category.data, localDate } })
  })
}
