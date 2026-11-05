import { readFileSync } from 'node:fs'
import { Pool } from '@neondatabase/serverless'

const line = readFileSync('.dev.vars', 'utf8').split(/\r?\n/).find((entry) => entry.startsWith('DATABASE_URL='))
if (!line) throw new Error('DATABASE_URL missing in .dev.vars')
const connectionString = line.slice('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '')
const pool = new Pool({ connectionString, max: 1 })
try {
  const result = await pool.query('select state, count(*)::int as count from account_deletions group by state')
  console.log(result.rows)
} finally {
  await pool.end()
}
