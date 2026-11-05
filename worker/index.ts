import { api, type AppEnv } from '../src/server/app.js'
import { createDb } from '../src/server/db/client.js'
import { retryPendingAccountDeletions } from '../src/server/modules/account-deletion/service.js'

export default {
  fetch(request: Request, env: AppEnv['Bindings'], executionContext: ExecutionContext) {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/')) {
      return api.fetch(request, env, executionContext)
    }
    return env.ASSETS.fetch(request)
  },
  async scheduled(_controller, env: AppEnv['Bindings']) {
    if (!env.DATABASE_URL || !env.CLERK_SECRET_KEY) return
    const connection = createDb(env)
    try { await retryPendingAccountDeletions(connection.db, env) }
    finally { await connection.close() }
  },
} satisfies ExportedHandler<Env>
