import { sql } from 'drizzle-orm'
import type { Hono } from 'hono'
import { z } from 'zod'
import type { AppEnv } from '../../context.js'
import { apiError } from '../../lib/responses.js'
import { requireUser } from '../../middleware/require-user.js'
import { withDatabase } from '../../middleware/with-database.js'

const kinds = ['areas', 'goals', 'tasks', 'events', 'people', 'places', 'milestones', 'notes'] as const
const querySchema = z.object({
  kind: z.enum(['all', ...kinds]).default('all'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  q: z.string().trim().max(100).default(''),
}).strict()
const pageSize = 24

export function registerArchiveRoutes(app: Hono<AppEnv>) {
  app.get('/archive', requireUser, withDatabase, async (c) => {
    const parsed = querySchema.safeParse({
      kind: c.req.query('kind') ?? 'all',
      page: c.req.query('page') ?? '1',
      q: c.req.query('q') ?? '',
    })
    if (!parsed.success) return apiError(c, 400, 'validation_error', 'Revisa los filtros del archivo.')
    const { kind, page, q } = parsed.data
    const userId = c.get('userId')
    const sources = {
      areas: sql`select 'areas' as kind, id::text as id, name as title, archived_at from life_areas where user_id = ${userId} and archived_at is not null`,
      goals: sql`select 'goals' as kind, id::text as id, title, archived_at from goals where user_id = ${userId} and archived_at is not null`,
      tasks: sql`select 'tasks' as kind, id::text as id, title, archived_at from tasks where user_id = ${userId} and archived_at is not null`,
      events: sql`select 'events' as kind, id::text as id, title, archived_at from events where user_id = ${userId} and archived_at is not null`,
      people: sql`select 'people' as kind, id::text as id, name as title, archived_at from people where user_id = ${userId} and archived_at is not null`,
      places: sql`select 'places' as kind, id::text as id, name as title, archived_at from places where user_id = ${userId} and archived_at is not null`,
      milestones: sql`select 'milestones' as kind, id::text as id, title, archived_at from journey_milestones where user_id = ${userId} and archived_at is not null`,
      notes: sql`select 'notes' as kind, id::text as id, title, archived_at from notes where user_id = ${userId} and archived_at is not null`,
    }
    const selected = kind === 'all' ? kinds.map((entry) => sources[entry]) : [sources[kind]]
    const result = await c.get('db').execute(sql`
      select kind, id, title, archived_at as "archivedAt" from (${sql.join(selected, sql` union all `)}) archived
      ${q ? sql`where title ilike ${`%${q.replace(/[\\%_]/g, '\\$&')}%`} escape '\'` : sql``}
      order by archived_at desc, kind, id
      limit ${pageSize + 1} offset ${(page - 1) * pageSize}
    `)
    const rows = result.rows as { kind: typeof kinds[number]; id: string; title: string; archivedAt: Date | string }[]
    return c.json({ data: {
      items: rows.slice(0, pageSize).map((row) => ({ kind: row.kind, id: row.id, title: row.title, archivedAt: new Date(row.archivedAt).toISOString() })),
      page,
      hasMore: rows.length > pageSize,
    } })
  })
}
