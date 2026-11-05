# Post Mission Calendar Design

## Purpose

Start phase 4 of the user-approved Post Mission brief with a real, private calendar. Events must be persisted through the Worker API and Neon; the interface must not present placeholder sections as working features.

## Product scope

The Calendar module will ultimately provide month, week, and day views; all-day and timed events; categories and colors; optional goal, place, people, and note associations; and scheduled, completed, and cancelled states. Events can be archived and restored. Recurrence and reminders are outside the MVP.

Implementation proceeds in vertical increments. The first usable increment adds persistent event creation, listing, editing, state changes, and a month view. Week/day views and associations to People, Places, and Notes follow when those modules exist. Goal association can use the existing Goals module.

## Data and time rules

- Every event has an opaque UUID, verified owner ID, title, optional description, category, color token, status, archive timestamp, and timestamps.
- All-day events use PostgreSQL `date` values for start and end, inclusive. They are never converted through UTC and have no displayed clock time.
- Timed events use `timestamptz` instants and a required IANA time-zone identifier. The API accepts a local date-time, IANA zone, and explicit selected UTC offset. The server resolves that combination against the zone's valid instants: nonexistent local times are rejected, and ambiguous times require the client to select an offset.
- Timed events require an end instant later than the start instant. The display uses the event's stored zone, not the device's current zone.
- Optional `goal_id` uses a composite owner-scoped foreign key. `place_id`, event-person links, and note links are added with their owning modules and real foreign keys; no dangling IDs are accepted.
- Category text is user-entered and bounded. Color is selected from a fixed accessible palette so arbitrary colors cannot produce unreadable contrast.
- Archived and cancelled events do not appear in ordinary calendar queries. Completed events remain available in history.

## API and authorization

The Worker exposes owner-scoped `/api/v1/events` routes for range listing, creation, retrieval, updates, completion, cancellation, archive, and restore. Input is validated with Zod on the server. Every read and mutation includes the verified `user_id`; goal associations are checked for ownership and active state. Calendar range queries require `from`, `to`, and an IANA time zone and return events overlapping that calendar range.

The browser uses the existing TanStack Query and authenticated same-origin API client. Neon credentials remain server-only; migrations remain explicit developer operations.

## Interface

Calendar becomes a real mobile navigation destination. The first view is a localized month grid with previous/next month navigation, a clear current-day indicator, and compact event labels that distinguish all-day from timed events. A form supports event title, category/color, all-day/timed selection, the relevant date fields, time zone, and optional existing goal. Loading, empty, validation, save, retry, and session/error states are required. Desktop continues to follow the brief's phone-first invitation policy.

## Verification and later increments

Unit and API checks cover date semantics, time-zone validation, DST gaps/folds, duration ordering, categories, owner isolation, goal ownership, archive/restore, range overlap, and status behavior. The first increment is manually reviewed at a phone viewport. Later increments add week/day views and, alongside People/Places/Notes, their association tables and controls. Production deployment, paid map services, geocoding, recurring events, and push reminders are not part of this increment.
