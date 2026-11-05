import { createClerkClient } from '@clerk/backend'
import type { MiddlewareHandler } from 'hono'
import type { AppEnv } from '../context.js'
import { apiError } from '../lib/responses.js'

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const { APP_ORIGIN, CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, CLERK_JWT_KEY } = c.env
  if (!APP_ORIGIN || !CLERK_PUBLISHABLE_KEY || !CLERK_SECRET_KEY) {
    return apiError(c, 503, 'authentication_unavailable', 'El acceso privado todavía no está configurado.')
  }
  let appOrigin: string
  let isLocalDevelopment: boolean
  let userId: string
  let recentlyVerified: boolean
  try {
    const parsedOrigin = new URL(APP_ORIGIN)
    appOrigin = parsedOrigin.origin
    isLocalDevelopment = parsedOrigin.hostname === 'localhost' || parsedOrigin.hostname === '127.0.0.1'
  } catch {
    return apiError(c, 503, 'authentication_unavailable', 'El acceso privado todavía no está configurado.')
  }

  const authorization = c.req.header('Authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return apiError(c, 401, 'unauthenticated', 'Inicia sesión para continuar.')
  }

  const requestOrigin = c.req.header('Origin')
  const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)
  if ((requestOrigin && requestOrigin !== appOrigin) || (isMutation && requestOrigin !== appOrigin)) {
    return apiError(c, 403, 'origin_not_allowed', 'No se pudo verificar el origen de esta solicitud.')
  }

  try {
    const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY, publishableKey: CLERK_PUBLISHABLE_KEY })
    const state = await clerk.authenticateRequest(c.req.raw, {
      acceptsToken: 'session_token',
      authorizedParties: [appOrigin],
      clockSkewInMs: isLocalDevelopment ? 30_000 : 5_000,
      ...(CLERK_JWT_KEY ? { jwtKey: CLERK_JWT_KEY } : {}),
    })

    if (!state.isAuthenticated) {
      const isClockSkew = state.reason === 'session-token-iat-in-the-future' || state.reason === 'session-token-nbf'
      const message = isClockSkew
        ? 'La hora de la sesión todavía no coincide con la del servidor. Espera unos segundos y vuelve a intentar.'
        : 'Tu sesión terminó. Inicia sesión de nuevo.'
      return apiError(c, 401, 'unauthenticated', message)
    }

    const auth = state.toAuth()
    userId = auth.userId
    recentlyVerified = auth.has({ reverification: 'strict' })
  } catch (error) {
    console.error('authentication_error', { requestId: c.get('requestId'), name: error instanceof Error ? error.name : 'UnknownError' })
    return apiError(c, 503, 'authentication_unavailable', 'No pudimos verificar tu sesión. Inténtalo de nuevo.')
  }
  c.set('userId', userId)
  c.set('recentlyVerified', recentlyVerified)
  await next()
}
