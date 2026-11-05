import type { Database } from './db/client.js'
import type { WorkerBindings } from './env.js'

export type AppEnv = {
  Bindings: WorkerBindings
  Variables: {
    requestId: string
    userId: string
    recentlyVerified: boolean
    db: Database
  }
}
