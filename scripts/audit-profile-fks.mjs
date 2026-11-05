import { readFileSync } from 'node:fs'
import { Pool } from '@neondatabase/serverless'

const line = readFileSync('.dev.vars', 'utf8').split(/\r?\n/).find((entry) => entry.startsWith('DATABASE_URL='))
if (!line) throw new Error('DATABASE_URL missing in .dev.vars')
const connectionString = line.slice('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '')
const pool = new Pool({ connectionString, max: 1 })
const tables = ['events', 'goals', 'life_areas', 'notes', 'people', 'places', 'tasks']
try {
  for (const table of tables) {
    const result = await pool.query(`select count(*)::int as count from ${table} child left join profiles parent on parent.user_id = child.user_id where parent.user_id is null`)
    console.log(`${table}: ${result.rows[0]?.count ?? 'unknown'} orphan rows`)
  }
} finally {
  await pool.end()
}
