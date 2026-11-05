import type { Context } from 'hono'
import type { AppEnv } from '../context.js'

export function apiError(
  c: Context<AppEnv>,
  status: 400 | 401 | 403 | 404 | 409 | 422 | 503,
  code: string,
  message: string,
  details?: unknown,
) {
  return c.json({
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
      requestId: c.get('requestId'),
    },
  }, status)
}
