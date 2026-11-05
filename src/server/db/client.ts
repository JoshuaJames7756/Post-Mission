import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import * as schema from './schema.js'
import type { WorkerBindings } from '../env.js'

export function createDb(env: WorkerBindings) {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured')
  }

  const pool = new Pool({ connectionString: env.DATABASE_URL, max: 1 })
  const db = drizzle({ client: pool, schema })

  return {
    db,
    close: () => pool.end(),
  }
}

export type Database = ReturnType<typeof createDb>['db']
