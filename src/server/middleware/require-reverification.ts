import { reverificationErrorResponse } from '@clerk/backend/internal'
import type { MiddlewareHandler } from 'hono'
import type { AppEnv } from '../context.js'

export const requireReverification: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get('recentlyVerified')) return reverificationErrorResponse('strict')
  await next()
}
