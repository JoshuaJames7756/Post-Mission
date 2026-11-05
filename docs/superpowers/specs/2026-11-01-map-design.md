# Map Design

## Purpose and scope

Map is the private saved-places module in phase 4. It supports name, type, optional address, optional latitude/longitude, event links, edit, archive, and restore. The directory view remains usable when coordinates are absent or map tiles fail. No geocoding, route planning, background location, public search, photo upload, or prefetch/offline tile download is included.

## Provider and privacy

Use Leaflet as the small provider-agnostic renderer and OpenStreetMap Standard raster tiles for the first development slice. OSMF documents these tiles as best-effort without an SLA, requires visible attribution and caching, disallows bulk/offline prefetch, and says not to submit personal or confidential data. Do not request tiles until the user explicitly opens the map view. The UI explains that OSM tile servers see the currently viewed map area, while saved place names, addresses, private account IDs, and notes are not sent. The map receives only coordinates needed to place local markers. Store the tile source behind a provider interface so a later production tile provider can replace it without changing places or event links.

Map tile selection is a user action; there is no automatic geocoding and no transmission of address or place name to a geocoder. If external tiles fail, return to the stored place list without losing data.

## Data and security

Use UUID IDs, a verified Clerk owner ID, a bounded name/address, a fixed place type enum, and paired nullable latitude/longitude double precision columns. PostgreSQL checks require both coordinates to be null or both present and within latitude `[-90, 90]` and longitude `[-180, 180]`. Composite owner foreign keys protect `event_places` links to both events and places. Every API read, write, and association validation filters by the authenticated owner. Archive remains reversible.

## API

- `GET /api/v1/places?q=&archived=true` lists active or archived places; optional search matches name, address, and type.
- `POST /api/v1/places`, `PATCH /api/v1/places/:id`, `POST /api/v1/places/:id/archive`, and `/restore` manage records.
- `GET /api/v1/places/:id/events` and `PUT /api/v1/places/:id/events` read/replace active same-owner event links.

Use shared Zod validation and return 404 without confirming another user's resource exists.

## Interface

Add Map to primary mobile navigation. List is the default and works without map permissions or network. A separate map action explains OSM tile-area privacy and only then opens the interactive layer; attribution stays visible. Create/edit offers a primary “choose point on map” action that also works with no saved coordinates. Selecting a saved place without coordinates opens it for editing and starts point selection; clicking the map places a draft marker and copies coordinates into the form for the user to save. Manual coordinate entry remains secondary. An address is a private reference and is never geocoded automatically. Selecting a saved marker opens its locally stored details. Map loading errors leave the list available. Create/edit includes name, type, optional address, and paired coordinate fields; the event association selector lists existing near-term events.

## Verification

Cover schema coordinate ranges and pair semantics, repository ownership, authenticated route boundaries, and event association validation. Manually inspect the map/list boundary at a phone viewport. Do not create test places in the user's Neon account. Do not deploy or configure a production tile provider in this increment.
