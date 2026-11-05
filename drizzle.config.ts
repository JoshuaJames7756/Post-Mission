import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { defineConfig } from 'drizzle-kit'

if (existsSync('.dev.vars')) loadEnvFile('.dev.vars')

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://local:local@localhost:5432/post_mission',
  },
  strict: true,
  verbose: true,
})
