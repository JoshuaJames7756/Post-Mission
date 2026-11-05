# People Design

## Purpose and scope

People is a private address book for the relationships the user wants to keep present. It is not a public profile, social network, or sales CRM. This increment delivers owned records, search, create/edit, archive/restore, and generated initial avatars. Event links are introduced as a follow-up vertical slice after the person records are usable.

Each person has a required name and relationship type (`family`, `friend`, `mentor`, `community`, or `other`), optional phone, birthday date, and private notes, an accessible avatar color, timestamps, and an archive timestamp. Photo upload, public search, and cross-user sharing are out of scope.

## Data and security

Persist people in Neon through the authenticated Worker API. Use UUID IDs, a Clerk user ID owner column, a PostgreSQL `date` birthday, bounded text, and a fixed avatar color enum. Every query and mutation filters by the verified owner; archived records are excluded by default. A user may have same-name records. Do not normalize phone numbers beyond trimming.

## API

- `GET /api/v1/people?q=&archived=true` lists active or archived records for the authenticated owner; optional case-insensitive search matches name and relationship.
- `POST /api/v1/people` creates a validated record.
- `PATCH /api/v1/people/:id` updates a validated record.
- `POST /api/v1/people/:id/archive` and `/restore` change archival state.

Return 404 for missing or other-owner IDs. Reject malformed inputs with the shared API validation response. No route accepts or trusts a caller-supplied owner ID.

## Interface

Add People as a real navigation destination. Display a searchable private directory with initials and the stored color, relationship, optional phone/birthday/notes, and clear empty/loading/error states. Create and edit share the same accessible form. Archived records are in a secondary expandable list with restore actions. Do not add fake Map/Journey placeholders or photo upload.

## Verification

Cover schema bounds and optional fields, owner-scoped repository reads/writes, unauthenticated route boundaries, archive filtering, and search behavior. Review the People page in the browser after applying its additive migration. Event/person associations remain a defined next increment with composite owner-scoped foreign keys and a real UI control.
