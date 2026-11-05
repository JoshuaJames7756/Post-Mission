import type { ZodType } from 'zod'
import type { Context } from 'hono'
import type { AppEnv } from '../context.js'
import { apiError } from './responses.js'

export async function parseJson<TSchema extends ZodType>(
  c: Context<AppEnv>,
  schema: TSchema,
): Promise<Awaited<TSchema['_output']> | Response> {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return apiError(c, 400, 'validation_error', 'Revisa la información e inténtalo de nuevo.')
  }

  const result = schema.safeParse(body)
  if (!result.success) {
    const details = result.error.issues.map(({ path, message }) => ({ path, message }))
    return apiError(c, 400, 'validation_error', 'Revisa los campos marcados.', details)
  }
  return result.data as Awaited<TSchema['_output']>
}

export function isResponse(value: unknown): value is Response {
  return value instanceof Response
}
