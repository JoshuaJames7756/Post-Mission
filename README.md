# Post Mission

**The mission ended. Your purpose continues.**

Post Mission is a private, mobile-first planning app for the life that follows a mission. Its current foundation includes authenticated profiles, life areas, hierarchical goals, tasks, a day/week/month calendar, people, and saved places.

## Stack

- React + Vite + strict TypeScript, Tailwind CSS 4, Cloudflare Vite plugin.
- Hono API on Cloudflare Workers and Static Assets.
- Clerk authentication, Neon PostgreSQL, and Drizzle ORM.
- Vitest for the current API/domain checks, plus ESLint. End-to-end, accessibility, and install/offline browser checks remain in the launch validation pass.

## Development

Use Node.js 20.19+ (the project currently targets Node 24) and pnpm. Then:

```powershell
pnpm install
Copy-Item .env.example .env.local
Copy-Item .dev.vars.example .dev.vars
pnpm dev
```

The app will show setup instructions until a real Clerk publishable key is configured. There is no mock identity; signed-in users may load optional example data into their own account.
Vite uses port `5174` to match the local `APP_ORIGIN` configured for Clerk. Keep that origin and the development URL aligned so private API requests can verify the session.

## Configuration

- `.env.local`: `VITE_CLERK_PUBLISHABLE_KEY` only; it is public by design.
- `.dev.vars`: private Worker values `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_JWT_KEY`, `DATABASE_URL`, and the allowed `APP_ORIGIN`.
- Production secrets must be configured as Cloudflare Worker secrets/bindings. Never use `VITE_` for private values.
- Neon migrations are run explicitly by a developer; they are not executed on requests or automatically on deployment.

Real Clerk and Neon credentials are not included in the examples. Create those accounts under the project owner's control and confirm their current free-tier limits and terms before production use.

## Commands

```powershell
pnpm dev
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm preview
pnpm db:generate
pnpm db:migrate
```

`pnpm deploy` is intentionally not run as part of local implementation. Production setup, billing, and deployment require the owner's authorization.

## Status

The API includes health, profile, life-area, hierarchical-goal, task, calendar-event, people, and place routes. The signed-in experience includes Home, Plan, Calendar (day timeline, week strip, and month view), People, Map, profile settings, and saved light/dark/system themes. Calendar events support all-day dates and timezone-aware timed events, goal association, categories/colors, completion, cancellation, archiving, restoration, and private links to People and Places. The server validates event ownership and temporal rules, including daylight-saving transitions. People supports private search, create/edit, relationship type, optional phone, birthday and notes, generated initials avatars, archive/restore, and links to existing events. Map supports private saved places with optional addresses and paired coordinates, direct point selection on the map, searchable list fallback, archive/restore, and links to existing events. Addresses remain private references and are not geocoded automatically. People/event and place/event links use owner-scoped queries and composite foreign keys; photo uploads and geocoding are not available. Tile requests only begin after the user opens the map and accepts the privacy notice. The [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/) is best-effort without an SLA; it requires visible attribution, normal browser caching, no bulk downloads, and no personal or confidential data in requests. Place labels and addresses stay in Post Mission; tile servers receive only the visible map tile coordinates. The map provider is isolated so a production provider can be selected later. Life areas can be reordered, edited, archived, and restored. Goals support create, edit, complete, reopen, archive, and restore; the server validates their hierarchy and dates, and new goal dates use the profile timezone. Tasks support create, edit, complete, reopen, archive, and restore, with optional priority, due date, and goal association available during creation and editing. Priorities are labeled in task lists and Home uses them to break ties after due date. Open tasks can be searched by title and filtered by priority in the browser. Calendar, People, and Places migrations are versioned and applied to the configured development database; future migrations should be generated with `pnpm db:generate` and applied explicitly with a dedicated database URL. Authentication and database-backed usage require real Clerk and Neon credentials.

The automated suite covers health/auth boundaries, domain rules, coordinate/time validation, owner filters, association ownership, API isolation with simulated identities, and UI interactions. It verifies that private routes reject requests without a verified session, an unauthenticated `userId` body field is ignored, and foreign associations are rejected. Full browser journeys with two real Clerk accounts remain part of launch validation. The production preview serves the web manifest and its listed icons. The service worker caches only the public shell and versioned static assets, while `/api/` requests bypass that cache; OSM tiles are not prefetched or promised offline. Browser installation and offline behavior still need manual verification before launch. See [release readiness](docs/RELEASE-READINESS.md) for the current checks and remaining steps.

The PWA foundation includes a web manifest, app icons, and a service worker that pre-caches the public shell and its initial versioned JavaScript and CSS. Other versioned static assets are cached when requested. Requests under `/api/` bypass the service worker cache, and writes still require a network connection. The cache behavior is covered by service-worker tests and the assets returned 200 in a production preview; installation and offline behavior on a phone still need verification before launch.
Confirmed