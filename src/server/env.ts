export type WorkerBindings = {
  ASSETS: { fetch(request: Request): Promise<Response> }
  APP_ORIGIN?: string
  CLERK_SECRET_KEY?: string
  CLERK_PUBLISHABLE_KEY?: string
  CLERK_JWT_KEY?: string
  DATABASE_URL?: string
}
