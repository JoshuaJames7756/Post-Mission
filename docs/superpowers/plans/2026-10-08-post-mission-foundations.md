# Post Mission Foundations Implementation Plan

> **For agentic workers:** Execute inline, one task at a time. Run the listed checks at each checkpoint and review the diff before committing.

**Goal:** Build the first persistent, private Post Mission slice: sign-in, profile, life areas, hierarchical goals, and tasks.

**Architecture:** A React/Vite SPA and Hono API run together through the Cloudflare Vite plugin. The Worker verifies Clerk sessions, validates inputs, enforces per-user ownership, and uses Drizzle with Neon PostgreSQL. Browser code only calls `/api/v1`.

**Tech Stack:** React, Vite, strict TypeScript, Tailwind CSS 4, Shadcn UI, Lucide, TanStack Query, React Hook Form, Zod, Sonner, Motion, Cloudflare Workers/Vite plugin/Wrangler, Hono, Clerk, Drizzle, Neon, Vitest, React Testing Library, Playwright, axe-core, ESLint, Prettier.

**Spec:** `docs/superpowers/specs/2026-10-08-post-mission-foundations-design.md`

## Global Constraints

- Use Cloudflare Workers and Static Assets; do not use Vercel as the deployment target.
- Use Neon PostgreSQL; the browser must never connect directly to the database.
- The Worker must validate identity, input, ownership, and cross-record associations for every private operation.
- Keep the UI Spanish-first, mobile-first, and aligned with Purposeful Calm.
- Do not enable paid resources, automatic billing, or deploy without explicit authorization.
- Do not implement offline writes or claim local changes were saved by the server.
- Do not claim test, accessibility, build, cost, or compatibility results that were not verified.
- Before dependency installation, verify the current stable compatible versions and service limits from official documentation.

## Official References Checked 2026-10-08

- Cloudflare's React + Vite guide documents a SPA plus Worker API using the Cloudflare Vite plugin: https://developers.cloudflare.com/workers/framework-guides/web-apps/react/
- Cloudflare's Workers Free limits currently list 100,000 requests/day and 10 ms CPU per invocation: https://developers.cloudflare.com/workers/platform/limits/
- Clerk `authenticateRequest()` supports networkless token verification with `jwtKey`; the docs recommend `authorizedParties`: https://clerk.com/docs/reference/backend/authenticate-request
- Clerk pricing currently lists 50,000 monthly retained users free per app; verify its current terms again before enabling production auth: https://clerk.com/pricing
- Drizzle documents Neon HTTP and Neon WebSockets drivers; interactive transactions require the WebSocket-based driver. Neon requires a `Pool`/`Client` to be created and closed within each Worker request, never reused globally: https://orm.drizzle.team/docs/connect-neon and https://github.com/neondatabase/serverless
- Neon plan limits and commercial terms remain a pre-implementation verification item; do not infer them from remembered quotas.

---

## File Map

```text
index.html                                      SPA document and metadata
src/client/main.tsx                             React entry
src/client/app/App.tsx                          Providers and top-level routes
src/client/app/router.tsx                       Auth and feature routes
src/client/components/ui/                       Adapted Shadcn primitives
src/client/features/auth/                        Clerk provider and sign-in
src/client/features/profile/                     Profile form and query hooks
src/client/features/plan/                        Areas, goal tree, task workflows
src/client/features/home/                        Next actions and active goals
src/client/lib/api.ts                            Typed same-origin API client
src/client/lib/query-client.ts                   TanStack Query defaults
src/client/styles/                               Tailwind entry and design tokens
src/shared/schemas/                               Shared request/response schemas
src/shared/types/                                 Domain types
src/server/app.ts                                 Hono app, error mapping, API mount
src/server/routes/                                Domain HTTP contracts
src/server/middleware/                            Auth, request id, error handling
src/server/modules/profile/                       Profile schema/service/repository
src/server/modules/life-areas/                    Area schema/service/repository
src/server/modules/goals/                         Goal schema/service/repository
src/server/modules/tasks/                         Task schema/service/repository
src/server/db/schema.ts                           Drizzle PostgreSQL schema
src/server/db/client.ts                           Worker-bound Neon HTTP client
drizzle/                                          Generated migrations
tests/unit/                                       Domain rule tests
tests/api/                                        Worker/API authorization tests
tests/e2e/                                        Playwright user journeys
public/                                           PWA icons and static assets
vite.config.ts                                    React and Cloudflare Vite plugins
wrangler.jsonc                                    Worker and static asset config
drizzle.config.ts                                 Migration configuration
vitest.config.ts                                  Unit and API test configuration
playwright.config.ts                              Browser test configuration
eslint.config.js                                  Type-aware lint configuration
.env.example                                      Variable names without secrets
README.md                                         Local setup, migrations, and deployment
```

## Task 1: Establish the Cloudflare React/Vite workspace

**Files:** Generated by official Cloudflare React scaffold; then modify `vite.config.ts`, `wrangler.jsonc`, `package.json`, `tsconfig*.json`, `.gitignore`, and add `.env.example`.

**Interfaces:** Produces a working React SPA served as Worker Static Assets, `/api/*` Worker entry point, scripts `dev`, `build`, `preview`, `deploy`, `typecheck`, `lint`, `format:check`, and no production secrets.

- [ ] Recheck Cloudflare's React guide and scaffold command. Preserve `docs/` while generating the app; use a temporary scaffold only if the CLI refuses the non-empty project folder.
- [ ] Pin the resolved compatible stable package versions in the lockfile. Do not select prerelease versions or bypass peer-dependency checks.
- [ ] Configure `strict: true`, Tailwind CSS 4, the Cloudflare Vite plugin, SPA static asset fallback, and Worker `/api/*` routing.
- [ ] Add `.env.example` containing variable names only; ensure `.env*`, `.dev.vars`, generated Worker types, and build output are ignored appropriately.
- [ ] Run `npm run typecheck`, `npm run lint`, and `npm run build`.
- [ ] Confirm Vite preview serves the SPA and Worker `/api/v1/health` locally.
- [ ] Review `git diff`; commit `chore: scaffold cloudflare react app`.

## Task 2: Add shared contracts and API foundation

**Files:** `src/shared/schemas/api.ts`, `src/shared/schemas/profile.ts`, `src/server/app.ts`, `src/server/routes/health.ts`, `src/server/middleware/request-id.ts`, `src/server/lib/errors.ts`, `tests/api/health.test.ts`.

**Interfaces:** `ApiSuccess<T> = { data: T }`; `ApiError = { error: { code: string; message: string; details?: unknown; requestId: string } }`. `app` handles `/api/v1/*`, unknown routes, request IDs, and safe errors.

- [ ] Write health-route tests for 200 `{ data: { status: 'ok' } }`, unknown routes, and stable error envelope.
- [ ] Run `npm run test -- tests/api/health.test.ts` and confirm the new tests fail before implementation.
- [ ] Implement the Hono app and route mounting; keep health public and return no environment or database information.
- [ ] Run the API test, typecheck, and lint.
- [ ] Review the diff; commit `feat: add versioned hono api foundation`.

## Task 3: Implement database schema and migration workflow

**Files:** `src/server/db/schema.ts`, `src/server/db/client.ts`, `drizzle.config.ts`, `drizzle/0000_*.sql`, `.env.example`, `tests/unit/db-schema.test.ts`, `README.md`.

**Interfaces:** Drizzle tables `profiles`, `life_areas`, `goals`, `tasks`; `createDb(env)` constructs a Neon WebSocket pool from a private Worker binding inside one request, returns the Drizzle client and a close function, and closes the pool before that request context ends. IDs are UUID except Clerk `profiles.user_id` text.

- [ ] Verify current Neon free-plan limits, inactivity/suspend behavior, branching, connection guidance, commercial terms, and Drizzle driver/migration commands in official docs. Record only confirmed details in README. Confirm WebSocket driver support in Cloudflare Workers because goal hierarchy updates need interactive transactions; if unsupported, stop and revise the design before implementing those mutations. Keep each pool request-scoped and close it with the request execution context.
- [ ] Define owner columns and unique/composite foreign keys so `life_area_id`, `parent_goal_id`, and `goal_id` cannot link across users. Add date checks and query-driven indexes.
- [ ] Keep migration execution in a local/developer command; never run it per HTTP request or automatically on deploy.
- [ ] Generate and inspect the initial migration; verify it contains no secrets and correctly creates constraints.
- [ ] Add an opt-in local DB integration-test setup that skips cleanly without a test database URL; never point tests at production.
- [ ] Run schema tests, migration generation check, typecheck, and lint.
- [ ] Review schema and migration diff; commit `feat: add private planning schema`.

## Task 4: Authenticate API requests and provision profiles safely

**Files:** `src/server/middleware/auth.ts`, `src/server/modules/profile/{repository,service,routes}.ts`, `src/shared/schemas/profile.ts`, `src/client/features/auth/{AuthProvider,SignInPage}.tsx`, `src/client/features/profile/{ProfileForm,profile-queries}.ts(x)`, `tests/api/auth.test.ts`, `tests/api/profile.test.ts`.

**Interfaces:** `requireUser(c): AuthenticatedUser` obtains the ID only from verified Clerk session. `GET /api/v1/me` returns `{ data: Profile }`; `PATCH /api/v1/me` accepts validated display name, timezone, and theme preference.

- [ ] Recheck Clerk's current React SDK and backend verification docs. Use verified session tokens, private Worker bindings, and explicit `authorizedParties`; configure Google as an optional supported social connection only if current free terms allow it.
- [ ] Write tests for missing/invalid token (401), disallowed party, valid user identity, profile creation on first authenticated request, profile update validation, and user A never reading/updating user B.
- [ ] Run the auth/profile API tests and confirm the unimplemented endpoints fail the assertions.
- [ ] Implement Clerk provider/sign-in UI and Worker verification. Keep public health route outside auth; protect every profile route.
- [ ] Upsert profile by verified Clerk ID; never accept `user_id` from request body. Map user identity failures to non-sensitive error responses.
- [ ] Run API tests with two distinct test identities, typecheck, lint, and build.
- [ ] Review env bindings and diff; commit `feat: add clerk authentication and profile`.

## Task 5: Implement life-area lifecycle

**Files:** `src/server/modules/life-areas/{schema,repository,service,routes}.ts`, `src/client/features/plan/areas/{AreaList,AreaForm,area-queries}.tsx`, `src/shared/schemas/life-area.ts`, `tests/unit/life-areas.test.ts`, `tests/api/life-areas.test.ts`.

**Interfaces:** `GET|POST /api/v1/life-areas`; `PATCH /:id`; `POST /:id/archive`; `POST /:id/restore`. Every operation is scoped to verified `user_id`; list results sort by `sort_order`.

- [ ] Write unit/API tests for valid create, validation, ordering, archive/restore, duplicate handling if enabled, and cross-user access denial.
- [ ] Run the tests and confirm expected failures.
- [ ] Implement service/repository rules and shared Zod contracts; use owner-scoped updates and opaque not-found behavior for foreign IDs.
- [ ] Build accessible area list/form with loading, empty, pending, error/retry, and success states.
- [ ] Run unit/API tests, typecheck, lint, and build.
- [ ] Review diff; commit `feat: add life area management`.

## Task 6: Implement goal hierarchy and safe task links

**Files:** `src/server/modules/goals/{schema,repository,service,routes}.ts`, `src/server/modules/tasks/{schema,repository,service,routes}.ts`, `src/shared/schemas/{goal,task}.ts`, `src/client/features/plan/{goals,tasks}/`, `tests/unit/{goals,tasks}.test.ts`, `tests/api/{goals,tasks}.test.ts`.

**Interfaces:** CRUD and complete endpoints from the spec plus explicit archive/restore endpoints. Goal create/update accepts `lifeAreaId`, `parentGoalId`, `periodType`, `startDate`, `targetDate`; task create/update accepts nullable `goalId`, title, status, priority, due date.

- [ ] Before coding hierarchy mutations, encode the spec's period ordering Year → Month → Week → Day and define whether a child must be exactly one level below its parent; reject cycles, invalid dates, and incompatible parent/child ranges.
- [ ] Write domain tests for each legal parent period, every illegal skip/reversal, cycles, range validation, status/completion timestamps, and target date before start.
- [ ] Write API tests for two-user goal/task isolation, linked goal ownership, create/update/complete/archive/restore, validation errors, and manipulated IDs.
- [ ] Run the new tests and verify they fail before implementation.
- [ ] Implement goal mutations with a transaction and concurrency guard so simultaneous parent changes cannot create cycles; ensure repository queries always include `user_id`.
- [ ] Implement task service with ownership-checked optional goal relation and consistent completion timestamp transitions.
- [ ] Build goal tree and task UI with forms, confirmations, keyboard access, responsive layout, and recoverable server errors.
- [ ] Run domain/API tests, typecheck, lint, and build.
- [ ] Review diff; commit `feat: add hierarchical goals and tasks`.

## Task 7: Build Home, navigation, themes, and profile settings

**Files:** `src/client/app/{App,router}.tsx`, `src/client/components/layout/`, `src/client/features/home/`, `src/client/features/profile/`, `src/client/styles/tokens.css`, `src/client/lib/query-client.ts`, `tests/unit/theme.test.ts`, `tests/e2e/core-journey.spec.ts`.

**Interfaces:** Home queries only confirmed API data; query keys include domain and user scope, stale private caches are cleared on sign-out, theme setting persists through profile API.

- [ ] Write browser-flow coverage for signed-out redirect, sign-in state, profile onboarding, area/goal/task create and completion, refresh persistence, sign-out cache clear, and API error retry.
- [ ] Implement mobile primary navigation Home/Plan, profile/settings secondary navigation, and desktop phone invitation using viewport/capability rules rather than user-agent detection.
- [ ] Add distinct light/dark/system tokens; check text, controls, focus, borders, and disabled/error states for contrast. Respect `prefers-reduced-motion`.
- [ ] Add Home's next task and active goals from API data; do not show fabricated statistics.
- [ ] Run Playwright flows and axe checks at phone and tablet viewports; manually inspect desktop invitation and keyboard flow.
- [ ] Run all tests, typecheck, lint, and build; review diff; commit `feat: build post mission planning experience`.

## Task 8: PWA, documentation, and final verification

**Files:** `public/manifest.webmanifest`, `public/icons/*`, `vite.config.ts`, `wrangler.jsonc`, `README.md`, `tests/e2e/pwa.spec.ts`.

**Interfaces:** Manifest supports install; only public static assets may be cached. API responses are `no-store` or otherwise excluded from shared caches. README documents local development, Clerk setup, Neon setup, migrations, tests, build, deploy, and verified limitations.

- [ ] Add manifest/icons and verify installability in Playwright/DevTools; configure no cache rule for authenticated API routes.
- [ ] Simulate offline behavior: static shell may load when cached; API writes fail visibly and do not claim success.
- [ ] Document required private Worker bindings and local secret file handling with placeholders only; include migration and deploy commands, but do not deploy.
- [ ] Run complete unit/API/e2e suite, strict typecheck, lint, format check, production build, and config validation; record exact results.
- [ ] Run `npm audit` and review advisories without auto-upgrading incompatible packages.
- [ ] Inspect final diff for secrets, fake data, placeholder buttons, uncaught API errors, and untested ownership paths.
- [ ] Commit `docs: document post mission setup and verification`.

## Execution Notes

- The repo currently contains the design spec but no Git metadata or app scaffold. Task 1 must initialize Git only after checking the workspace contents and confirming there is no existing repository.
- Keep each commit small and task-scoped; never rewrite or reset user changes.
- Test identities and DB fixtures must be isolated and synthetic. No production credentials or database should be used in automated tests.
- Deployment remains out of scope until the user explicitly authorizes production configuration and deployment.
